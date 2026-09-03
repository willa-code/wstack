import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace, WstackError } from '../../skills/setup-wstack/scripts/runtime/core.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'wstack-migration-'));
  const ws = new Workspace(root);
  await ws.init();
  await ws.createRun({ id: 'historical', outcome: 'preserve this outcome', workflow: 'feature', tier: 'lightweight' });
  await ws.setGate('historical', 'review', 'migration fixture');
  return { root, ws, close: () => rm(root, { recursive: true, force: true }) };
}

async function jsonAt(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function migrationRecords(root) {
  const names = (await readdir(join(root, '.wstack', 'migrations'))).filter(name => name.startsWith('setup-'));
  return Promise.all(names.map(async name => ({ name, value: await jsonAt(join(root, '.wstack', 'migrations', name)) })));
}

test('v2.0 history replays under v2.1 without rewriting canonical records', async t => {
  const f = await fixture();
  t.after(f.close);

  const configPath = join(f.root, '.wstack', 'config.json');
  const manifestPath = join(f.root, '.wstack', 'runs', 'historical', 'manifest.json');
  const eventsPath = join(f.root, '.wstack', 'runs', 'historical', 'events.ndjson');
  const beforeEvents = await readFile(eventsPath, 'utf8');
  const config = await jsonAt(configPath);
  config.protocolVersion = '2.0.0';
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const manifest = await jsonAt(manifestPath);
  manifest.protocolVersion = '2.0.0';
  delete manifest.createdProtocolVersion;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const historicalManifest = await readFile(manifestPath, 'utf8');
  await rm(join(f.root, '.wstack', 'runs', 'historical', 'views'), { recursive: true, force: true });
  const beforeUpgrade = await migrationRecords(f.root);

  await f.ws.init();

  assert.equal((await jsonAt(configPath)).protocolVersion, '2.1.0');
  assert.equal(await readFile(eventsPath, 'utf8'), beforeEvents);
  assert.equal(await readFile(manifestPath, 'utf8'), historicalManifest);

  const afterUpgrade = await migrationRecords(f.root);
  assert.equal(afterUpgrade.length, beforeUpgrade.length + 1);
  const upgrade = afterUpgrade.find(({ value }) => value.upgradeFrom === '2.0.0');
  assert.ok(upgrade, 'upgrade must record the source protocol');
  assert.equal(upgrade.value.protocolVersion, '2.1.0');
  assert.equal(upgrade.value.rollback.protocolVersion, '2.0.0');

  const state = await f.ws.status('historical');
  assert.equal(state.outcome, 'preserve this outcome');
  assert.equal(state.gates.review.reason, 'migration fixture');
  assert.equal(state.createdProtocolVersion, '2.0.0');
  assert.equal(state.runtimeProtocolVersion, '2.1.0');
  assert.equal(state.protocolMigrated, true);
  assert.equal((await stat(join(f.root, '.wstack', 'runs', 'historical', 'views', 'status.json'))).isFile(), true);
});

test('repeating migration is idempotent and does not create a second lineage record', async t => {
  const f = await fixture();
  t.after(f.close);
  const configPath = join(f.root, '.wstack', 'config.json');
  const manifestPath = join(f.root, '.wstack', 'runs', 'historical', 'manifest.json');
  const config = await jsonAt(configPath);
  config.protocolVersion = '2.0.0';
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const manifest = await jsonAt(manifestPath);
  manifest.protocolVersion = '2.0.0';
  delete manifest.createdProtocolVersion;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await f.ws.init();
  const once = await migrationRecords(f.root);
  const events = await readFile(join(f.root, '.wstack', 'runs', 'historical', 'events.ndjson'), 'utf8');
  await f.ws.init();
  const twice = await migrationRecords(f.root);
  assert.deepEqual(twice, once);
  assert.equal(await readFile(join(f.root, '.wstack', 'runs', 'historical', 'events.ndjson'), 'utf8'), events);
});

test('unsupported historical protocol is refused before config or migration state changes', async t => {
  const f = await fixture();
  t.after(f.close);
  const configPath = join(f.root, '.wstack', 'config.json');
  const config = await jsonAt(configPath);
  config.protocolVersion = '1.9.0';
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const beforeConfig = await readFile(configPath, 'utf8');
  const beforeMigrations = await migrationRecords(f.root);

  await assert.rejects(f.ws.init(), error => error instanceof WstackError && error.code === 'VERSION_MISMATCH');

  assert.equal(await readFile(configPath, 'utf8'), beforeConfig);
  assert.deepEqual(await migrationRecords(f.root), beforeMigrations);
});
