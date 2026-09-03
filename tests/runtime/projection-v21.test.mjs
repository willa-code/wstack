import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { artifactDiagnostics, diffs, projectRun, redact, writeProjection } from '../../skills/setup-wstack/scripts/runtime/projection.mjs';

const snapshot = {
  id: 'run-1', outcome: 'Review a contract', workflow: 'feature', lifecycle: 'REVIEWED',
  createdProtocolVersion: '2.0.0', runtimeProtocolVersion: '2.1.0', protocolMigrated: true,
  acceptance: [{ id: 'AC-1', predicate: 'safe output', surface: 'cli', evidenceClass: 'deterministic', criticality: 'required' }],
  receiptFreshness: { r1: { fresh: true, reasons: [] }, r2: { fresh: false, reasons: ['commit'] } },
  eligibility: { eligible: false, missingAcceptance: ['AC-1'], missingReviews: ['repository-standards'] },
  artifacts: { spec: { main: { revision: 2, digest: 'current' } } },
};

const records = [
  { path: '.wstack/runs/run-1/artifacts/spec/main/1.json', value: { type: 'spec', id: 'main', revision: 1, digest: 'old', parentDigest: null, content: { outcome: 'old', acceptance: [] } } },
  { path: '.wstack/runs/run-1/artifacts/spec/main/2.json', value: { type: 'spec', id: 'main', revision: 2, digest: 'current', parentDigest: 'old', content: { outcome: 'new', acceptance: [], apiToken: 'do-not-leak', html: '<img src=x onerror=alert(1)>' } } },
  { path: '.wstack/runs/run-1/artifacts/spec/main/3.json', value: { type: 'spec', id: 'main', revision: 3, digest: 'pending', parentDigest: 'current', content: { outcome: 'pending', acceptance: [] } } },
];

test('projection provides revision diagnostics, structural diff, and semantic labels', () => {
  const diagnostics = artifactDiagnostics(records, snapshot);
  assert.equal(diagnostics.find(x => x.revision === 2).status, 'current');
  assert.equal(diagnostics.find(x => x.revision === 3).status, 'pending/unlinked');
  assert.match(JSON.stringify(diagnostics), /REDACTED/);
  const changed = diffs(records).flatMap(x => x.changes);
  assert.ok(changed.some(x => x.path === 'outcome'));
  assert.ok(changed.some(x => x.path === 'apiToken'));
});

test('HTML is self-contained, searchable, CSP-protected, and does not emit unsafe artifact markup', () => {
  const result = projectRun({ runId: 'run-1', snapshot, events: [{ eventDigest: 'head', type: 'artifact.accepted', data: { text: '<script>alert(1)</script>' } }], artifactRecords: records, sharedRecords: [], eventHeadDigest: 'head', generatedAt: '2026-01-01T00:00:00.000Z' });
  assert.match(result.explorerHtml, /Content-Security-Policy/);
  assert.match(result.explorerHtml, /Search/);
  assert.doesNotMatch(result.explorerHtml, /<img src=x onerror=/);
  assert.doesNotMatch(result.explorerHtml, /do-not-leak/);
  assert.match(result.explorerHtml, /REDACTED/);
  assert.doesNotMatch(result.explorerHtml, /https?:\/\//);
  for (const anchor of ['decision-contract', 'work', 'evidence', 'reviews', 'outcome', 'records', 'changes']) assert.match(result.explorerHtml, new RegExp(`id="${anchor}"`));
  assert.match(result.explorerHtml, /\.\.\/artifacts\/spec\/main\/2\.json/);
});

test('redaction covers credential-bearing URLs and command arguments', () => {
  const value = redact({ url: 'https://person:password@example.test/path?token=abc', argv: ['tool', '--api-key=xyz', '--password', 'hidden'], note: 'Bearer top-secret' });
  const text = JSON.stringify(value);
  for (const secret of ['password@example', 'token=abc', 'xyz', 'top-secret']) assert.doesNotMatch(text, new RegExp(secret));
  assert.match(text, /REDACTED/);
});

test('malformed scalar artifact records remain visible as diagnostics', () => {
  const diagnostics = artifactDiagnostics([{ path: '.wstack/runs/run-1/artifacts/bad.json', value: 'broken' }], snapshot);
  assert.equal(diagnostics[0].status, 'invalid/unlinked');
  assert.match(diagnostics[0].issues[0], /not an object/);
});

test('snapshot digest changes when an artifact or shared input changes', () => {
  const base = { runId: 'run-1', snapshot, events: [], artifactRecords: records, sharedRecords: [{ path: '.wstack/context/a.json', value: { value: 1 } }], generatedAt: '2026-01-01T00:00:00.000Z' };
  const first = projectRun(base).snapshotDigest;
  assert.notEqual(first, projectRun({ ...base, sharedRecords: [{ path: '.wstack/context/a.json', value: { value: 2 } }] }).snapshotDigest);
  assert.notEqual(first, projectRun({ ...base, artifactRecords: records.slice(0, 2) }).snapshotDigest);
});

test('writeProjection writes both derived files and never appends canonical events', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wstack-projection-')); t.after(() => rm(root, { recursive: true, force: true }));
  const result = await writeProjection({ root, runId: 'run-1', snapshot, events: [{ eventDigest: 'head' }], artifactRecords: records, sharedRecords: [], generatedAt: '2026-01-01T00:00:00.000Z' });
  const review = await readFile(result.reviewPath, 'utf8');
  const explorer = await readFile(result.explorerPath, 'utf8');
  assert.equal(review.startsWith('# Wstack review: run-1'), true);
  for (const heading of ['Overview', 'Decision or contract', 'Acceptance and evidence', 'Changes', 'Limitations', 'Next action']) assert.match(review, new RegExp(`^## ${heading}$`, 'm'));
  assert.match(explorer, /Derived snapshot/);
  assert.match(review, /Created under protocol: 2\.0\.0/);
  assert.match(review, /Replayed by runtime protocol: 2\.1\.0 \(migrated\)/);
  assert.match(review, new RegExp(result.snapshotDigest));
  assert.match(explorer, new RegExp(result.snapshotDigest));
});

test('generic records retain provenance and a large run projects within the bounded envelope', () => {
  const events = Array.from({ length: 2000 }, (_, index) => ({ seq: index + 1, eventDigest: `event-${index}`, type: 'worker.note', data: { index, note: `observation ${index}` } }));
  const started = performance.now();
  const result = projectRun({ runId: 'run-1', snapshot, events, artifactRecords: records, sharedRecords: [{ path: '.wstack/context/custom.json', value: { unknownShape: { useful: true } } }], generatedAt: '2026-01-01T00:00:00.000Z' });
  assert.ok(performance.now() - started < 2000, 'projection should remain bounded for 2,000 events');
  assert.ok(Buffer.byteLength(result.explorerHtml) < 5 * 1024 * 1024, '2,000-event explorer should remain below 5 MiB');
  assert.match(result.explorerHtml, /custom\.json/);
  assert.match(result.explorerHtml, /unknownShape/);
  assert.match(result.reviewMarkdown, /Snapshot digest/);
});
