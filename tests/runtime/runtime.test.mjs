import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Workspace, WstackError, digest } from '../../skills/setup-wstack/scripts/runtime/core.mjs';

async function fixture(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'wstack-runtime-'));
  const ws = new Workspace(root);
  await ws.init(options);
  await ws.createRun({ id: 'run-1', outcome: 'Prove the runtime behavior under test', workflow: 'feature', tier: options.tier || 'structured', acceptance: options.acceptance || [] });
  return { root, ws, async close() { await rm(root, { recursive: true, force: true }); } };
}
async function rejectsCode(promise, code) { await assert.rejects(promise, e => e instanceof WstackError && e.code === code); }
function criterion(id, options = {}) { return { id, predicate: `${id} is observable`, surface: `surface/${id}`, evidenceClass: 'deterministic', criticality: 'required', ...options }; }
function grounding() { return { facts: [{ claim: 'Repository behavior was inspected', source: 'test fixture' }], assumptions: [], decisions: [{ id: 'D-1', choice: 'Use the fixture contract', reason: 'It isolates the behavior', source: 'test' }], unresolved: [] }; }
function task(id, options = {}) { return { id, goal: `Complete ${id}`, dependsOn: [], acceptanceIds: [], resources: [`work/${id}`], verification: { command: 'test' }, retryBudget: 2, ...options }; }
function receiptData(options = {}) { return {
  id: `receipt-${Date.now()}-${Math.random()}`, domain: 'engineering', acceptanceIds: [], result: 'pass', evidenceClass: 'deterministic',
  surface: 'internal/test', artifactDigests: [], taskGraphDigest: 'no-task-graph', commitDigest: 'h', verifierId: 'worker-verifier', verifierDigest: 'verifier-v1',
  procedureDigest: 'procedure-v1', environmentId: 'local', environmentDigest: 'environment-v1', producerId: 'worker', subjectId: 'worker',
  independenceClass: 'self', verifierStatus: 'unit-test-verified',
  evidenceManifests: [{ digest: digest('evidence'), mediaType: 'text/plain', availability: 'available', storage: 'inline', content: 'evidence' }], ...options,
}; }
function reviewData(axis, artifactDigest, options = {}) { return { axis, result: 'pass', artifactDigests: [artifactDigest], commitDigest: 'h', reviewerId: 'reviewer', subjectId: 'worker', reviewerModelFamily: 'test-family', independenceClass: 'independent', ...options }; }
async function specifyFeature(ws) {
  const groundingArtifact = await ws.acceptArtifact('run-1', { type: 'grounding', artifactId: 'main', content: grounding() });
  await ws.transition('run-1', 'GROUNDED');
  const acceptance = (await ws.status('run-1')).acceptance;
  const spec = await ws.acceptArtifact('run-1', { type: 'spec', artifactId: 'main', content: { outcome: 'done', acceptance, approvalSource: 'explicit' } });
  await ws.approveArtifact('run-1', { type: 'spec', artifactId: 'main', digest: spec.digest, approver: 'test-user' });
  await ws.transition('run-1', 'SPECIFIED');
  return { grounding: groundingArtifact, spec };
}
async function prepareFeature(ws, acceptanceIds = []) {
  const artifacts = await specifyFeature(ws);
  await ws.setTasks('run-1', [task('t', { acceptanceIds })]);
  await ws.setBinding('run-1', 'base', null, 'base-1');
  await ws.transition('run-1', 'PLANNED');
  return artifacts;
}
async function receipt(ws, options = {}) { return ws.receipt('run-1', await receiptFor(ws, options)); }
async function receiptFor(ws, options = {}) {
  const state = await ws.status('run-1');
  const acceptanceIds = options.acceptanceIds || [];
  const first = state.acceptance.find(item => acceptanceIds.includes(item.id));
  const contract = ws.currentContractDigest(state);
  return receiptData({
    taskId: options.taskId, acceptanceIds, evidenceClass: options.evidenceClass || first?.evidenceClass || 'deterministic',
    surface: options.surface || first?.surface || 'internal/test', artifactDigests: contract ? [contract] : [],
    taskGraphDigest: state.taskGraph?.digest || 'no-task-graph',
    environmentId: options.environmentId || 'local', producerId: options.producerId || 'worker', subjectId: options.subjectId || 'worker', ...options,
  });
}
async function taskEvidence(ws, taskId, acceptanceIds = [], evidenceClass = 'deterministic', owner = 'worker', environmentId = 'local') { return receipt(ws, { taskId, acceptanceIds, evidenceClass, producerId: owner, subjectId: owner, environmentId }); }

test('setup and run classification are durable', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-setup-')); t.after(() => rm(root, { recursive: true, force: true }));
  const ws = new Workspace(root);
  await ws.init({ deterministicCommands: { test: { argv: ['npm', 'test'], mode: 'read-only' } } });
  const setupRecords = (await readdir(join(root, '.wstack', 'migrations'))).filter(name => name.startsWith('setup-'));
  assert.equal(setupRecords.length, 1);
  const setup = JSON.parse(await readFile(join(root, '.wstack', 'migrations', setupRecords[0]), 'utf8'));
  assert.equal(setup.validation, 'pass');
  const policy = JSON.parse(await readFile(join(root, '.wstack', 'state-policy.json'), 'utf8'));
  assert.equal(policy.committed.includes('decisions/**'), true);
  assert.equal(policy.committed.includes('verifiers/**'), true);
  await ws.createRun({ id: 'classified', outcome: 'record rigor choice', workflow: 'feature', tier: 'structured', classification: { factors: ['cross-cutting'], override: { from: 'program', reason: 'single owner' } } });
  const status = await ws.status('classified');
  assert.deepEqual(status.classification, { factors: ['cross-cutting'], override: { from: 'program', reason: 'single owner' } });
});

