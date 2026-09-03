import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Workspace, WstackError } from '../../skills/setup-wstack/scripts/runtime/core.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'wstack-v21-'));
  const ws = new Workspace(root);
  await ws.init();
  return { root, ws, close: () => rm(root, { recursive: true, force: true }) };
}

const grounding = {
  facts: [{ claim: 'market observed', source: 'primary' }], assumptions: [], decisions: [], unresolved: [],
  research: { hypotheses: [{ id: 'h1' }], evidence: [], counterevidence: [], confidence: 'moderate', stoppingRationale: 'enough' },
};
const contract = {
  decision: 'choose an option', owner: 'user', action: 'select the next product direction', timeHorizon: 'next quarter',
  reversibility: 'reversible with migration cost', hypotheses: [{ id: 'h1' }], alternatives: [{ id: 'h0' }],
  evidenceRequirements: ['primary preferred'], sourcePolicy: { decisive: 'primary when available' }, falsificationTests: ['test h1'],
  rigor: 'standard', stoppingRule: 'robust or inconclusive', terminalPredicate: 'brief recorded',
};

test('decision research rejects outcomes without supporting receipt and review IDs', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.createRun({ id: 'research', outcome: 'choose', workflow: 'decision-research', tier: 'lightweight', acceptance: [] });
  const g = await f.ws.acceptArtifact('research', { type: 'grounding', artifactId: 'main', content: grounding });
  await f.ws.transition('research', 'GROUNDED');
  const c = await f.ws.acceptArtifact('research', { type: 'research-contract', artifactId: 'main', content: contract });
  await f.ws.transition('research', 'SPECIFIED');
  await f.ws.setBinding('research', 'artifact', 'grounding/main', g.digest);
  const predicate = await f.ws.setPredicate('research', true, 'decision rule evaluated');
  await assert.rejects(f.ws.recordResearch('research', { outcome: 'decision-ready', researchContractDigest: c.digest, groundingDigest: g.digest, predicateEventDigest: predicate.predicateEventDigest, confidence: 'moderate', remainingUnknowns: [], limitations: [], stoppingRationale: 'additional evidence is unlikely to change the choice', receiptIds: [], reviewIds: [], projectionDigest: 'brief-1' }), e => e instanceof WstackError && e.code === 'INVALID_RESEARCH');
  const state = await f.ws.status('research');
  assert.equal(state.research, null);
  assert.equal(state.bindings.researchDigest, g.digest);
  assert.deepEqual(state.bindings.comparison, { kind: 'artifact', artifactType: 'grounding', artifactId: 'main', digest: g.digest });
});

test('run retirement is append-only and restorable', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.createRun({ id: 'r', outcome: 'x' });
  const eventsPath = f.ws.eventsPath('r');
  const before = await readFile(eventsPath, 'utf8');
  await f.ws.disposeRun('r', 'abandoned');
  assert.equal((await f.ws.status('r')).disposition, 'abandoned');
  await f.ws.restoreRun('r');
  assert.equal((await f.ws.status('r')).disposition, null);
  assert.equal((await readFile(eventsPath, 'utf8')).startsWith(before), true);
  assert.equal((await f.ws.events('r')).filter(event => event.type === 'run.dispositioned').length, 2);
});

test('retired runs reject mutations until restored', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.createRun({ id: 'r', outcome: 'x' });
  await f.ws.disposeRun('r', 'abandoned');
  await assert.rejects(f.ws.pause('r'), e => e instanceof WstackError && e.code === 'RUN_RETIRED');
  await f.ws.restoreRun('r');
  await f.ws.pause('r');
  assert.equal((await f.ws.status('r')).paused, true);
});

test('invalid research contract is rejected', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.createRun({ id: 'r', outcome: 'x', workflow: 'decision-research' });
  await f.ws.acceptArtifact('r', { type: 'grounding', artifactId: 'g', content: grounding });
  await f.ws.transition('r', 'GROUNDED');
  await assert.rejects(f.ws.acceptArtifact('r', { type: 'research-contract', artifactId: 'c', content: { decision: 'x' } }), e => e instanceof WstackError && e.code === 'INVALID_RESEARCH_CONTRACT');
});

test('CLI lists runs for humans and JSON consumers and generates review views', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.createRun({ id: 'visible', outcome: 'make state reviewable', tier: 'lightweight' });
  await writeFile(join(f.root, '.wstack/context/broken.json'), '{not-json');
  const cli = join(import.meta.dirname, '../../skills/setup-wstack/scripts/runtime/wstack.mjs');
  const human = spawnSync(process.execPath, [cli, '--root', f.root, 'runs'], { encoding: 'utf8' });
  assert.equal(human.status, 0, human.stderr); assert.match(human.stdout, /RUN\s+WORKFLOW/); assert.match(human.stdout, /visible/);
  const machine = spawnSync(process.execPath, [cli, '--root', f.root, 'runs', '--json'], { encoding: 'utf8' });
  assert.equal(machine.status, 0, machine.stderr); assert.equal(JSON.parse(machine.stdout)[0].active, true);
  const viewed = spawnSync(process.execPath, [cli, '--root', f.root, 'view', 'visible'], { encoding: 'utf8' });
  assert.equal(viewed.status, 0, viewed.stderr);
  assert.match(await readFile(join(f.root, '.wstack/runs/visible/views/review.md'), 'utf8'), /Snapshot digest/);
  assert.match(await readFile(join(f.root, '.wstack/runs/visible/views/explorer.html'), 'utf8'), /read-only/);
  assert.match(await readFile(join(f.root, '.wstack/runs/visible/views/explorer.html'), 'utf8'), /malformed JSON/);
});

test('new run manifests identify their creation protocol explicitly', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.createRun({ id: 'current', outcome: 'current protocol' });
  const manifest = JSON.parse(await readFile(join(f.root, '.wstack/runs/current/manifest.json'), 'utf8'));
  assert.equal(manifest.protocolVersion, '2.1.0');
  assert.equal(manifest.createdProtocolVersion, '2.1.0');
  const state = await f.ws.status('current');
  assert.equal(state.createdProtocolVersion, '2.1.0');
  assert.equal(state.runtimeProtocolVersion, '2.1.0');
  assert.equal(state.protocolMigrated, false);
});
