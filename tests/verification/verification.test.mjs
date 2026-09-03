import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DEFAULT_ROOT, checkCleanliness, checkCatalogAndSkills, checkDocumentation,
  checkMetadata, checkNodeSyntax, compareDirectories, loadCatalog, verifyFast,
} from '../../scripts/verification/index.mjs';
import { runSandbox } from '../../scripts/verification/verify-sandbox.mjs';

test('the repository passes fast verification', async () => {
  const result = await verifyFast(DEFAULT_ROOT);
  assert.deepEqual(result.issues, []);
  assert.equal(result.catalog.skills.length, 13);
});

test('maintainer implementation guidance requires a fresh non-main workspace', async () => {
  const skill = await readFile(join(DEFAULT_ROOT, '.agents/skills/maintain-wstack/SKILL.md'), 'utf8');
  assert.match(skill, /Fetch `origin\/main`/);
  assert.match(skill, /create a focused branch or isolated worktree/);
  assert.match(skill, /Never implement directly on `main`/);
  assert.match(skill, /unless the user explicitly accepts the limitation/);
  assert.match(skill, /confirming their provenance and intended scope/);
  assert.match(skill, /Do not discard, rebase, or overwrite existing work without authorization/);
});

test('full deterministic checks include syntax and metadata', async () => {
  assert.deepEqual(await checkNodeSyntax(DEFAULT_ROOT), []);
  assert.deepEqual(await checkMetadata(DEFAULT_ROOT, await loadCatalog()), []);
});

test('cleanliness rejects forbidden checkout artifacts and unknown installed skills', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-verification-'));
  try {
    await mkdir(join(root, '.agents', 'skills', 'not-allowed'), { recursive: true });
    await writeFile(join(root, 'skills-lock.json'), '{}');
    const issues = await checkCleanliness(root);
    assert.equal(issues.length, 2);
    assert.match(issues.join('\n'), /skills-lock\.json/);
    assert.match(issues.join('\n'), /not-allowed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('catalog and documentation checks report missing source surfaces', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-verification-'));
  try {
    const catalog = await loadCatalog();
    assert.ok((await checkCatalogAndSkills(root, catalog)).some(issue => issue.includes('skills directory')));
    assert.ok((await checkDocumentation(root, catalog)).some(issue => issue.includes('public catalog documentation')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('directory comparison detects content drift without changing either side', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-verification-'));
  try {
    const source = join(root, 'source'), installed = join(root, 'installed');
    await mkdir(source, { recursive: true });
    await mkdir(installed, { recursive: true });
    await writeFile(join(source, 'SKILL.md'), 'source\n');
    await writeFile(join(installed, 'SKILL.md'), 'installed\n');
    const issues = await compareDirectories(source, installed);
    assert.ok(issues.some(issue => issue.includes('content differs')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('sandbox compares a local install and cleans only after success', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'wstack-verification-'));
  const helper = join(temp, 'fake-skills-cli.mjs');
  await writeFile(helper, [
    "import { cp, readdir } from 'node:fs/promises';",
    "import { join } from 'node:path';",
    "const [source, agentDir, mode] = process.argv.slice(2);",
    "if (mode === 'fail') process.exit(7);",
    "for (const entry of await readdir(join(source, 'skills'), { withFileTypes: true })) if (entry.isDirectory()) await cp(join(source, 'skills', entry.name), join(agentDir, entry.name), { recursive: true });",
  ].join('\n'));
  try {
    const result = await runSandbox({ cliCommand: ['node', helper, '{source}', '{agentDir}'] });
    assert.equal(result.ok, true);
    assert.equal(result.cleaned, true);
    await assert.rejects(
      runSandbox({ cliCommand: ['node', helper, '{source}', '{agentDir}', 'fail'] }),
      error => error.issues.some(issue => issue.startsWith('sandbox preserved at ')),
    );
  } finally { await rm(temp, { recursive: true, force: true }); }
});