test('DAG validation rejects cycles and derives deterministic frontier', async t => {
  const f = await fixture(); t.after(f.close);
  await specifyFeature(f.ws);
  await rejectsCode(f.ws.setTasks('run-1', [task('a', { dependsOn: ['b'] }), task('b', { dependsOn: ['a'] })]), 'CYCLE');
  await f.ws.setTasks('run-1', [task('b', { dependsOn: ['a'] }), task('a'), task('c')]);
  await f.ws.setBinding('run-1', 'base', null, 'base-1');
  await f.ws.transition('run-1', 'PLANNED');
  const planned = await f.ws.status('run-1');
  assert.deepEqual(planned.frontier, ['a', 'c']);
  assert.deepEqual(planned.graph.criticalPath, ['a', 'b']);
  await f.ws.claim('run-1', { taskId: 'a', owner: 'worker', environmentId: 'local' });
  await f.ws.transition('run-1', 'ASSIGNED');
  await taskEvidence(f.ws, 'a');
  await f.ws.completeTask('run-1', 'a', 'worker');
  assert.deepEqual((await f.ws.status('run-1')).frontier, ['b', 'c']);
});

test('filesystem-backed identifiers and writable resources reject traversal', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-safe-path-')); t.after(() => rm(root, { recursive: true, force: true }));
  const ws = new Workspace(root); await ws.init();
  await rejectsCode(ws.createRun({ id: '../../escape', outcome: 'unsafe', workflow: 'feature', tier: 'structured' }), 'INVALID_ID');
  await ws.createRun({ id: 'safe', outcome: 'safe', workflow: 'feature', tier: 'structured' });
  await rejectsCode(ws.acceptArtifact('safe', { type: 'grounding', artifactId: '../escape', content: grounding() }), 'INVALID_ARTIFACT');
});

test('task graph rejects uncovered acceptance and missing writable resources', async t => {
  const f = await fixture({ acceptance: [criterion('ac')] }); t.after(f.close);
  await specifyFeature(f.ws);
  await rejectsCode(f.ws.setTasks('run-1', [{ id: 't', dependsOn: [], acceptanceIds: ['ac'], resources: [] }]), 'INVALID_DAG');
  await rejectsCode(f.ws.setTasks('run-1', [task('t')]), 'INVALID_DAG');
  await rejectsCode(f.ws.setTasks('run-1', [task('t', { acceptanceIds: ['unknown'] })]), 'INVALID_DAG');
});

test('workflow transitions require grounded artifacts and tier-correct approval', async t => {
  const f = await fixture(); t.after(f.close);
  await rejectsCode(f.ws.transition('run-1', 'GROUNDED'), 'MISSING_ARTIFACT');
  await f.ws.acceptArtifact('run-1', { type: 'grounding', artifactId: 'g', content: grounding() });
  await f.ws.transition('run-1', 'GROUNDED');
  await f.ws.acceptArtifact('run-1', { type: 'spec', artifactId: 's', content: { outcome: 'done', acceptance: [], approvalSource: 'request' } });
  await rejectsCode(f.ws.transition('run-1', 'SPECIFIED'), 'APPROVAL_REQUIRED');
  const explicit = await f.ws.acceptArtifact('run-1', { type: 'spec', artifactId: 's', content: { outcome: 'done', acceptance: [], approvalSource: 'explicit' } });
  await rejectsCode(f.ws.transition('run-1', 'SPECIFIED'), 'APPROVAL_REQUIRED');
  await f.ws.approveArtifact('run-1', { type: 'spec', artifactId: 's', digest: explicit.digest, approver: 'test-user' });
  assert.equal((await f.ws.transition('run-1', 'SPECIFIED')).lifecycle, 'SPECIFIED');
});

test('lightweight task-graph skips are explicit events and structured skips are rejected', async t => {
  const light = await fixture({ tier: 'lightweight' }); t.after(light.close);
  await light.ws.acceptArtifact('run-1', { type: 'grounding', artifactId: 'g', content: grounding() });
  await light.ws.transition('run-1', 'GROUNDED');
  await light.ws.acceptArtifact('run-1', { type: 'spec', artifactId: 's', content: { outcome: 'done', acceptance: [], approvalSource: 'request' } });
  await light.ws.transition('run-1', 'SPECIFIED');
  const planned = await light.ws.transition('run-1', 'PLANNED', 'transition:PLANNED', { skipReason: 'one owner and one localized reversible change' });
  assert.equal(planned.skips.PLANNED.includes('localized'), true);

  const structured = await fixture(); t.after(structured.close);
  await specifyFeature(structured.ws);
  await rejectsCode(structured.ws.transition('run-1', 'PLANNED', 'transition:PLANNED', { skipReason: 'too large' }), 'MISSING_TASK_GRAPH');
});

test('duplicate events are idempotent and conflicting reuse is rejected', async t => {
  const f = await fixture(); t.after(f.close);
  const event = { type: 'gate.set', key: 'approval', data: { id: 'approval', reason: 'wait' } };
  assert.equal((await f.ws.appendEvent('run-1', event)).duplicate, false);
  assert.equal((await f.ws.appendEvent('run-1', event)).duplicate, true);
  await rejectsCode(f.ws.appendEvent('run-1', { ...event, data: { id: 'approval', reason: 'different' } }), 'IDEMPOTENCY_CONFLICT');
  assert.equal((await f.ws.events('run-1')).filter(e => e.key === 'approval').length, 1);
});

