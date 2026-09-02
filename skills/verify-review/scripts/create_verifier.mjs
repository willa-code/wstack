#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value) { return createHash('sha256').update(canonical(value)).digest('hex'); }
function fail(message) { process.stderr.write(`INVALID_VERIFIER: ${message}\n`); process.exit(1); }
function required(value, name) { if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a non-empty string`); }
function grounded(value, name) { required(value, name); if (/\b(todo|tbd|placeholder|lorem ipsum|fill me in)\b/i.test(value)) fail(`${name} contains placeholder text`); }
function command(value, name) {
  if (!value || !Array.isArray(value.argv) || !value.argv.length || value.argv.some(item => typeof item !== 'string' || !item)) fail(`${name}.argv must be a non-empty string array`);
}
function shell(argv) { return argv.map(part => `'${part.replaceAll("'", "'\\''")}'`).join(' '); }

const root = resolve(process.argv[2] || process.cwd());
const source = process.argv[3];
if (!source) fail('usage: create_verifier.mjs PROJECT_ROOT CONFIG.json');
const config = JSON.parse(await readFile(source, 'utf8'));
for (const field of ['project', 'verifierId', 'version', 'isolationStrategy']) grounded(config[field], field);
if (!/^[a-z0-9][a-z0-9-]*$/.test(config.project)) fail('project must be a lowercase slug');
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(config.version)) fail('version must be a safe version identifier');
if (!Array.isArray(config.surfaces) || !config.surfaces.length) fail('surfaces must be non-empty');
if (!Array.isArray(config.requiredTools) || !Array.isArray(config.evidenceKinds)) fail('requiredTools and evidenceKinds must be arrays');
for (const [name, value] of Object.entries({ launch: config.launch, doctor: config.doctor, cleanup: config.cleanup })) command(value, name);
if (!Array.isArray(config.features) || config.features.length < 1) fail('at least one repository-grounded feature is required');
const featureIds = new Set();
for (const feature of config.features) {
  for (const field of ['id', 'title', 'surface', 'startingState', 'observableEndState', 'sideEffects']) grounded(feature[field], `feature.${field}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(feature.id)) fail(`feature ID ${feature.id} is not a safe lowercase slug`);
  if (featureIds.has(feature.id)) fail(`duplicate feature ID ${feature.id}`);
  featureIds.add(feature.id);
  for (const field of ['actions', 'evidence', 'cleanup']) {
    if (!Array.isArray(feature[field]) || !feature[field].length) fail(`feature.${field} must be a non-empty string array`);
    for (const item of feature[field]) grounded(item, `feature.${field}`);
  }
}

const packageRoot = join(root, '.wstack', 'verifiers', `verify-${config.project}`);
const target = join(packageRoot, 'versions', config.version);
const featuresDir = join(target, 'features');
const featureRecords = config.features.map(feature => ({ ...feature, digest: digest(feature) }));
const procedureDigests = {
  launch: digest(config.launch), doctor: digest(config.doctor), cleanup: digest(config.cleanup),
};
const featureMapDigest = digest(featureRecords);
const procedureDigest = digest({ ...procedureDigests, featureMapDigest });
const manifest = {
  schemaVersion: '1.0.0', verifierId: config.verifierId, version: config.version,
  priorVersion: config.priorVersion || null, surfaces: config.surfaces,
  featureMapDigest, procedureDigests, procedureDigest,
  requiredTools: config.requiredTools, isolationStrategy: config.isolationStrategy,
  evidenceKinds: config.evidenceKinds,
};
const manifestPath = join(target, 'verifier.json');
try {
  const existing = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (canonical(existing) !== canonical(manifest)) fail(`version ${config.version} is immutable; choose a new version`);
  await writeFile(join(packageRoot, 'current.json'), `${JSON.stringify({ version: config.version, path: `versions/${config.version}`, manifestDigest: digest(manifest) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ target, manifestDigest: digest(manifest), verifierId: manifest.verifierId, version: manifest.version, duplicate: true }, null, 2)}\n`);
  process.exit(0);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
await mkdir(featuresDir, { recursive: true });
for (const feature of featureRecords) {
  const markdown = `# ${feature.title}\n\n- ID: \`${feature.id}\`\n- Surface: ${feature.surface}\n- Starting state: ${feature.startingState}\n- Observable end state: ${feature.observableEndState}\n- Side effects: ${feature.sideEffects}\n- Procedure digest: \`${feature.digest}\`\n\n## Actions\n\n${feature.actions.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n## Evidence\n\n${feature.evidence.map(item => `- ${item}`).join('\n')}\n\n## Cleanup\n\n${feature.cleanup.map(item => `- ${item}`).join('\n')}\n`;
  await writeFile(join(featuresDir, `${feature.id}.md`), markdown);
}
const featureLinks = featureRecords.map(feature => `- [${feature.title}](features/${feature.id}.md)`).join('\n');
const skill = `---\nname: verify-${config.project}\ndescription: "Exercise ${config.project} through its real user-facing surfaces and capture acceptance evidence with owned setup and cleanup."\n---\n\n# Verify ${config.project}\n\nUse only owned instances under this verifier's isolation strategy: ${config.isolationStrategy}.\n\n## Launch\n\nRun \`${shell(config.launch.argv)}\`. Readiness: ${config.launch.readiness || 'successful command exit'}.\n\n## Doctor\n\nRun \`${shell(config.doctor.argv)}\` before every journey. Stop as blocked on failure.\n\n## Journey\n\nSelect the journey matching the accepted surface:\n\n${featureLinks}\n\n## Evidence\n\nCapture ${config.evidenceKinds.join(', ')}. Bind \`verifierDigest\` to the current pointer's \`manifestDigest\` and \`procedureDigest\` to the manifest's \`procedureDigest\`, both under verifier ID \`${config.verifierId}\`. Also bind the environment, specification, current comparison point, and selected journey evidence.\n\n## Cleanup\n\nRun \`${shell(config.cleanup.argv)}\` only for resources owned by this verifier instance. Evidence must remain readable afterward.\n\n## Helpers\n\nRequired tools: ${config.requiredTools.join(', ') || 'none beyond repository commands'}. Never substitute an unlisted surface or reuse a user's existing session.\n`;
await writeFile(join(target, 'SKILL.md'), skill);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
await mkdir(packageRoot, { recursive: true });
await writeFile(join(packageRoot, 'current.json'), `${JSON.stringify({ version: config.version, path: `versions/${config.version}`, manifestDigest: digest(manifest) }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ target, manifestDigest: digest(manifest), verifierId: manifest.verifierId, version: manifest.version }, null, 2)}\n`);
