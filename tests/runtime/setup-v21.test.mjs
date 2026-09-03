import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = join(import.meta.dirname, '../..');
const installer = join(root, 'skills/setup-wstack/scripts/runtime/install.mjs');
const discover = join(root, 'skills/setup-wstack/scripts/discover_project.mjs');
const marker = /<!-- wstack:managed:start -->[\s\S]*?<!-- wstack:managed:end -->/g;

async function install(dir) {
  const result = spawnSync(process.execPath, [installer, dir], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('setup creates both root instruction files and reports changes', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'wstack-v21-blank-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const report = await install(dir);
  assert.deepEqual(report.instructionChanges.sort(), ['AGENTS.md', 'CLAUDE.md']);
  for (const name of ['AGENTS.md', 'CLAUDE.md']) assert.equal((await readFile(join(dir, name), 'utf8')).match(marker).length, 1);
});

test('setup creates a not-yet-existing consumer root', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'wstack-v21-parent-')); t.after(() => rm(parent, { recursive: true, force: true }));
  const dir = join(parent, 'consumer');
  const report = await install(dir);
  assert.deepEqual(report.instructionChanges.sort(), ['AGENTS.md', 'CLAUDE.md']);
  for (const name of ['AGENTS.md', 'CLAUDE.md']) assert.equal((await readFile(join(dir, name), 'utf8')).match(marker).length, 1);
});

test('installed runtime reports separate product and protocol versions', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'wstack-v21-version-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await install(dir);
  const runtime = join(dir, '.wstack/bin/wstack.mjs');
  const concise = spawnSync(process.execPath, [runtime, 'version'], { encoding: 'utf8' });
  assert.equal(concise.status, 0, concise.stderr);
  assert.equal(concise.stdout.trim(), '2.1.0');
  const verbose = spawnSync(process.execPath, [runtime, 'version', '--verbose'], { encoding: 'utf8' });
  assert.equal(verbose.status, 0, verbose.stderr);
  assert.deepEqual(JSON.parse(verbose.stdout), { productVersion: '2.1.0', protocolVersion: '2.1.0' });
});

test('setup preserves nested files, legacy text, user content, and is idempotent', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'wstack-v21-existing-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'nested'), { recursive: true });
  await writeFile(join(dir, 'AGENTS.md'), 'User heading\n\nFor substantial development or evaluation work, start in w-mode; resume any active .wstack run before creating another.\n');
  await writeFile(join(dir, 'nested', 'CLAUDE.md'), 'Nested user instruction.\n');
  const first = await install(dir);
  assert.deepEqual(first.instructionChanges.sort(), ['AGENTS.md', 'CLAUDE.md', join('nested', 'CLAUDE.md')].sort());
  const names = ['AGENTS.md', 'CLAUDE.md', join('nested', 'CLAUDE.md')];
  const before = await Promise.all(names.map(name => readFile(join(dir, name), 'utf8')));
  const second = await install(dir);
  assert.deepEqual(second.instructionChanges, []);
  const after = await Promise.all(names.map(name => readFile(join(dir, name), 'utf8')));
  assert.deepEqual(after, before);
  assert.match(after[0], /User heading/); assert.match(after[2], /Nested user instruction/);
});

test('project discovery reports supported instruction files without credentials', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'wstack-v21-discovery-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'AGENTS.md'), 'instructions');
  await mkdir(join(dir, 'x'), { recursive: true }); await writeFile(join(dir, 'x', 'CLAUDE.md'), 'instructions');
  const result = spawnSync(process.execPath, [discover, dir], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).discovered.instructionFiles, ['AGENTS.md', 'x/CLAUDE.md']);
});

test('model-invocation metadata makes setup the sole human-only skill', async () => {
  const entries = await readdir(join(root, 'skills'), { withFileTypes: true });
  for (const entry of entries.filter(item => item.isDirectory())) {
    const skill = await readFile(join(root, 'skills', entry.name, 'SKILL.md'), 'utf8');
    const humanOnly = /^disable-model-invocation:\s*true\s*$/m.test(skill);
    assert.equal(humanOnly, entry.name === 'setup-wstack', entry.name);
    const hasPolicy = await stat(join(root, 'skills', entry.name, 'agents', 'openai.yaml')).then(() => true, () => false);
    assert.equal(hasPolicy, humanOnly, entry.name);
  }
});