test('event hash chain detects tampering before replay', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.setGate('run-1', 'approval', 'wait');
  const path = f.ws.eventsPath('run-1');
  const events = (await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse);
  events[0].data.workflow = 'bug';
  await writeFile(path, `${events.map(JSON.stringify).join('\n')}\n`);
  await rejectsCode(f.ws.status('run-1'), 'CORRUPT_LOG');
});

test('derived state survives loss of all generated views (crash replay)', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.setGate('run-1', 'human', 'approval required');
  await f.ws.pause('run-1');
  await rm(join(f.ws.runDir('run-1'), 'views'), { recursive: true, force: true });
  const state = await new Workspace(f.root).status('run-1');
  assert.equal(state.paused, true);
  assert.equal(state.gates.human.reason, 'approval required');
  assert.equal((await stat(join(f.ws.runDir('run-1'), 'views', 'status.json'))).isFile(), true);
  await f.ws.handoff('run-1');
  const handoff = JSON.parse(await readFile(join(f.ws.runDir('run-1'), 'views', 'handoff.json'), 'utf8'));
  assert.equal(handoff.nextAction, 'resume the run');
  assert.equal(handoff.gates.human.reason, 'approval required');
});

test('legacy runs derive a missing framed outcome from the accepted specification', async t => {
  const f = await fixture(); t.after(f.close); await specifyFeature(f.ws);
  const events = await f.ws.events('run-1');
  delete events[0].data.outcome;
  const replayed = f.ws.replay(events);
  replayed.outcome = replayed.outcome || Object.values(replayed.artifacts.spec || {})[0]?.content?.outcome || null;
  assert.equal(replayed.outcome, 'done');
});

test('artifact revisions are immutable and stale receipts after revision', async t => {
  const f = await fixture({ acceptance: [criterion('ac-1')] }); t.after(f.close);
  const { spec: a1 } = await specifyFeature(f.ws);
  await f.ws.setTasks('run-1', [task('t', { acceptanceIds: ['ac-1'] })]);
  await f.ws.setBinding('run-1', 'commit', null, 'head-1');
  await f.ws.setBinding('run-1', 'verifier', 'v', 'verifier-1');
  await receipt(f.ws, { id: 'r1', acceptanceIds: ['ac-1'], artifactDigests: [a1.digest], commitDigest: 'head-1', verifierId: 'v', verifierDigest: 'verifier-1' });
  assert.equal((await f.ws.status('run-1')).receiptFreshness.r1.fresh, true);
  const a2 = await f.ws.acceptArtifact('run-1', { type: 'spec', artifactId: 'main', content: { outcome: 'two', acceptance: [criterion('ac-1')], approvalSource: 'explicit' } });
  const state = await f.ws.status('run-1');
  assert.equal(a2.revision, 2);
  assert.equal(state.tasks.t.status, 'stale');
  assert.equal(state.receiptFreshness.r1.fresh, false);
  assert.deepEqual(state.receiptFreshness.r1.reasons, [`artifact:${a1.digest}`]);
  const stored = JSON.parse(await readFile(join(f.ws.runDir('run-1'), 'artifacts', 'spec', 'main', '1.json'), 'utf8'));
  assert.equal(stored.digest, a1.digest);
});

test('task graph revisions are immutable, spec-bound, and stale prior receipts', async t => {
  const f = await fixture(); t.after(f.close);
  await specifyFeature(f.ws);
  const first = await f.ws.setTasks('run-1', [task('t')]);
  await receipt(f.ws, { id: 'graph-proof' });
  const second = await f.ws.setTasks('run-1', [task('t', { goal: 'Revised goal' })]);
  assert.equal(second.taskGraph.revision, 2);
  assert.equal(second.taskGraph.parentDigest, first.taskGraph.digest);
  assert.deepEqual(second.receiptFreshness['graph-proof'].reasons, ['task-graph']);
  await rejectsCode(f.ws.setTasks('run-1', [task('t', { specDigest: 'stale' })]), 'STALE_CONTRACT');
});

test('commit, verifier, procedure and environment changes invalidate bound receipts', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.setBinding('run-1', 'commit', null, 'head-1');
  await f.ws.setBinding('run-1', 'verifier', 'default', 'v1');
  await f.ws.setBinding('run-1', 'procedure', 'default', 'p1');
  await f.ws.setBinding('run-1', 'environment', 'local', 'e1');
  await receipt(f.ws, { id: 'r', acceptanceIds: [], evidenceClass: 'matching-surface', commitDigest: 'head-1', verifierId: 'default', verifierDigest: 'v1', procedureDigest: 'p1', environmentDigest: 'e1' });
  assert.equal((await f.ws.status('run-1')).receiptFreshness.r.fresh, true);
  await f.ws.setBinding('run-1', 'commit', null, 'head-2');
  await f.ws.setBinding('run-1', 'verifier', 'default', 'v2');
  await f.ws.setBinding('run-1', 'procedure', 'default', 'p2');
  await f.ws.setBinding('run-1', 'environment', 'local', 'e2');
  assert.deepEqual((await f.ws.status('run-1')).receiptFreshness.r.reasons.sort(), ['commit', 'environment', 'procedure', 'verifier']);
});

