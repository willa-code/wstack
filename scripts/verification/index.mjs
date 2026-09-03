#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = resolve(HERE, '../..');
export const CATALOG_PATH = join(HERE, 'skill-catalog.json');
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.wstack']);

export class VerificationFailure extends Error {
  constructor(issues, message = 'verification failed') {
    super(message);
    this.name = 'VerificationFailure';
    this.issues = [...issues];
  }
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function loadCatalog(path = CATALOG_PATH) {
  const catalog = await readJson(path);
  const issues = [];
  if (catalog?.schemaVersion !== '1.0.0') issues.push(`${path}: unsupported catalog schema`);
  if (!catalog?.product?.name || !catalog?.product?.version) issues.push(`${path}: product metadata is incomplete`);
  if (!catalog?.protocol?.version) issues.push(`${path}: protocol metadata is incomplete`);
  if (!Array.isArray(catalog?.skills) || catalog.skills.length === 0) issues.push(`${path}: skills must be a non-empty array`);
  const names = new Set();
  for (const skill of catalog.skills || []) {
    if (!skill || typeof skill.name !== 'string' || typeof skill.path !== 'string' || typeof skill.docsLink !== 'string') {
      issues.push(`${path}: each skill needs name, path, and docsLink`);
      continue;
    }
    if (names.has(skill.name)) issues.push(`${path}: duplicate skill ${skill.name}`);
    names.add(skill.name);
  }
  if (issues.length) throw new VerificationFailure(issues, 'invalid catalog');
  return catalog;
}

async function exists(path) {
  try { await stat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function filesUnder(root, options = {}) {
  const result = [];
  const skip = options.skip || (() => false);
  async function visit(current, rel = '') {
    let entries = [];
    try { entries = await readdir(current, { withFileTypes: true }); } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const childRel = rel ? join(rel, entry.name) : entry.name;
      if (skip(childRel, entry)) continue;
      const child = join(current, entry.name);
      if (entry.isDirectory()) await visit(child, childRel);
      else if (entry.isFile()) result.push(childRel.split(sep).join('/'));
    }
  }
  await visit(root);
  return result;
}

function parseFrontmatter(text, path) {
  const lines = text.split(/\r?\n/);
  const issues = [];
  if (lines[0]?.trim() !== '---') return { fields: {}, issues: [`${path}: frontmatter must start with ---`] };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { fields: {}, issues: [`${path}: frontmatter must close with ---`] };
  const fields = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    fields[match[1]] = value;
  }
  for (const field of ['name', 'description']) if (!fields[field]) issues.push(`${path}: frontmatter requires ${field}`);
  return { fields, issues };
}

function markdownLinks(text) {
  const links = [];
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(pattern)) links.push(match[1].trim().split(/[?#]/, 1)[0]);
  return links;
}

export async function checkCleanliness(root = DEFAULT_ROOT) {
  const issues = [];
  const forbidden = [join(root, 'skills-lock.json'), join(root, '.wstack')];
  for (const path of forbidden) if (await exists(path)) issues.push(`${relative(root, path)}: forbidden checkout artifact`);
  const agentSkills = join(root, '.agents', 'skills');
  if (await exists(agentSkills)) {
    const entries = await readdir(agentSkills, { withFileTypes: true });
    for (const entry of entries) if (entry.name !== 'maintain-wstack') issues.push(`.agents/skills/${entry.name}: unexpected installed skill; only maintain-wstack is allowed`);
  }
  return issues;
}

export async function checkCatalogAndSkills(root = DEFAULT_ROOT, catalog = null) {
  const issues = [];
  const loaded = catalog || await loadCatalog();
  if (loaded.skills.some(skill => skill.name === 'maintain-wstack')) issues.push('catalog: internal .agents/skills/maintain-wstack must not be a public skill');
  const maintainerSkill = join(root, '.agents', 'skills', 'maintain-wstack', 'SKILL.md');
  if (!(await exists(maintainerSkill))) issues.push(`${maintainerSkill}: canonical internal maintainer skill is missing`);
  else {
    const maintainerText = await readFile(maintainerSkill, 'utf8');
    if (!/^name:\s*maintain-wstack\s*$/m.test(maintainerText)) issues.push(`${maintainerSkill}: frontmatter name must be maintain-wstack`);
    if (!/^\s*internal:\s*true\s*$/m.test(maintainerText)) issues.push(`${maintainerSkill}: metadata.internal must be true so consumer discovery excludes it`);
  }
  const sourceRoot = join(root, loaded.distribution.skillsDirectory);
  let discoveredEntries;
  try { discoveredEntries = await readdir(sourceRoot, { withFileTypes: true }); } catch (error) {
    if (error.code === 'ENOENT') return [`${sourceRoot}: skills directory is missing`];
    throw error;
  }
  const discovered = discoveredEntries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const listed = loaded.skills.map(skill => skill.name).sort();
  if (JSON.stringify(discovered) !== JSON.stringify(listed)) issues.push(`catalog: listed skills do not match ${loaded.distribution.skillsDirectory}/ directories`);
  for (const skill of loaded.skills) {
    const skillDir = join(root, skill.path);
    const skillFile = join(skillDir, 'SKILL.md');
    if (!(await exists(skillFile))) { issues.push(`${skillFile}: missing SKILL.md`); continue; }
    const parsed = parseFrontmatter(await readFile(skillFile, 'utf8'), skillFile);
    issues.push(...parsed.issues);
    if (parsed.fields.name !== skill.name) issues.push(`${skillFile}: frontmatter name ${JSON.stringify(parsed.fields.name)} does not match catalog ${JSON.stringify(skill.name)}`);
    if (skill.description && parsed.fields.description !== skill.description) issues.push(`${skillFile}: description differs from catalog`);
    const expectedFolder = relative(sourceRoot, skillDir).split(sep).join('/');
    if (expectedFolder !== skill.name) issues.push(`${skill.path}: catalog path must resolve directly under ${loaded.distribution.skillsDirectory}`);
    const expectedHumanOnly = skill.name === 'setup-wstack';
    const actualHumanOnly = parsed.fields['disable-model-invocation'] === 'true';
    if (actualHumanOnly !== expectedHumanOnly) issues.push(`${skillFile}: disable-model-invocation policy is inconsistent with the public invocation contract`);
    const policyFile = join(skillDir, 'agents', 'openai.yaml');
    if (actualHumanOnly && !(await exists(policyFile))) issues.push(`${skillFile}: human-only skill lacks agents/openai.yaml`);
    if (await exists(policyFile)) {
      const policy = await readFile(policyFile, 'utf8');
      if (!actualHumanOnly || !/^\s*allow_implicit_invocation:\s*false\s*$/m.test(policy)) issues.push(`${policyFile}: policy must only accompany a human-only skill and deny implicit invocation`);
    }
  }
  return issues;
}

export async function checkDocumentation(root = DEFAULT_ROOT, catalog = null) {
  const issues = [];
  const loaded = catalog || await loadCatalog();
  const markdown = await filesUnder(root, { skip: (rel, entry) => entry.isDirectory() && IGNORED_DIRS.has(entry.name) });
  for (const rel of markdown.filter(file => file.endsWith('.md'))) {
    const path = join(root, rel);
    for (const link of markdownLinks(await readFile(path, 'utf8'))) {
      if (!link || /^(?:https?:|mailto:|#)/.test(link)) continue;
      const target = resolve(dirname(path), link);
      if (!(await exists(target))) issues.push(`${rel}: broken local link ${link}`);
    }
  }
  const catalogDoc = join(root, 'docs', 'guide', '02-skill-catalog.md');
  if (!(await exists(catalogDoc))) return [...issues, `${catalogDoc}: missing public catalog documentation`];
  const text = await readFile(catalogDoc, 'utf8');
  for (const skill of loaded.skills) if (!text.includes(`[${skill.name}](${skill.docsLink})`)) issues.push(`${catalogDoc}: missing catalog entry for ${skill.name}`);
  const documentedSkills = new Set();
  for (const link of markdownLinks(text)) {
    const match = /^\.\.\/\.\.\/skills\/([^/]+)\/SKILL\.md$/.exec(link);
    if (match) documentedSkills.add(match[1]);
  }
  for (const name of documentedSkills) if (!loaded.skills.some(skill => skill.name === name)) issues.push(`${catalogDoc}: documents unknown skill ${name}`);
  return issues;
}

export async function checkDistributionDiscovery(root = DEFAULT_ROOT, catalog = null) {
  const issues = [];
  const loaded = catalog || await loadCatalog();
  const readme = join(root, 'README.md');
  if (!(await exists(readme))) return [`${readme}: missing install documentation`];
  const text = await readFile(readme, 'utf8');
  const install = /\bnpx\s+(?:--[^\s`]+\s+)*skills(?:@[^\s`]+)?\s+add\s+([^\s`]+)/.exec(text);
  if (!install) issues.push(`${readme}: install command is not discoverable`);
  else if (install[1] !== loaded.distribution.source) issues.push(`${readme}: install source ${JSON.stringify(install[1])} does not match catalog ${JSON.stringify(loaded.distribution.source)}`);
  const maintenance = join(root, 'docs', 'maintenance', 'install.md');
  if (await exists(maintenance) && loaded.distribution.sourceRevision) {
    const maintenanceText = await readFile(maintenance, 'utf8');
    const revision = loaded.distribution.sourceRevision.startsWith('#') ? loaded.distribution.sourceRevision : `@${loaded.distribution.sourceRevision}`;
    const pinned = new RegExp(`\\bskills@latest\\s+add\\s+${loaded.distribution.source.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}${revision}\\b`);
    if (!pinned.test(maintenanceText)) issues.push(`${maintenance}: missing pinned install command for catalog release`);
  }
  const discovery = join(root, 'skills', 'setup-wstack', 'scripts', 'discover_project.mjs');
  if (!(await exists(discovery))) issues.push(`${discovery}: install discovery script is missing`);
  return issues;
}

export async function checkNodeSyntax(root = DEFAULT_ROOT) {
  const issues = [];
  const files = (await filesUnder(root, { skip: (rel, entry) => entry.isDirectory() && IGNORED_DIRS.has(entry.name) })).filter(file => file.endsWith('.mjs'));
  for (const rel of files) {
    const result = spawnSync(process.execPath, ['--check', join(root, rel)], { encoding: 'utf8' });
    if (result.status !== 0) issues.push(`${rel}: Node syntax check failed${result.stderr ? ` (${result.stderr.trim()})` : ''}`);
  }
  return issues;
}

export async function checkMetadata(root = DEFAULT_ROOT, catalog = null) {
  const issues = [];
  const loaded = catalog || await loadCatalog();
  const packagePath = join(root, 'package.json');
  let packageJson = null;
  if (await exists(packagePath)) {
    try {
      packageJson = await readJson(packagePath);
      if (packageJson.name !== loaded.product.name) issues.push(`${packagePath}: package name does not match catalog product`);
      if (packageJson.version !== loaded.product.version) issues.push(`${packagePath}: package version ${JSON.stringify(packageJson.version)} does not match catalog`);
    } catch (error) { issues.push(`${packagePath}: invalid JSON (${error.message})`); }
  } else issues.push(`${packagePath}: package metadata hook target is missing`);
  const runtimePath = join(root, loaded.hooks.runtimeManifest);
  if (!(await exists(runtimePath))) { issues.push(`${runtimePath}: runtime metadata hook target is missing`); return issues; }
  let runtime;
  try { runtime = await readJson(runtimePath); } catch (error) { issues.push(`${runtimePath}: invalid JSON (${error.message})`); return issues; }
  if (runtime.productVersion !== loaded.product.version) issues.push(`${runtimePath}: productVersion ${JSON.stringify(runtime.productVersion)} does not match catalog ${JSON.stringify(loaded.product.version)}`);
  if (runtime.protocolVersion !== loaded.protocol.version) issues.push(`${runtimePath}: protocolVersion ${JSON.stringify(runtime.protocolVersion)} does not match catalog ${JSON.stringify(loaded.protocol.version)}`);
  if (JSON.stringify(runtime.compatibleProtocols) !== JSON.stringify(loaded.protocol.compatibleVersions)) issues.push(`${runtimePath}: compatibleProtocols does not match catalog protocol compatibility`);
  if (!loaded.protocol.compatibleVersions.includes(runtime.protocolVersion)) issues.push(`${runtimePath}: runtime protocol is not listed as compatible`);
  const versionModule = join(root, 'skills', 'setup-wstack', 'scripts', 'runtime', 'version.mjs');
  let versionProduct;
  let versionProtocol;
  if (await exists(versionModule)) {
    const versionText = await readFile(versionModule, 'utf8');
    versionProduct = /export const PRODUCT_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(versionText)?.[1];
    versionProtocol = /export const PROTOCOL_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(versionText)?.[1];
    if (versionProduct !== loaded.product.version) issues.push(`${versionModule}: PRODUCT_VERSION does not match catalog`);
    if (versionProtocol !== loaded.protocol.version) issues.push(`${versionModule}: PROTOCOL_VERSION does not match catalog`);
  } else issues.push(`${versionModule}: version metadata hook target is missing`);
  if (runtime.productVersion !== packageJson?.version || runtime.productVersion !== versionProduct) issues.push(`${runtimePath}: productVersion must match package.json.version and version.mjs PRODUCT_VERSION`);
  if (runtime.protocolVersion !== versionProtocol) issues.push(`${runtimePath}: protocolVersion must match version.mjs PROTOCOL_VERSION`);
  const hook = process.env[loaded.hooks.optionalProductMetadataCommand];
  if (hook) {
    const result = spawnSync(hook, [], { cwd: root, shell: true, encoding: 'utf8' });
    if (result.status !== 0) issues.push(`product metadata hook ${loaded.hooks.optionalProductMetadataCommand} failed${result.stderr ? `: ${result.stderr.trim()}` : ''}`);
  }
  return issues;
}

export async function verifyFast(root = DEFAULT_ROOT) {
  const catalog = await loadCatalog();
  const issues = [
    ...(await checkCleanliness(root)),
    ...(await checkCatalogAndSkills(root, catalog)),
    ...(await checkDocumentation(root, catalog)),
    ...(await checkDistributionDiscovery(root, catalog)),
    ...(await checkMetadata(root, catalog)),
  ];
  return { ok: issues.length === 0, issues, catalog };
}

export async function verifyFull(root = DEFAULT_ROOT, options = {}) {
  const fast = await verifyFast(root);
  const issues = [...fast.issues, ...(await checkNodeSyntax(root))];
  if (options.network) issues.push(...await checkNetwork(fast.catalog, options));
  return { ok: issues.length === 0, issues, catalog: fast.catalog };
}

export async function checkNetwork(catalog, options = {}) {
  const packageSpec = `${catalog.distribution.skillsCliPackage}@${catalog.distribution.skillsCliVersion}`;
  const result = spawnSync(options.npm || 'npm', ['view', packageSpec, 'version', '--json'], { encoding: 'utf8', timeout: options.timeoutMs || 30000 });
  if (result.status !== 0) return [`network metadata check failed for ${packageSpec}${result.stderr ? `: ${result.stderr.trim()}` : ''}`];
  let version;
  try { version = JSON.parse(result.stdout.trim()); } catch { version = result.stdout.trim().replace(/^"|"$/g, ''); }
  return version === catalog.distribution.skillsCliVersion ? [] : [`network metadata check resolved ${packageSpec} as ${JSON.stringify(version)}`];
}

export async function compareDirectories(source, installed) {
  const issues = [];
  const [sourceFiles, installedFiles] = await Promise.all([filesUnder(source), filesUnder(installed)]);
  if (JSON.stringify(sourceFiles) !== JSON.stringify(installedFiles)) {
    const expected = new Set(sourceFiles), actual = new Set(installedFiles);
    for (const file of sourceFiles) if (!actual.has(file)) issues.push(`${installed}: missing installed file ${file}`);
    for (const file of installedFiles) if (!expected.has(file)) issues.push(`${installed}: unexpected installed file ${file}`);
  }
  for (const file of sourceFiles) if (await exists(join(installed, file))) {
    const [a, b] = await Promise.all([readFile(join(source, file), 'utf8'), readFile(join(installed, file), 'utf8')]);
    if (a !== b) issues.push(`${file}: installed content differs from source`);
  }
  return issues;
}

export { filesUnder, parseFrontmatter };