test('matching-surface evidence requires current verifier and procedure bindings', async t => {
  const f = await fixture(); t.after(f.close);
  await receipt(f.ws, { id: 'surface-proof', evidenceClass: 'matching-surface' });
  assert.deepEqual((await f.ws.status('run-1')).receiptFreshness['surface-proof'].reasons.sort(), ['procedure-binding-missing', 'verifier-binding-missing']);
  await f.ws.setBinding('run-1', 'verifier', 'worker-verifier', 'verifier-v1');
  await f.ws.setBinding('run-1', 'procedure', 'worker-verifier', 'procedure-v1');
  assert.equal((await f.ws.status('run-1')).receiptFreshness['surface-proof'].fresh, true);
});

test('probabilistic evidence never satisfies a deterministic engineering claim', async t => {
  const f = await fixture({ acceptance: [criterion('ac')] }); t.after(f.close);
  await prepareFeature(f.ws, ['ac']);
  await f.ws.claim('run-1', { taskId: 't', owner: 'worker', environmentId: 'local' });
  await taskEvidence(f.ws, 't', ['ac'], 'probabilistic');
  await rejectsCode(f.ws.completeTask('run-1', 't', 'worker'), 'EVIDENCE_REQUIRED');
});

test('exclusive claims reject same task and overlapping path trees', async t => {
  const f = await fixture(); t.after(f.close);
  await specifyFeature(f.ws);
  await f.ws.setTasks('run-1', [task('a', { resources: ['src/app'] }), task('b', { resources: ['src/app/file.js'] }), task('c', { resources: ['tests'] })]);
  await f.ws.setBinding('run-1', 'base', null, 'base-1');
  await f.ws.transition('run-1', 'PLANNED');
  assert.deepEqual((await f.ws.status('run-1')).graph.parallelResourceConflicts[0].tasks, ['a', 'b']);
  await f.ws.claim('run-1', { taskId: 'a', owner: 'one', environmentId: 'env-one' });
  await rejectsCode(f.ws.claim('run-1', { taskId: 'a', owner: 'two', environmentId: 'env-two' }), 'TASK_CLAIMED');
  await rejectsCode(f.ws.claim('run-1', { taskId: 'b', owner: 'two', environmentId: 'env-two' }), 'RESOURCE_CONFLICT');
  await rejectsCode(f.ws.claim('run-1', { taskId: 'c', owner: 'three', environmentId: 'env-three', resources: [] }), 'RESOURCE_MISMATCH');
  const claim = await f.ws.claim('run-1', { taskId: 'c', owner: 'three', environmentId: 'env-three' });
  assert.equal(claim.owner, 'three');
});

test('released claims can be reacquired with a new immutable attempt identity', async t => {
  const f = await fixture(); t.after(f.close); await prepareFeature(f.ws);
  const first = await f.ws.claim('run-1', { taskId: 't', owner: 'worker', environmentId: 'local' });
  await f.ws.releaseClaim('run-1', 't', 'worker');
  const second = await f.ws.claim('run-1', { taskId: 't', owner: 'worker', environmentId: 'local' });
  assert.equal(first.attempt, 1); assert.equal(second.attempt, 2);
  assert.equal((await f.ws.status('run-1')).claims.t.attempt, 2);
});

test('coordinator lease prevents split brain and records explicit takeover', async t => {
  const f = await fixture(); t.after(f.close);
  await f.ws.coordinator('run-1', { owner: 'one', ttlMs: 60000, key: 'coord:one' });
  await rejectsCode(f.ws.coordinator('run-1', { owner: 'two', takeover: true, key: 'coord:two-early' }), 'LEASE_ACTIVE');
  await f.ws.appendEvent('run-1', { type: 'coordinator.acquired', key: 'coord:expired', data: { owner: 'old', acquiredAt: '2000-01-01T00:00:00Z', expiresAt: '2000-01-01T00:00:01Z' } });
  await rejectsCode(f.ws.coordinator('run-1', { owner: 'two', key: 'coord:two-no-takeover' }), 'TAKEOVER_REQUIRED');
  const lease = await f.ws.coordinator('run-1', { owner: 'two', takeover: true, key: 'coord:two' });
  assert.equal(lease.takeoverFrom, 'old');
});

test('program claims require a live canonical coordinator', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-program-')); t.after(() => rm(root, { recursive: true, force: true }));
  const ws = new Workspace(root); await ws.init();
  await ws.createRun({ id: 'program', outcome: 'Coordinate a program', workflow: 'feature', tier: 'program', acceptance: [] });
  await ws.acceptArtifact('program', { type: 'grounding', artifactId: 'main', content: grounding() }); await ws.transition('program', 'GROUNDED');
  const spec = await ws.acceptArtifact('program', { type: 'spec', artifactId: 'main', content: { outcome: 'done', acceptance: [], approvalSource: 'explicit' } });
  await ws.approveArtifact('program', { type: 'spec', artifactId: 'main', digest: spec.digest, approver: 'test-user' }); await ws.transition('program', 'SPECIFIED');
  await ws.setTasks('program', [task('t')]); await ws.setBinding('program', 'base', null, 'base'); await ws.transition('program', 'PLANNED');
  await rejectsCode(ws.claim('program', { taskId: 't', owner: 'worker', environmentId: 'local' }), 'COORDINATOR_REQUIRED');
  await ws.coordinator('program', { owner: 'root', ttlMs: 60000, key: 'program:coordinator' });
  assert.equal((await ws.claim('program', { taskId: 't', owner: 'worker', environmentId: 'local' })).owner, 'worker');
});

test('blocked verifier never covers acceptance or permits terminal delivery', async t => {
  const f = await fixture({ acceptance: [criterion('ac')] }); t.after(f.close);
  await prepareFeature(f.ws, ['ac']);
  await f.ws.claim('run-1', { taskId: 't', owner: 'w', environmentId: 'local' });
  await f.ws.transition('run-1', 'ASSIGNED');
  await taskEvidence(f.ws, 't', ['ac'], 'deterministic', 'w'); await f.ws.completeTask('run-1', 't', 'w');
  await receipt(f.ws, { id: 'blocked', acceptanceIds: ['ac'], result: 'blocked', verifierStatus: 'verifier-blocked', producerId: 'judge', independenceClass: 'independent' });
  await f.ws.setPredicate('run-1', true, 'checked');
  await f.ws.setBinding('run-1', 'commit', null, 'head-1');
  await f.ws.transition('run-1', 'IMPLEMENTED');
  await rejectsCode(f.ws.transition('run-1', 'VERIFIED'), 'MISSING_EVIDENCE');
  const eligibility = (await f.ws.status('run-1')).eligibility;
  assert.equal(eligibility.eligible, false);
  assert.deepEqual(eligibility.missingAcceptance, ['ac']);
});

test('terminal eligibility requires reviewed lifecycle, tasks, predicate, fresh strength and independent verifier', async t => {
  const f = await fixture({ acceptance: [criterion('ac', { evidenceClass: 'matching-surface' })] }); t.after(f.close);
  const { spec: artifact } = await prepareFeature(f.ws, ['ac']);
  await f.ws.setBinding('run-1', 'verifier', 'worker-verifier', 'verifier-v1');
  await f.ws.setBinding('run-1', 'procedure', 'worker-verifier', 'procedure-v1');
  await f.ws.claim('run-1', { taskId: 't', owner: 'worker', environmentId: 'local' });
  await f.ws.transition('run-1', 'ASSIGNED');
  await taskEvidence(f.ws, 't', ['ac'], 'matching-surface'); await f.ws.completeTask('run-1', 't', 'worker');
  await f.ws.setBinding('run-1', 'commit', null, 'h');
  await f.ws.setPredicate('run-1', true, 'acceptance evaluated');
  await receipt(f.ws, { id: 'weak', acceptanceIds: ['ac'], evidenceClass: 'deterministic', artifactDigests: [artifact.digest], producerId: 'judge', independenceClass: 'independent' });
  await f.ws.transition('run-1', 'IMPLEMENTED');
  await rejectsCode(f.ws.transition('run-1', 'VERIFIED'), 'MISSING_EVIDENCE');
  assert.equal((await f.ws.status('run-1')).eligibility.eligible, false);
  await receipt(f.ws, { id: 'self', acceptanceIds: ['ac'], evidenceClass: 'matching-surface', artifactDigests: [artifact.digest], producerId: 'worker', independenceClass: 'self' });
  assert.equal((await f.ws.status('run-1')).eligibility.eligible, false);
  await receipt(f.ws, { id: 'good', acceptanceIds: ['ac'], evidenceClass: 'matching-surface', artifactDigests: [artifact.digest], producerId: 'judge', independenceClass: 'independent', verifierStatus: 'live-ui-verified' });
  await f.ws.transition('run-1', 'VERIFIED');
  await rejectsCode(f.ws.transition('run-1', 'REVIEWED'), 'MISSING_REVIEWS');
  await f.ws.review('run-1', reviewData('spec-fidelity', artifact.digest));
  await f.ws.review('run-1', reviewData('repository-standards', artifact.digest));
  await f.ws.transition('run-1', 'REVIEWED');
  assert.equal((await f.ws.status('run-1')).eligibility.eligible, true);
  await f.ws.recordDelivery('run-1', { state: 'local-ready', comparisonDigest: 'h', producerId: 'coordinator' });
  const delivered = await f.ws.transition('run-1', 'DELIVERED');
  assert.equal(delivered.lifecycle, 'DELIVERED');
  assert.equal(delivered.eligibility.eligible, true);
});

test('receipt IDs are immutable and unavailable payloads are stale', async t => {
  const f = await fixture(); t.after(f.close);
  await receipt(f.ws, { id: 'fixed' });
  assert.equal((await receipt(f.ws, { id: 'fixed' })).id, 'fixed');
  await rejectsCode(receipt(f.ws, { id: 'fixed', surface: 'different' }), 'INVALID_RECEIPT');
  await receipt(f.ws, { id: 'missing-payload', evidenceManifests: [{ digest: 'x', mediaType: 'text/plain', availability: 'unavailable', storage: 'inline' }] });
  assert.deepEqual((await f.ws.status('run-1')).receiptFreshness['missing-payload'].reasons, ['payload-unavailable']);
});

test('remote projections reconcile idempotently only under scoped authority', async t => {
  const f = await fixture({ approvalKeyDigest: digest('secret') }); t.after(f.close);
  const request = await f.ws.requestProjection('run-1', { id: 'pr-1', provider: 'github', kind: 'pr.create', idempotencyKey: 'stable-pr', payload: { target: 'repo:owner/name', title: 'Change' } });
  assert.equal(request.payloadDigest.length, 64);
  const result = { id: 'pr-1', idempotencyKey: 'stable-pr', status: 'succeeded', remoteId: '42', remoteUrl: 'https://example.invalid/42' };
  await rejectsCode(f.ws.reconcileProjection('run-1', result), 'AUTHORITY_DENIED');
  await f.ws.grantAuthority('run-1', { id: 'publish-pr', capability: 'publishRemote', target: 'repo:owner/name', grantor: 'user', approvalSecret: 'secret', expiresAt: new Date(Date.now() + 60000).toISOString() });
  assert.equal((await f.ws.reconcileProjection('run-1', result)).remoteId, '42');
  assert.equal((await f.ws.status('run-1')).projections['pr-1'].status, 'succeeded');
  await rejectsCode(f.ws.reconcileProjection('run-1', { ...result, status: 'failed' }), 'PROJECTION_CONFLICT');
});

test('run authority is snapshotted and irreversible grants require an approval secret', async t => {
  const f = await fixture({ approvalKeyDigest: digest('secret') }); t.after(f.close);
  const configPath = join(f.root, '.wstack', 'config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.authorityProfiles.safe.merge = true;
  await writeFile(configPath, JSON.stringify(config));
  const state = await f.ws.status('run-1');
  assert.equal(f.ws.capabilityAllowed(state, await f.ws.config(), 'merge', 'repo:x/y'), false);
  const grant = { id: 'merge-once', capability: 'merge', target: 'repo:x/y', grantor: 'user', expiresAt: new Date(Date.now() + 60000).toISOString() };
  await rejectsCode(f.ws.grantAuthority('run-1', grant), 'AUTHORITY_DENIED');
  await f.ws.grantAuthority('run-1', { ...grant, approvalSecret: 'secret' });
  assert.equal(f.ws.capabilityAllowed(await f.ws.status('run-1'), await f.ws.config(), 'merge', 'repo:x/y'), true);
});

test('contract revision releases claims and blocks stale completion or replanning until reapproved', async t => {
  const f = await fixture(); t.after(f.close);
  await prepareFeature(f.ws);
  await f.ws.claim('run-1', { taskId: 't', owner: 'worker', environmentId: 'local' });
  const revised = await f.ws.acceptArtifact('run-1', { type: 'spec', artifactId: 'main', content: { outcome: 'revised', acceptance: [], approvalSource: 'explicit' } });
  assert.equal((await f.ws.status('run-1')).claims.t, undefined);
  await rejectsCode(f.ws.completeTask('run-1', 't', 'worker'), 'CLAIM_REQUIRED');
  await rejectsCode(f.ws.setTasks('run-1', [task('t')]), 'APPROVAL_REQUIRED');
  await f.ws.approveArtifact('run-1', { type: 'spec', artifactId: 'main', digest: revised.digest, approver: 'test-user' });
  assert.equal((await f.ws.setTasks('run-1', [task('t', { goal: 'Replanned' })])).taskGraph.revision, 2);
});

test('evidence enforces workflow domain, producer independence, and payload provenance', async t => {
  const f = await fixture({ acceptance: [criterion('ac')] }); t.after(f.close);
  await prepareFeature(f.ws, ['ac']);
  await receipt(f.ws, { id: 'wrong-domain', domain: 'product', acceptanceIds: ['ac'], producerId: 'judge', subjectId: 'worker', independenceClass: 'independent' });
  assert.deepEqual((await f.ws.status('run-1')).eligibility.missingAcceptance, ['ac']);
  await rejectsCode(receipt(f.ws, { id: 'fake-independent', producerId: 'worker', subjectId: 'worker', independenceClass: 'independent' }), 'INVALID_RECEIPT');
  await rejectsCode(receipt(f.ws, { id: 'missing-object', evidenceManifests: [{ digest: 'a'.repeat(64), mediaType: 'text/plain', availability: 'available', storage: 'object' }] }), 'INVALID_RECEIPT');
});

test('config validation rejects malformed command policy', async t => {
  const f = await fixture(); t.after(f.close);
  const configPath = join(f.root, '.wstack', 'config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.deterministicCommands.bad = { argv: ['echo'], mode: 'sometimes' };
  await writeFile(configPath, JSON.stringify(config));
  await rejectsCode(f.ws.config(), 'INVALID_CONFIG');
});

test('evaluation workflows require a current explicit promotion decision', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-evaluation-')); t.after(() => rm(root, { recursive: true, force: true }));
  const ws = new Workspace(root); await ws.init();
  await ws.createRun({ id: 'evaluation', outcome: 'Compare candidate with baseline', workflow: 'product-evaluation', tier: 'structured', acceptance: [] });
  const baseline = await ws.acceptArtifact('evaluation', { type: 'evidence-map', artifactId: 'main', content: { baseline: 'frozen', provenance: 'fixture' } });
  await ws.transition('evaluation', 'GROUNDED');
  const contract = await ws.acceptArtifact('evaluation', { type: 'evaluation-contract', artifactId: 'main', content: { outcome: 'Decide by frozen rule', acceptance: [], approvalSource: 'explicit', decisionRule: 'all checks pass' } });
  await ws.approveArtifact('evaluation', { type: 'evaluation-contract', artifactId: 'main', digest: contract.digest, approver: 'test-user' });
  await ws.transition('evaluation', 'SPECIFIED');
  await ws.setTasks('evaluation', [task('evaluate')]);
  await ws.setBinding('evaluation', 'base', null, 'base-1'); await ws.transition('evaluation', 'PLANNED');
  await ws.claim('evaluation', { taskId: 'evaluate', owner: 'worker', environmentId: 'local' }); await ws.transition('evaluation', 'ASSIGNED');
  const graph = (await ws.status('evaluation')).taskGraph.digest;
  await ws.receipt('evaluation', receiptData({ id: 'product-proof', domain: 'product', taskId: 'evaluate', artifactDigests: [contract.digest], taskGraphDigest: graph }));
  await ws.completeTask('evaluation', 'evaluate', 'worker'); await ws.setBinding('evaluation', 'commit', null, 'h');
  await ws.transition('evaluation', 'IMPLEMENTED'); await ws.transition('evaluation', 'VERIFIED');
  await ws.review('evaluation', reviewData('spec-fidelity', contract.digest)); await ws.review('evaluation', reviewData('repository-standards', contract.digest));
  await ws.transition('evaluation', 'REVIEWED');
  assert.equal((await ws.status('evaluation')).eligibility.evaluationMissing, true);
  await ws.recordEvaluation('evaluation', { verdict: 'approve', evaluatorId: 'independent-judge', contractDigest: contract.digest, baselineDigest: baseline.digest, comparisonDigest: 'h' });
  assert.equal((await ws.status('evaluation')).eligibility.eligible, true);
});

test('retry budget marks task needs-replan and never alters predicate', async t => {
  const f = await fixture(); t.after(f.close);
  await specifyFeature(f.ws);
  await f.ws.setTasks('run-1', [task('t')]);
  const predicateBefore = (await f.ws.status('run-1')).predicate;
  const first = await f.ws.retry('run-1', { taskId: 't', failureClass: 'network' });
  assert.equal(first.needsReplan, false);
  assert.equal(first.strategy, 'retry-idempotently');
  await f.ws.retry('run-1', { taskId: 't', failureClass: 'network' });
  assert.equal((await f.ws.retry('run-1', { taskId: 't', failureClass: 'network' })).needsReplan, true);
  const s = await f.ws.status('run-1');
  assert.equal(s.tasks.t.status, 'needs-replan');
  assert.equal(s.predicate, predicateBefore);
});

test('infrastructure failure activates a stop-line without retrying', async t => {
  const f = await fixture(); t.after(f.close);
  await specifyFeature(f.ws);
  await f.ws.setTasks('run-1', [task('t')]);
  const result = await f.ws.retry('run-1', { taskId: 't', failureClass: 'infrastructure' });
  assert.equal(result.needsReplan, true);
  assert.equal((await f.ws.status('run-1')).gates['stop-line:t'].reason.includes('infrastructure'), true);
});

test('completion bundles are content-addressed and imports idempotently', async t => {
  const f = await fixture(); t.after(f.close);
  await specifyFeature(f.ws);
  await f.ws.setTasks('run-1', [task('t', { resources: ['src'] })]);
  await f.ws.setBinding('run-1', 'base', null, 'base-1');
  await f.ws.transition('run-1', 'PLANNED');
  await f.ws.claim('run-1', { taskId: 't', owner: 'cloud', environmentId: 'cloud-1' });
  await f.ws.transition('run-1', 'ASSIGNED');
  const bundle = await f.ws.createBundle('run-1', { taskId: 't', environmentId: 'cloud-1', commits: ['abc'], receipts: [await receiptFor(f.ws, { id: 'bundle-proof', taskId: 't', commitDigest: 'abc', environmentId: 'cloud-1', producerId: 'cloud', subjectId: 'cloud' })] });
  assert.equal((await f.ws.importBundle('run-1', bundle)).duplicate, false);
  assert.equal((await f.ws.importBundle('run-1', bundle)).duplicate, true);
  assert.equal((await f.ws.status('run-1')).tasks.t.status, 'complete');
  await rejectsCode(f.ws.importBundle('run-1', { ...bundle, commits: ['tampered'] }), 'INVALID_BUNDLE');
});

test('task completion requires fresh evidence and bundles reject stale contracts and zombies', async t => {
  const f = await fixture(); t.after(f.close);
  await specifyFeature(f.ws);
  await f.ws.setTasks('run-1', [task('t')]);
  await f.ws.setBinding('run-1', 'base', null, 'base-1');
  await f.ws.transition('run-1', 'PLANNED');
  await f.ws.claim('run-1', { taskId: 't', owner: 'cloud', environmentId: 'cloud-a', ttlMs: 60000 });
  await rejectsCode(f.ws.completeTask('run-1', 't', 'cloud'), 'EVIDENCE_REQUIRED');
  const bundle = await f.ws.createBundle('run-1', { taskId: 't', environmentId: 'cloud-a', receipts: [await receiptFor(f.ws, { id: 'proof', taskId: 't', commitDigest: 'base-1', environmentId: 'cloud-a', producerId: 'cloud', subjectId: 'cloud' })] });
  const body = { ...bundle }; delete body.digest; body.resources = ['wrong']; body.digest = digest(body);
  await rejectsCode(f.ws.importBundle('run-1', body), 'STALE_CONTRACT');
  const active = (await f.ws.status('run-1')).claims.t;
  await f.ws.appendEvent('run-1', { type: 'claim.acquired', key: 'expired:t', data: { ...active, acquiredAt: '2000-01-01T00:00:00Z', expiresAt: '2000-01-01T00:00:01Z' } });
  await rejectsCode(f.ws.importBundle('run-1', bundle), 'ZOMBIE_BUNDLE');
  assert.equal((await f.ws.events('run-1')).some(e => e.type === 'bundle.rejected'), true);
});

test('bundle import resumes idempotently after a crash between task completion and final marker', async t => {
  const f = await fixture(); t.after(f.close);
  await specifyFeature(f.ws);
  await f.ws.setTasks('run-1', [task('t')]);
  await f.ws.setBinding('run-1', 'base', null, 'base-1');
  await f.ws.transition('run-1', 'PLANNED');
  const claim = await f.ws.claim('run-1', { taskId: 't', owner: 'cloud', environmentId: 'cloud-a' });
  await f.ws.transition('run-1', 'ASSIGNED');
  const proof = await receiptFor(f.ws, { id: 'crash-proof', taskId: 't', commitDigest: 'base-1', environmentId: 'cloud-a', producerId: 'cloud', subjectId: 'cloud' });
  const bundle = await f.ws.createBundle('run-1', { taskId: 't', environmentId: 'cloud-a', receipts: [proof] });
  await f.ws.appendEvent('run-1', { type: 'bundle.import.started', key: `bundle:${bundle.digest}:started`, data: { digest: bundle.digest, taskId: 't', claim, bundle } });
  await f.ws.receipt('run-1', proof);
  await f.ws.completeTask('run-1', 't', 'cloud', `bundle:${bundle.digest}:complete`);
  assert.equal((await f.ws.status('run-1')).claims.t, undefined);
  assert.equal((await f.ws.importBundle('run-1', bundle)).duplicate, false);
  assert.equal((await f.ws.importBundle('run-1', bundle)).duplicate, true);
});

test('only allowlisted deterministic commands run under authority policy', async t => {
  const f = await fixture({ deterministicCommands: { probe: { argv: [process.execPath, '-e', 'process.stdout.write("ok")'] } } }); t.after(f.close);
  const result = await f.ws.execute('run-1', 'probe');
  assert.equal(result.code, 0); assert.equal(result.stdout, 'ok');
  await rejectsCode(f.ws.execute('run-1', 'anything-else'), 'COMMAND_NOT_ALLOWED');
});

test('CLI help and installer produce a self-contained project executable', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-install-')); t.after(() => rm(root, { recursive: true, force: true }));
  const runtime = join(import.meta.dirname, '../../skills/setup-wstack/scripts/runtime');
  const install = spawnSync(process.execPath, [join(runtime, 'install.mjs'), root], { encoding: 'utf8' });
  assert.equal(install.status, 0, install.stderr);
  const cli = join(root, '.wstack', 'bin', 'wstack.mjs');
  const help = spawnSync(process.execPath, [cli, 'help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr); assert.match(help.stdout, /bundle-import/);
  assert.equal((await stat(join(root, '.wstack', 'bin', 'runtime.json'))).isFile(), true);
  assert.equal((await stat(join(root, '.wstack', 'bin', 'schemas', 'receipt.schema.json'))).isFile(), true);
  const init = spawnSync(process.execPath, [cli, '--root', root, 'init'], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
});

test('verifier generator rejects placeholders and requires grounded repeatable journeys', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-verifier-')); t.after(() => rm(root, { recursive: true, force: true }));
  const contractPath = join(root, 'verifier-input.json');
  await writeFile(contractPath, JSON.stringify({
    project: 'demo', verifierId: 'demo-real-surface', version: '1.0.0', surfaces: ['CLI'],
    launch: { argv: ['node', 'app.mjs'], readiness: 'stdout contains ready' },
    doctor: { argv: ['node', 'doctor.mjs'] }, cleanup: { argv: ['node', 'cleanup.mjs'] },
    isolationStrategy: 'unique temporary data directory', requiredTools: ['node'], evidenceKinds: ['stdout', 'filesystem'],
    features: [{ id: 'create-item', title: 'Create item', surface: 'CLI', startingState: 'empty owned directory', actions: ['Run create command'], observableEndState: 'item is printed', sideEffects: 'one owned file', evidence: ['stdout and file digest'], cleanup: ['remove owned file'] }],
  }));
  const generator = join(import.meta.dirname, '../../skills/verify-review/scripts/create_verifier.mjs');
  const generated = spawnSync(process.execPath, [generator, root, contractPath], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  const packageRoot = join(root, '.wstack', 'verifiers', 'verify-demo', 'versions', '1.0.0');
  const manifest = JSON.parse(await readFile(join(packageRoot, 'verifier.json'), 'utf8'));
  assert.equal(manifest.verifierId, 'demo-real-surface');
  assert.equal(manifest.featureMapDigest.length, 64);
  assert.equal(manifest.procedureDigest.length, 64);
  const verifierSkill = await readFile(join(packageRoot, 'SKILL.md'), 'utf8');
  assert.match(verifierSkill, /## Launch[\s\S]*## Doctor[\s\S]*## Journey[\s\S]*## Evidence[\s\S]*## Cleanup[\s\S]*## Helpers/);
  assert.match(verifierSkill, /manifestDigest[\s\S]*procedureDigest/);
  const changed = JSON.parse(await readFile(contractPath, 'utf8'));
  changed.features[0].title = 'Changed in place';
  await writeFile(contractPath, JSON.stringify(changed));
  assert.notEqual(spawnSync(process.execPath, [generator, root, contractPath], { encoding: 'utf8' }).status, 0);
  changed.version = '2.0.0'; changed.features[0].title = 'TODO';
  await writeFile(contractPath, JSON.stringify(changed));
  assert.notEqual(spawnSync(process.execPath, [generator, root, contractPath], { encoding: 'utf8' }).status, 0);
});

test('setup discovery finds project commands and reports GitHub capability without credentials', () => {
  const discover = join(import.meta.dirname, '../../skills/setup-wstack/scripts/discover_project.mjs');
  const result = spawnSync(process.execPath, [discover, join(import.meta.dirname, '../..')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const found = JSON.parse(result.stdout);
  assert.deepEqual(found.deterministicCommands.test.argv, ['npm', 'run', 'test']);
  assert.equal(typeof found.adapters.github.available, 'boolean');
  assert.equal(found.adapters.github.authenticated, null);
});
