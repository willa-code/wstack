import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, writeFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { COMPATIBLE_PROTOCOLS, PRODUCT_VERSION, PROTOCOL_VERSION } from './version.mjs';

export { PRODUCT_VERSION, PROTOCOL_VERSION };
export const LIFECYCLE = ['FRAMED', 'GROUNDED', 'SPECIFIED', 'PLANNED', 'ASSIGNED', 'IMPLEMENTED', 'VERIFIED', 'REVIEWED', 'DELIVERED'];
export const DEFAULT_AUTHORITY = {
  edit: true, branch: true, commit: true, executeCommands: true,
  push: false, publishRemote: false, merge: false, deploy: false,
  destructiveDelete: false, externalMessage: false,
};
export const AUTHORITY_PROFILES = {
  reviewOnly: { ...DEFAULT_AUTHORITY, edit: false, branch: false, commit: false, unattended: false, automaticWorkerReplacement: false, automaticTakeover: false },
  safe: { ...DEFAULT_AUTHORITY, unattended: false, automaticWorkerReplacement: false, automaticTakeover: false },
  autonomous: { ...DEFAULT_AUTHORITY, unattended: true, automaticWorkerReplacement: true, automaticTakeover: false },
  overnight: { ...DEFAULT_AUTHORITY, unattended: true, automaticWorkerReplacement: true, automaticTakeover: true },
};

const COMMITTED_STATE = [
  'bin/**', 'config.json', 'state-policy.json', 'context/**', 'decisions/**',
  'verifiers/**', 'migrations/**', 'runs/*/manifest.json',
  'runs/*/events.ndjson', 'runs/*/artifacts/**', 'runs/*/receipts/**',
  'runs/*/views/**', 'evidence/manifests/**',
];

const WORKFLOWS = new Set(['feature', 'bug', 'refactor', 'migration', 'hillclimb', 'product-evaluation', 'agent-evaluation', 'decision-research']);
const TIERS = new Set(['lightweight', 'structured', 'program']);
const EVIDENCE_CLASSES = new Set(['static', 'deterministic', 'matching-surface', 'probabilistic']);
const WORKFLOW_ARTIFACTS = {
  feature: { GROUNDED: 'grounding', SPECIFIED: 'spec' }, bug: { GROUNDED: 'diagnosis', SPECIFIED: 'spec' },
  refactor: { GROUNDED: 'grounding', SPECIFIED: 'spec' }, migration: { GROUNDED: 'grounding', SPECIFIED: 'spec' },
  hillclimb: { GROUNDED: 'baseline', SPECIFIED: 'qualification-contract' },
  'product-evaluation': { GROUNDED: 'evidence-map', SPECIFIED: 'evaluation-contract' },
  'agent-evaluation': { GROUNDED: 'baseline', SPECIFIED: 'evaluation-contract' },
  'decision-research': { GROUNDED: 'grounding', SPECIFIED: 'research-contract' },
};

export class WstackError extends Error {
  constructor(message, code = 'WSTACK_ERROR') { super(message); this.code = code; }
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function digest(value) { return createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex'); }
function byteDigest(value) { return createHash('sha256').update(value).digest('hex'); }

function requiredString(value, name, code = 'INVALID_INPUT') {
  if (typeof value !== 'string' || !value.trim()) throw new WstackError(`${name} must be a non-empty string`, code);
}
function safeId(value, name, code = 'INVALID_ID') {
  requiredString(value, name, code);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new WstackError(`${name} contains unsafe characters`, code);
  return value;
}
function safeResource(value) {
  requiredString(value, 'task resource', 'INVALID_DAG');
  if (value.startsWith('/') || value.split('/').some(part => part === '..' || part === '') || value.includes('\\')) throw new WstackError(`Unsafe task resource: ${value}`, 'INVALID_DAG');
  return value.replace(/^\.\//, '').replace(/\/$/, '');
}
function validateAcceptance(acceptance) {
  if (!Array.isArray(acceptance)) throw new WstackError('Acceptance must be an array', 'INVALID_ACCEPTANCE');
  const ids = new Set();
  for (const item of acceptance) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new WstackError('Acceptance criteria must be typed objects', 'INVALID_ACCEPTANCE');
    for (const field of ['id', 'predicate', 'surface', 'evidenceClass', 'criticality']) requiredString(item[field], `acceptance.${field}`, 'INVALID_ACCEPTANCE');
    if (ids.has(item.id)) throw new WstackError(`Duplicate acceptance ID: ${item.id}`, 'INVALID_ACCEPTANCE');
    if (!EVIDENCE_CLASSES.has(item.evidenceClass)) throw new WstackError(`Unknown evidence class: ${item.evidenceClass}`, 'INVALID_ACCEPTANCE');
    if (!['critical', 'required', 'optional'].includes(item.criticality)) throw new WstackError(`Unknown criticality: ${item.criticality}`, 'INVALID_ACCEPTANCE');
    ids.add(item.id);
  }
}
function validateResearchContract(content) {
  for (const field of ['decision', 'owner', 'action', 'timeHorizon', 'reversibility', 'rigor', 'stoppingRule', 'terminalPredicate']) requiredString(content[field], `research-contract.${field}`, 'INVALID_RESEARCH_CONTRACT');
  for (const field of ['hypotheses', 'evidenceRequirements', 'falsificationTests', 'alternatives']) if (!Array.isArray(content[field])) throw new WstackError(`research-contract.${field} must be an array`, 'INVALID_RESEARCH_CONTRACT');
  if (!content.sourcePolicy || typeof content.sourcePolicy !== 'object' || Array.isArray(content.sourcePolicy)) throw new WstackError('research-contract.sourcePolicy must be an object', 'INVALID_RESEARCH_CONTRACT');
  if (!['light', 'standard', 'intensive'].includes(content.rigor)) throw new WstackError('research-contract.rigor is invalid', 'INVALID_RESEARCH_CONTRACT');
  if (!content.hypotheses.length || !content.alternatives.length) throw new WstackError('Research contract requires hypotheses and alternatives', 'INVALID_RESEARCH_CONTRACT');
}
function validateResearchGrounding(content) {
  if (!content.research || typeof content.research !== 'object' || Array.isArray(content.research)) return;
  for (const field of ['hypotheses', 'evidence', 'counterevidence', 'unknowns']) if (content.research[field] !== undefined && !Array.isArray(content.research[field])) throw new WstackError(`grounding.research.${field} must be an array`, 'INVALID_RESEARCH');
  if (content.research.confidence !== undefined) requiredString(content.research.confidence, 'grounding.research.confidence', 'INVALID_RESEARCH');
  if (content.research.stoppingRationale !== undefined) requiredString(content.research.stoppingRationale, 'grounding.research.stoppingRationale', 'INVALID_RESEARCH');
}
function assertCompatibleProtocol(protocolVersion) {
  if (!COMPATIBLE_PROTOCOLS.has(protocolVersion)) throw new WstackError(`Protocol mismatch: ${protocolVersion}`, 'VERSION_MISMATCH');
}
function validateConfig(config) {
  assertCompatibleProtocol(config.protocolVersion);
  if (!config.authorityProfiles?.[config.defaultAuthorityProfile]) throw new WstackError('Default authority profile is missing', 'INVALID_CONFIG');
  for (const [name, profile] of Object.entries(config.authorityProfiles || {})) {
    for (const capability of Object.keys(DEFAULT_AUTHORITY)) if (typeof profile[capability] !== 'boolean') throw new WstackError(`Authority ${name}.${capability} must be boolean`, 'INVALID_CONFIG');
  }
  for (const field of ['maxWorkers', 'retryBudget', 'coordinatorLeaseMs']) if (!Number.isInteger(config.coordination?.[field]) || config.coordination[field] < (field === 'retryBudget' ? 0 : 1)) throw new WstackError(`Invalid coordination.${field}`, 'INVALID_CONFIG');
  for (const [name, command] of Object.entries(config.deterministicCommands || {})) {
    if (!Array.isArray(command.argv) || !command.argv.length || command.argv.some(item => typeof item !== 'string' || !item) || !['read-only', 'mutating'].includes(command.mode)) throw new WstackError(`Invalid deterministic command: ${name}`, 'INVALID_CONFIG');
  }
  if (!config.evidencePolicy || !config.adapters) throw new WstackError('Evidence policy and adapters are required', 'INVALID_CONFIG');
  if (config.approvalKeyDigest !== null && config.approvalKeyDigest !== undefined && !/^[a-f0-9]{64}$/.test(config.approvalKeyDigest)) throw new WstackError('approvalKeyDigest must be a SHA-256 digest or null', 'INVALID_CONFIG');
  return config;
}

async function exists(path) { try { await stat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, path);
}
async function atomicText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, value, { mode: 0o600 });
  await rename(temp, path);
}
async function structuredRecords(dir, root, { skip = new Set() } = {}) {
  if (!await exists(dir)) return [];
  const records = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (skip.has(entry.name) || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) records.push(...await structuredRecords(path, root, { skip }));
    else if (entry.name.endsWith('.json')) {
      try { records.push({ path: relative(root, path), value: await json(path) }); }
      catch (error) { records.push({ path: relative(root, path), value: { diagnostic: 'malformed JSON', error: error.message } }); }
    }
    else if (entry.name.endsWith('.ndjson')) {
      const values = (await readFile(path, 'utf8')).split('\n').filter(Boolean).map((line, index) => {
        try { return JSON.parse(line); } catch (error) { return { diagnostic: 'malformed NDJSON', line: index + 1, error: error.message }; }
      });
      records.push({ path: relative(root, path), value: values });
    }
  }
  return records;
}
async function withLock(path, fn, { staleMs = 30000 } = {}) {
  await mkdir(dirname(path), { recursive: true });
  let handle;
  try {
    handle = await open(path, 'wx', 0o600);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const age = Date.now() - (await stat(path)).mtimeMs;
    if (age <= staleMs) throw new WstackError(`Lock is active: ${path}`, 'LOCKED');
    await rm(path, { force: true });
    handle = await open(path, 'wx', 0o600);
  }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })); return await fn(); }
  finally { await handle.close(); await rm(path, { force: true }); }
}

export class Workspace {
  constructor(root = process.cwd()) { this.root = resolve(root); this.dir = join(this.root, '.wstack'); }
  runDir(id) { return join(this.dir, 'runs', safeId(id, 'run ID')); }
  eventsPath(id) { return join(this.runDir(id), 'events.ndjson'); }

  async init(options = {}) {
    const path = join(this.dir, 'config.json');
    if (await exists(path)) assertCompatibleProtocol((await json(path)).protocolVersion);
    for (const name of ['runs', 'evidence/objects', 'context', 'decisions', 'verifiers', 'migrations']) await mkdir(join(this.dir, name), { recursive: true });
    const commands = Object.fromEntries(Object.entries(options.deterministicCommands || {}).map(([name, command]) => [name, { ...command, mode: command.mode || 'mutating' }]));
    if (!await exists(path)) await atomicJson(path, {
      protocolVersion: PROTOCOL_VERSION,
      authorityProfiles: AUTHORITY_PROFILES,
      defaultAuthorityProfile: options.defaultAuthorityProfile || 'safe',
      coordination: { maxWorkers: 8, retryBudget: 2, coordinatorLeaseMs: 300000, ...(options.coordination || {}) },
      evidencePolicy: { commitManifests: true, commitSmallRedactedPayloads: true, commitRawPayloads: false, ...(options.evidencePolicy || {}) },
      adapters: { github: { available: false }, ...(options.adapters || {}) },
      deterministicCommands: commands,
      approvalKeyDigest: options.approvalKeyDigest || null,
      createdAt: new Date().toISOString(),
    });
    const ignorePath = join(this.dir, '.gitignore');
    if (!await exists(ignorePath)) await writeFile(ignorePath, `locks/\n**/locks/\nevidence/objects/\nevidence/raw/\nscratch/\nsecrets/\n*.tmp\n`);
    const policyPath = join(this.dir, 'state-policy.json');
    const defaultPolicy = { version: 1, committed: COMMITTED_STATE, environmentScoped: ['**/locks/**', 'evidence/objects/**', 'evidence/raw/**', 'scratch/**', 'secrets/**'] };
    if (!await exists(policyPath)) await atomicJson(policyPath, defaultPolicy);
    else {
      const policy = await json(policyPath);
      const updatedPolicy = { ...policy, committed: [...new Set([...(policy.committed || []), ...COMMITTED_STATE])].sort() };
      if (canonical(updatedPolicy) !== canonical(policy)) await atomicJson(policyPath, updatedPolicy);
    }
    let config = await json(path);
    const priorProtocolVersion = config.protocolVersion;
    const priorConfigDigest = digest(config);
    const migratedCommands = Object.fromEntries(Object.entries(config.deterministicCommands || {}).map(([name, command]) => [name, { ...command, mode: command.mode || 'mutating' }]));
    const mergedCommands = { ...migratedCommands, ...commands };
    const mergedAdapters = { ...config.adapters, ...(options.adapters || {}) };
    const mergedProfiles = Object.fromEntries(Object.entries(config.authorityProfiles || {}).map(([name, profile]) => [name, { ...(AUTHORITY_PROFILES[name] || {}), ...profile }]));
    const updated = { ...config, protocolVersion: PROTOCOL_VERSION, authorityProfiles: mergedProfiles, deterministicCommands: mergedCommands, adapters: mergedAdapters };
    if (options.approvalKeyDigest !== undefined) updated.approvalKeyDigest = options.approvalKeyDigest;
    if (canonical(updated) !== canonical(config)) {
      config = updated;
      await atomicJson(path, config);
    }
    const validated = validateConfig(config);
    const setupRecord = {
      schemaVersion: '1.0.0', protocolVersion: PROTOCOL_VERSION,
      configDigest: digest(validated), discoveryDigest: digest(options),
      validation: 'pass',
      upgradeFrom: priorProtocolVersion === PROTOCOL_VERSION ? null : priorProtocolVersion,
      rollback: priorProtocolVersion === PROTOCOL_VERSION ? null : { protocolVersion: priorProtocolVersion, configDigest: priorConfigDigest, method: 'restore the prior tracked runtime and config revision; canonical run history is unchanged' },
    };
    const lineageDigest = digest({ priorProtocolVersion, priorConfigDigest });
    const setupPath = join(this.dir, 'migrations', `setup-${PROTOCOL_VERSION}-${setupRecord.configDigest.slice(0, 12)}-${setupRecord.discoveryDigest.slice(0, 12)}-${lineageDigest.slice(0, 12)}.json`);
    if (!await exists(setupPath)) await atomicJson(setupPath, setupRecord);
    return validated;
  }

  async config() { return validateConfig(await json(join(this.dir, 'config.json'))); }

  async createRun({ id = randomUUID(), outcome, workflow = 'feature', tier = 'structured', authority = 'safe', exitPredicate = { type: 'acceptance-covered', description: 'Every required acceptance criterion has fresh sufficient evidence.' }, acceptance = [], riskLenses = [], classification = { factors: [], override: null } } = {}) {
    if (!await exists(join(this.dir, 'config.json'))) await this.init();
    safeId(id, 'run ID');
    if (!WORKFLOWS.has(workflow)) throw new WstackError(`Unknown workflow: ${workflow}`, 'INVALID_WORKFLOW');
    if (!TIERS.has(tier)) throw new WstackError(`Unknown tier: ${tier}`, 'INVALID_TIER');
    requiredString(outcome, 'run outcome', 'INVALID_RUN');
    validateAcceptance(acceptance);
    if (!classification || typeof classification !== 'object' || !Array.isArray(classification.factors) || classification.factors.some(item => typeof item !== 'string' || !item) || (classification.override !== null && (typeof classification.override !== 'object' || Array.isArray(classification.override)))) throw new WstackError('Run classification requires factors and an optional override', 'INVALID_RUN');
    const config = await this.config();
    if (!config.authorityProfiles?.[authority]) throw new WstackError(`Unknown authority profile: ${authority}`, 'INVALID_AUTHORITY');
    if (!exitPredicate || typeof exitPredicate !== 'object' || !exitPredicate.type || !exitPredicate.description) throw new WstackError('Exit predicate must have type and falsifiable description', 'INVALID_PREDICATE');
    if (!Array.isArray(riskLenses) || riskLenses.some(x => typeof x !== 'string' || !x)) throw new WstackError('Risk lenses must be named strings', 'INVALID_RUN');
    if (await exists(this.runDir(id))) throw new WstackError(`Run already exists: ${id}`, 'RUN_EXISTS');
    await mkdir(join(this.runDir(id), 'artifacts'), { recursive: true });
    await mkdir(join(this.runDir(id), 'receipts'), { recursive: true });
    await mkdir(join(this.runDir(id), 'views'), { recursive: true });
    await writeFile(this.eventsPath(id), '', { flag: 'wx', mode: 0o600 });
    const authorityPolicy = config.authorityProfiles[authority], authorityPolicyDigest = digest(authorityPolicy);
    await atomicJson(join(this.runDir(id), 'manifest.json'), { protocolVersion: PROTOCOL_VERSION, createdProtocolVersion: PROTOCOL_VERSION, id, outcome, workflow, tier, classification, authority, authorityPolicyDigest });
    await this.appendEvent(id, { type: 'run.created', key: `run:${id}:created`, data: { id, outcome, workflow, tier, classification, authority, authorityPolicy, authorityPolicyDigest, exitPredicate, acceptance, riskLenses } });
    return this.status(id);
  }

  async events(id) {
    const raw = await readFile(this.eventsPath(id), 'utf8');
    const events = raw.split('\n').filter(Boolean).map((line, i) => { try { return JSON.parse(line); } catch { throw new WstackError(`Corrupt event at line ${i + 1}`, 'CORRUPT_LOG'); } });
    let previous = null;
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      if (event.seq !== i + 1 || event.prevDigest !== previous) throw new WstackError(`Broken event chain at line ${i + 1}`, 'CORRUPT_LOG');
      const expected = digest({ seq: event.seq, at: event.at, type: event.type, key: event.key, data: event.data, prevDigest: event.prevDigest });
      if (event.eventDigest !== expected) throw new WstackError(`Invalid event digest at line ${i + 1}`, 'CORRUPT_LOG');
      previous = event.eventDigest;
    }
    return events;
  }

  async appendEvent(id, event) {
    if (!event.key || !event.type) throw new WstackError('Event requires type and idempotency key', 'INVALID_EVENT');
    let data;
    try { data = JSON.parse(JSON.stringify(event.data || {})); } catch { throw new WstackError('Event data must be JSON serializable', 'INVALID_EVENT'); }
    return withLock(join(this.runDir(id), 'locks', 'events.lock'), async () => {
      const prior = await this.events(id);
      const duplicate = prior.find(e => e.key === event.key);
      if (duplicate) {
        if (digest({ type: duplicate.type, data: duplicate.data }) !== digest({ type: event.type, data })) throw new WstackError(`Idempotency key conflict: ${event.key}`, 'IDEMPOTENCY_CONFLICT');
        return { duplicate: true, event: duplicate };
      }
      const current = this.replay(prior);
      if (current.disposition && event.type !== 'run.dispositioned') throw new WstackError('Retired runs are immutable; restore the run first', 'RUN_RETIRED');
      const record = { seq: prior.length + 1, at: event.at || new Date().toISOString(), type: event.type, key: event.key, data, prevDigest: prior.at(-1)?.eventDigest || null };
      record.eventDigest = digest(record);
      await atomicText(this.eventsPath(id), `${prior.map(e => JSON.stringify(e)).join('\n')}${prior.length ? '\n' : ''}${JSON.stringify(record)}\n`);
      return { duplicate: false, event: record };
    });
  }

  replay(events) {
    const state = { lifecycle: null, skips: {}, gates: {}, grants: {}, approvals: {}, paused: false, failures: [], stale: [], disposition: null, replacementRunId: null, artifacts: {}, taskGraph: null, tasks: {}, claims: {}, claimAttempts: {}, receipts: {}, reviews: {}, projections: {}, acceptance: [], riskLenses: [], retries: {}, coordinator: null, predicate: false, predicateEvidence: null, predicateEventDigest: null, delivery: null, evaluation: null, research: null, startedBundles: {}, importedBundles: [], bindings: { commitDigest: null, baseDigest: null, researchDigest: null, comparison: null, verifierDigests: {}, procedureDigests: {}, environmentDigests: {} } };
    for (const e of events) {
      const d = e.data;
      switch (e.type) {
        case 'run.created': {
          const authorityPolicy = d.authorityPolicy || AUTHORITY_PROFILES[d.authority];
          Object.assign(state, d, { authorityPolicy, authorityPolicyDigest: d.authorityPolicyDigest || digest(authorityPolicy), lifecycle: 'FRAMED', predicate: d.exitPredicate?.type === 'acceptance-covered' && d.acceptance.length === 0 });
          break;
        }
        case 'lifecycle.transitioned': state.lifecycle = d.to; if (d.skipped) state.skips[d.to] = d.skipReason; break;
        case 'gate.set': state.gates[d.id] = d; break;
        case 'gate.cleared': delete state.gates[d.id]; break;
        case 'authority.granted': state.grants[d.id] = d; break;
        case 'authority.revoked': delete state.grants[d.id]; break;
        case 'run.paused': state.paused = true; break;
        case 'run.resumed': state.paused = false; break;
        case 'failure.recorded': state.failures.push(d); break;
        case 'stale.recorded': state.stale.push(d); break;
        case 'artifact.accepted': (state.artifacts[d.type] ||= {})[d.id] = d; break;
        case 'artifact.approved': state.approvals[d.digest] = d; break;
        case 'tasks.set': state.taskGraph = { revision: (state.taskGraph?.revision || 0) + 1, digest: d.digest || digest(d.tasks), parentDigest: state.taskGraph?.digest || null }; state.tasks = Object.fromEntries(d.tasks.map(t => [t.id, { ...t, status: t.status || 'pending' }])); break;
        case 'task-graph.accepted': state.taskGraph = { revision: d.revision, digest: d.digest, parentDigest: d.parentDigest }; state.tasks = Object.fromEntries(d.tasks.map(t => [t.id, { ...t, status: t.status || 'pending' }])); break;
        case 'tasks.staled': for (const task of Object.values(state.tasks)) task.status = 'stale'; break;
        case 'task.completed': if (state.tasks[d.id]) state.tasks[d.id].status = 'complete'; break;
        case 'claim.acquired': state.claims[d.taskId] = d; state.claimAttempts[d.taskId] = Math.max(state.claimAttempts[d.taskId] || 0, d.attempt || 1); break;
        case 'claim.released': delete state.claims[d.taskId]; break;
        case 'coordinator.acquired': state.coordinator = d; break;
        case 'coordinator.released': state.coordinator = null; break;
        case 'receipt.recorded': state.receipts[d.id] = d; break;
        case 'retry.recorded': state.retries[d.taskId] = d.attempt; if (d.needsReplan && state.tasks[d.taskId]) state.tasks[d.taskId].status = 'needs-replan'; break;
        case 'predicate.set': state.predicate = d.value; state.predicateEvidence = d.evidence; state.predicateEventDigest = e.eventDigest; break;
        case 'bundle.import.started': state.startedBundles[d.digest] = d; break;
        case 'bundle.imported': state.importedBundles.push(d.digest); break;
        case 'binding.set':
          if (d.kind === 'commit') state.bindings.commitDigest = d.digest;
          else if (d.kind === 'base') state.bindings.baseDigest = d.digest;
          else if (d.kind === 'research' || d.kind === 'artifact') {
            state.bindings.researchDigest = d.digest;
            state.bindings.comparison = { kind: 'artifact', artifactType: d.artifactType || 'grounding', artifactId: d.artifactId || d.id || 'main', digest: d.digest };
          } else if (d.kind === 'verifier') state.bindings.verifierDigests[d.id] = d.digest;
          else if (d.kind === 'procedure') state.bindings.procedureDigests[d.id] = d.digest;
          else if (d.kind === 'environment') state.bindings.environmentDigests[d.id] = d.digest;
          break;
        case 'review.recorded': state.reviews[d.axis] = d; break;
        case 'evaluation.recorded': state.evaluation = d; break;
        case 'research.recorded': state.research = d; break;
        case 'delivery.recorded': state.delivery = d; break;
        case 'run.dispositioned': state.disposition = d.disposition; state.replacementRunId = d.replacementRunId || null; break;
        case 'projection.requested': state.projections[d.id] = { ...d, status: 'requested' }; break;
        case 'projection.reconciled': state.projections[d.id] = { ...state.projections[d.id], ...d, status: d.status }; break;
      }
    }
    return state;
  }

  async status(id, { writeViews = true } = {}) {
    const state = this.replay(await this.events(id));
    const manifest = await json(join(this.runDir(id), 'manifest.json'));
    state.createdProtocolVersion = manifest.createdProtocolVersion || manifest.protocolVersion;
    state.runtimeProtocolVersion = PROTOCOL_VERSION;
    state.protocolMigrated = state.createdProtocolVersion !== state.runtimeProtocolVersion;
    if (!state.outcome) state.outcome = Object.values(state.artifacts.spec || {})[0]?.content?.outcome || null;
    state.frontier = this.frontier(state);
    state.graph = this.graphAnalysis(state);
    state.receiptFreshness = Object.fromEntries(Object.values(state.receipts).map(r => [r.id, this.receiptFresh(state, r)]));
    state.eligibility = this.eligibility(state);
    state.nextAction = this.nextAction(state);
    if (writeViews) {
      await atomicJson(join(this.runDir(id), 'views', 'status.json'), state);
      await writeFile(join(this.runDir(id), 'views', 'status.md'), this.statusMarkdown(state));
      if (['VERIFIED', 'REVIEWED', 'DELIVERED'].includes(state.lifecycle)) await this.view(id, { snapshot: state });
    }
    return state;
  }

  statusMarkdown(s) {
    const gates = Object.values(s.gates).map(g => `- ${g.id}: ${g.reason}`).join('\n') || '- None';
    const stale = Object.entries(s.receiptFreshness).filter(([, x]) => !x.fresh).map(([id, x]) => `- ${id}: ${x.reasons.join(', ')}`).join('\n') || '- None';
    return `# Wstack run ${s.id}\n\n- Workflow: ${s.workflow}\n- Tier: ${s.tier}\n- Lifecycle: ${s.lifecycle}\n- Created under protocol: ${s.createdProtocolVersion}\n- Replayed by runtime protocol: ${s.runtimeProtocolVersion}${s.protocolMigrated ? ' (migrated)' : ''}\n- Disposition: ${s.disposition || 'active'}${s.replacementRunId ? ` (replacement: ${s.replacementRunId})` : ''}\n- Paused: ${s.paused}\n- Eligible: ${s.eligibility.eligible}\n- Critical path: ${s.graph.criticalPath.join(' -> ') || 'none'}\n- Next: ${this.nextAction(s)}\n\n## Gates\n\n${gates}\n\n## Stale evidence\n\n${stale}\n`;
  }
  nextAction(s) {
    if (s.disposition) return `restore the ${s.disposition} run before continuing`;
    if (s.paused) return 'resume the run';
    if (Object.keys(s.gates).length) return `resolve gate ${Object.keys(s.gates).sort()[0]}`;
    if (s.lifecycle === 'FRAMED') return `accept ${WORKFLOW_ARTIFACTS[s.workflow]?.GROUNDED || 'grounding'} and advance to GROUNDED`;
    if (s.lifecycle === 'GROUNDED') return `accept ${WORKFLOW_ARTIFACTS[s.workflow]?.SPECIFIED || 'contract'} and advance to SPECIFIED`;
    if (s.lifecycle === 'SPECIFIED') return 'accept a validated task graph and advance to PLANNED';
    if (s.lifecycle === 'PLANNED') return s.frontier.length ? `claim frontier task ${s.frontier[0]}` : 'advance to ASSIGNED';
    if (s.lifecycle === 'ASSIGNED') return s.frontier.length ? `complete frontier task ${s.frontier[0]}` : 'advance to IMPLEMENTED';
    if (s.lifecycle === 'IMPLEMENTED') return this.coverage(s).missingAcceptance.length ? `verify ${this.coverage(s).missingAcceptance[0]}` : 'advance to VERIFIED';
    if (s.lifecycle === 'VERIFIED') return this.requiredReviewGaps(s).length ? `review ${this.requiredReviewGaps(s)[0]}` : 'advance to REVIEWED';
    if (s.lifecycle === 'REVIEWED') {
      if (s.workflow === 'decision-research' && !this.researchOutcomeFresh(s)) return 'record a current decision-ready or inconclusive research outcome';
      if (s.workflow !== 'decision-research' && (!s.delivery || s.delivery.comparisonDigest !== this.currentComparisonDigest(s))) return 'record delivery at the current comparison point';
      return s.eligibility.eligible ? 'advance to DELIVERED' : 'satisfy the exit predicate or remaining evidence';
    }
    return 'no further lifecycle transition';
  }

  async transition(id, to, key = `transition:${to}`, { skipReason = null } = {}) {
    const s = await this.status(id, { writeViews: false });
    if (!LIFECYCLE.includes(to)) throw new WstackError(`Unknown lifecycle: ${to}`, 'INVALID_TRANSITION');
    const fromIndex = LIFECYCLE.indexOf(s.lifecycle), toIndex = LIFECYCLE.indexOf(to);
    if (toIndex !== fromIndex + 1) throw new WstackError(`Transition ${s.lifecycle} -> ${to} is not allowed`, 'INVALID_TRANSITION');
    if (s.paused || Object.keys(s.gates).length) throw new WstackError('Run is paused or gated', 'GATED');
    const requiredType = WORKFLOW_ARTIFACTS[s.workflow]?.[to];
    if (requiredType && !Object.keys(s.artifacts[requiredType] || {}).length) throw new WstackError(`${s.workflow} requires ${requiredType} before ${to}`, 'MISSING_ARTIFACT');
    if (to === 'SPECIFIED' && s.workflow !== 'decision-research') {
      const spec = Object.values(s.artifacts[requiredType] || {})[0];
      const expected = s.tier === 'lightweight' ? 'request' : 'explicit';
      if (spec?.content?.approvalSource !== expected) throw new WstackError(`Specification approval must be ${expected}`, 'APPROVAL_REQUIRED');
      if (expected === 'explicit' && s.approvals[spec.digest]?.source !== 'explicit') throw new WstackError('Specification requires a separate explicit approval event', 'APPROVAL_REQUIRED');
      if (canonical(spec.content.acceptance) !== canonical(s.acceptance)) throw new WstackError('Specification acceptance does not match the run contract', 'INVALID_SPEC');
    }
    if (to === 'SPECIFIED' && s.workflow === 'decision-research') {
      const contract = Object.values(s.artifacts['research-contract'] || {})[0];
      if (s.tier !== 'lightweight' && s.approvals[contract?.digest]?.source !== 'explicit') throw new WstackError('Research contract requires explicit approval', 'APPROVAL_REQUIRED');
    }
    if (['PLANNED', 'ASSIGNED', 'IMPLEMENTED', 'VERIFIED', 'REVIEWED', 'DELIVERED'].includes(to) && s.tier !== 'lightweight' && !this.contractApproved(s)) throw new WstackError('Current contract revision requires explicit approval', 'APPROVAL_REQUIRED');
    if (to === 'PLANNED' && !Object.keys(s.tasks).length) {
      if (s.tier !== 'lightweight' || !skipReason) throw new WstackError('A validated task graph or allowed lightweight skip reason is required', 'MISSING_TASK_GRAPH');
    } else if (skipReason) throw new WstackError('Skip reason is only valid for an omitted lightweight task graph', 'INVALID_SKIP');
    if (to === 'ASSIGNED' && Object.keys(s.tasks).length && !Object.values(s.claims).some(claim => Date.parse(claim.expiresAt) > Date.now())) throw new WstackError('ASSIGNED requires an active task claim', 'CLAIM_REQUIRED');
    if (to === 'IMPLEMENTED' && Object.values(s.tasks).some(task => task.status !== 'complete')) throw new WstackError('All tasks require evidenced completion before IMPLEMENTED', 'INCOMPLETE_TASKS');
    if (to === 'IMPLEMENTED' && !this.currentComparisonDigest(s)) throw new WstackError('IMPLEMENTED requires a current comparison-point binding', 'MISSING_BINDING');
    if (to === 'VERIFIED' && this.coverage(s).missingAcceptance.length) throw new WstackError('Fresh sufficient acceptance evidence is required before VERIFIED', 'MISSING_EVIDENCE');
    if (to === 'VERIFIED' && s.workflow === 'decision-research' && !Object.values(s.receipts).some(receipt => receipt.domain === 'research' && this.receiptFresh(s, receipt).fresh)) throw new WstackError('Decision research requires at least one fresh research receipt before VERIFIED', 'MISSING_EVIDENCE');
    if (to === 'REVIEWED' && this.requiredReviewGaps(s).length) throw new WstackError('Fresh required review verdicts are required before REVIEWED', 'MISSING_REVIEWS');
    if (to === 'DELIVERED' && s.workflow === 'decision-research' && !this.researchOutcomeFresh(s)) throw new WstackError('DELIVERED requires a current durable research outcome', 'MISSING_RESEARCH_OUTCOME');
    if (to === 'DELIVERED' && s.workflow !== 'decision-research' && (!s.delivery || s.delivery.comparisonDigest !== this.currentComparisonDigest(s))) throw new WstackError('DELIVERED requires a current durable delivery record', 'MISSING_DELIVERY');
    if (to === 'DELIVERED' && !this.eligibility(s).eligible) throw new WstackError('Run is not terminally eligible', 'NOT_ELIGIBLE');
    await this.appendEvent(id, { type: 'lifecycle.transitioned', key, data: { from: s.lifecycle, to, skipped: Boolean(skipReason), skipReason } });
    return this.status(id);
  }

  async setGate(id, gateId, reason, key = `gate:${gateId}:set`) { await this.appendEvent(id, { type: 'gate.set', key, data: { id: gateId, reason } }); return this.status(id); }
  async clearGate(id, gateId, key = `gate:${gateId}:clear`) { await this.appendEvent(id, { type: 'gate.cleared', key, data: { id: gateId } }); return this.status(id); }
  async grantAuthority(id, grant) {
    for (const field of ['id', 'capability', 'target', 'grantor', 'expiresAt']) requiredString(grant[field], `grant.${field}`, 'INVALID_GRANT');
    if (!Object.hasOwn(DEFAULT_AUTHORITY, grant.capability) || Date.parse(grant.expiresAt) <= Date.now()) throw new WstackError('Grant capability or expiry is invalid', 'INVALID_GRANT');
    const config = await this.config();
    if (!config.approvalKeyDigest || digest(grant.approvalSecret || '') !== config.approvalKeyDigest) throw new WstackError('Authority grant requires authenticated approval', 'AUTHORITY_DENIED');
    const data = { id: grant.id, capability: grant.capability, target: grant.target, grantor: grant.grantor, expiresAt: grant.expiresAt, delegable: Boolean(grant.delegable), authorizationDigest: config.approvalKeyDigest };
    await this.appendEvent(id, { type: 'authority.granted', key: grant.key || `grant:${grant.id}`, data }); return data;
  }
  capabilityAllowed(s, config, capability, target = '*') {
    if (s.authorityPolicy?.[capability]) return true;
    return Object.values(s.grants).some(grant => grant.capability === capability && Date.parse(grant.expiresAt) > Date.now() && (grant.target === '*' || grant.target === target));
  }
  async pause(id, reason = 'requested', key = 'run:paused') { await this.appendEvent(id, { type: 'run.paused', key, data: { reason } }); return this.status(id); }
  async resume(id, key = 'run:resumed') { await this.appendEvent(id, { type: 'run.resumed', key, data: {} }); return this.status(id); }
  async setBinding(id, kind, bindingId, value, key = `binding:${kind}:${bindingId || 'current'}:${value}`) {
    if (!['base', 'commit', 'research', 'artifact', 'verifier', 'procedure', 'environment'].includes(kind)) throw new WstackError('Unknown binding kind', 'INVALID_BINDING');
    requiredString(value, 'binding digest', 'INVALID_BINDING');
    if (!['base', 'commit', 'research', 'artifact'].includes(kind)) requiredString(bindingId, 'binding id', 'INVALID_BINDING');
    let data = { kind, id: bindingId, digest: value };
    if (kind === 'artifact') {
      const [artifactType, artifactId] = String(bindingId || '').split('/');
      requiredString(artifactType, 'artifact type', 'INVALID_BINDING'); requiredString(artifactId, 'artifact id', 'INVALID_BINDING');
      data = { kind, artifactType, artifactId, digest: value };
    }
    await this.appendEvent(id, { type: 'binding.set', key, data }); return this.status(id);
  }

  async acceptArtifact(id, { type, artifactId, content, parentDigest = null, key }) {
    safeId(type, 'artifact type', 'INVALID_ARTIFACT');
    safeId(artifactId, 'artifact ID', 'INVALID_ARTIFACT');
    if (!content || typeof content !== 'object' || Array.isArray(content)) throw new WstackError('Artifact content must be an object', 'INVALID_ARTIFACT');
    const s = await this.status(id, { writeViews: false });
    if (['spec', 'evaluation-contract', 'qualification-contract', 'research-contract'].includes(type) && Object.keys(s.artifacts[type] || {}).some(id => id !== artifactId)) throw new WstackError('A run has exactly one canonical contract artifact identity', 'INVALID_ARTIFACT');
    if (type === 'spec') {
      requiredString(content.outcome, 'spec.outcome', 'INVALID_SPEC');
      if (!['request', 'explicit'].includes(content.approvalSource)) throw new WstackError('Invalid specification approval source', 'INVALID_SPEC');
      validateAcceptance(content.acceptance);
    }
    if (type === 'grounding') {
      if (s.workflow === 'decision-research' && (!content.research || typeof content.research !== 'object' || Array.isArray(content.research))) throw new WstackError('Decision research grounding requires grounding.research', 'INVALID_RESEARCH');
      for (const field of ['facts', 'assumptions', 'decisions', 'unresolved']) if (!Array.isArray(content[field])) throw new WstackError(`Grounding requires ${field} array`, 'INVALID_GROUNDING');
      for (const fact of content.facts) {
        requiredString(fact?.claim, 'grounding fact claim', 'INVALID_GROUNDING');
        requiredString(fact?.source, 'grounding fact source', 'INVALID_GROUNDING');
      }
      for (const decision of content.decisions) {
        for (const field of ['id', 'choice', 'reason', 'source']) requiredString(decision?.[field], `grounding decision ${field}`, 'INVALID_GROUNDING');
      }
      if (content.assumptions.some(item => typeof item !== 'string' || !item) || content.unresolved.some(item => typeof item !== 'string' || !item)) throw new WstackError('Grounding assumptions and unresolved branches must be named strings', 'INVALID_GROUNDING');
      validateResearchGrounding(content);
    }
    if (type === 'research-contract') validateResearchContract(content);
    const prior = s.artifacts[type]?.[artifactId];
    const revision = prior ? prior.revision + 1 : 1;
    const contentDigest = digest(content);
    if (prior && prior.digest === contentDigest) return prior;
    const data = { type, id: artifactId, revision, digest: contentDigest, parentDigest: prior?.digest || parentDigest, content };
    const path = join(this.runDir(id), 'artifacts', type, artifactId, `${revision}.json`);
    if (await exists(path)) {
      if (canonical(await json(path)) !== canonical(data)) throw new WstackError('Immutable artifact revision already exists', 'IMMUTABLE');
    } else await atomicJson(path, data);
    await this.appendEvent(id, { type: 'artifact.accepted', key: key || `artifact:${type}:${artifactId}:${contentDigest}`, data });
    if (prior) {
      await this.appendEvent(id, { type: 'stale.recorded', key: `stale:${prior.digest}:${contentDigest}`, data: { cause: 'artifact-revised', prior: prior.digest, current: contentDigest } });
      if (['spec', 'evaluation-contract', 'qualification-contract', 'research-contract'].includes(type)) {
        await this.appendEvent(id, { type: 'tasks.staled', key: `tasks:stale:${prior.digest}:${contentDigest}`, data: { cause: 'contract-revised', prior: prior.digest, current: contentDigest } });
        for (const claim of Object.values(s.claims)) await this.appendEvent(id, { type: 'claim.released', key: `claim:${claim.taskId}:stale:${contentDigest}`, data: { taskId: claim.taskId, owner: claim.owner, cause: 'contract-revised' } });
      }
    }
    return data;
  }
  async approveArtifact(id, { type, artifactId, digest: approvedDigest, approver, source = 'explicit', key }) {
    requiredString(approver, 'approver', 'INVALID_APPROVAL');
    if (!['explicit', 'request'].includes(source)) throw new WstackError('Approval source is invalid', 'INVALID_APPROVAL');
    const s = await this.status(id, { writeViews: false }), artifact = s.artifacts[type]?.[artifactId];
    if (!artifact || artifact.digest !== approvedDigest) throw new WstackError('Approval must bind the current artifact digest', 'STALE_APPROVAL');
    const data = { type, id: artifactId, revision: artifact.revision, digest: approvedDigest, approver, source };
    await this.appendEvent(id, { type: 'artifact.approved', key: key || `approval:${approvedDigest}:${source}`, data }); return data;
  }
  contractApproved(s) {
    const contractDigest = this.currentContractDigest(s);
    return Boolean(contractDigest && (s.tier === 'lightweight' || s.approvals[contractDigest]?.source === 'explicit'));
  }

  validateDag(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) throw new WstackError('Task graph must contain at least one task', 'INVALID_DAG');
    const ids = new Set(tasks.map(t => t.id));
    if (ids.size !== tasks.length) throw new WstackError('Duplicate task ID', 'INVALID_DAG');
    for (const t of tasks) {
      for (const field of ['id', 'goal']) requiredString(t[field], `task.${field}`, 'INVALID_DAG');
      if (!Array.isArray(t.dependsOn)) throw new WstackError(`Task ${t.id} requires dependsOn`, 'INVALID_DAG');
      if (!Array.isArray(t.resources) || t.resources.length === 0) throw new WstackError(`Task ${t.id} requires declared writable resources`, 'INVALID_DAG');
      t.resources = t.resources.map(safeResource);
      if (!Array.isArray(t.acceptanceIds)) throw new WstackError(`Task ${t.id} requires acceptanceIds`, 'INVALID_DAG');
      if (!t.verification || typeof t.verification !== 'object' || Array.isArray(t.verification)) throw new WstackError(`Task ${t.id} requires verification contract`, 'INVALID_DAG');
      if (!Number.isInteger(t.retryBudget) || t.retryBudget < 0) throw new WstackError(`Task ${t.id} requires a non-negative retryBudget`, 'INVALID_DAG');
      for (const dep of t.dependsOn || []) if (!ids.has(dep)) throw new WstackError(`Missing dependency ${dep}`, 'INVALID_DAG');
    }
    const color = new Map();
    const visit = id => { if (color.get(id) === 1) throw new WstackError('Task graph contains a cycle', 'CYCLE'); if (color.get(id) === 2) return; color.set(id, 1); for (const d of tasks.find(t => t.id === id).dependsOn || []) visit(d); color.set(id, 2); };
    for (const t of tasks) visit(t.id);
    return true;
  }
  async setTasks(id, tasks, key = null) {
    const s = await this.status(id, { writeViews: false });
    if (!['SPECIFIED', 'PLANNED'].includes(s.lifecycle)) throw new WstackError('Task graph requires a specified run', 'INVALID_LIFECYCLE');
    const contractDigest = this.currentContractDigest(s);
    if (!contractDigest) throw new WstackError('Task graph requires a current accepted contract', 'MISSING_CONTRACT');
    if (s.tier !== 'lightweight' && !this.contractApproved(s)) throw new WstackError('Task graph requires approval of the current contract revision', 'APPROVAL_REQUIRED');
    const normalized = tasks.map(task => {
      if (task.specDigest && task.specDigest !== contractDigest) throw new WstackError(`Task ${task.id} binds a stale specification`, 'STALE_CONTRACT');
      return { ...task, specDigest: contractDigest };
    });
    this.validateDag(normalized);
    const graphDigest = digest(normalized);
    if (s.taskGraph?.digest === graphDigest) return this.status(id);
    if (Object.values(s.claims).some(claim => Date.parse(claim.expiresAt) > Date.now())) throw new WstackError('Task graph cannot change while claims are active', 'ACTIVE_CLAIMS');
    const all = new Set(s.acceptance.map(a => a.id)), required = new Set(s.acceptance.filter(a => a.criticality !== 'optional').map(a => a.id));
    const referenced = new Set(normalized.flatMap(t => t.acceptanceIds));
    for (const ref of referenced) if (!all.has(ref)) throw new WstackError(`Unknown acceptance reference: ${ref}`, 'INVALID_DAG');
    for (const id of required) if (!referenced.has(id)) throw new WstackError(`Acceptance criterion is uncovered by tasks: ${id}`, 'INVALID_DAG');
    const data = { revision: (s.taskGraph?.revision || 0) + 1, digest: graphDigest, parentDigest: s.taskGraph?.digest || null, tasks: normalized };
    await this.appendEvent(id, { type: 'task-graph.accepted', key: key || `task-graph:${graphDigest}`, data }); return this.status(id);
  }
  frontier(s) { return Object.values(s.tasks).filter(t => t.status === 'pending' && (t.dependsOn || []).every(d => s.tasks[d]?.status === 'complete')).map(t => t.id).sort(); }
  graphAnalysis(s) {
    const tasks = Object.values(s.tasks), byId = s.tasks;
    const memo = new Map();
    const longest = id => {
      if (memo.has(id)) return memo.get(id);
      const deps = byId[id]?.dependsOn || [];
      const path = deps.length ? [...deps.map(longest).sort((a, b) => b.length - a.length || canonical(a).localeCompare(canonical(b)))[0], id] : [id];
      memo.set(id, path); return path;
    };
    const criticalPath = tasks.length ? tasks.map(t => longest(t.id)).sort((a, b) => b.length - a.length || canonical(a).localeCompare(canonical(b)))[0] : [];
    const reaches = (from, target, seen = new Set()) => {
      if (from === target) return true;
      if (seen.has(from)) return false;
      seen.add(from); return (byId[from]?.dependsOn || []).some(dep => reaches(dep, target, seen));
    };
    const parallelResourceConflicts = [];
    for (let i = 0; i < tasks.length; i += 1) for (let j = i + 1; j < tasks.length; j += 1) {
      const a = tasks[i], b = tasks[j];
      if (reaches(a.id, b.id) || reaches(b.id, a.id)) continue;
      const overlaps = a.resources.flatMap(x => b.resources.filter(y => this.overlap(x, y)).map(y => [x, y]));
      if (overlaps.length) parallelResourceConflicts.push({ tasks: [a.id, b.id].sort(), overlaps });
    }
    return { criticalPath, parallelResourceConflicts };
  }

  async coordinator(id, { owner, ttlMs = null, takeover = false, key = `coordinator:${owner}:${Date.now()}` }) {
    ttlMs ??= (await this.config()).coordination.coordinatorLeaseMs;
    const s = await this.status(id, { writeViews: false }), now = Date.now();
    if (s.coordinator && Date.parse(s.coordinator.expiresAt) > now && s.coordinator.owner !== owner) throw new WstackError('Coordinator lease is active', 'LEASE_ACTIVE');
    const automaticTakeover = Boolean(s.authorityPolicy?.automaticTakeover);
    if (s.coordinator && s.coordinator.owner !== owner && !takeover && !automaticTakeover) throw new WstackError('Takeover must be explicit', 'TAKEOVER_REQUIRED');
    const data = { owner, acquiredAt: new Date(now).toISOString(), expiresAt: new Date(now + ttlMs).toISOString(), takeoverFrom: s.coordinator?.owner || null, automatic: Boolean(!takeover && automaticTakeover && s.coordinator?.owner) };
    await this.appendEvent(id, { type: 'coordinator.acquired', key, data }); return data;
  }

  overlap(a, b) { const clean = x => x.replace(/^\.\//, '').replace(/\/$/, ''); a = clean(a); b = clean(b); return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); }
  async claim(id, { taskId, owner, environmentId, resources, ttlMs = null, key = null }) {
    const s = await this.status(id, { writeViews: false });
    if (s.paused) throw new WstackError('Paused runs cannot start new claims', 'PAUSED');
    if (!['PLANNED', 'ASSIGNED'].includes(s.lifecycle)) throw new WstackError('Claims require a planned or assigned run', 'INVALID_LIFECYCLE');
    if (s.tier === 'program' && (!s.coordinator || Date.parse(s.coordinator.expiresAt) <= Date.now())) throw new WstackError('Program claims require an active coordinator lease', 'COORDINATOR_REQUIRED');
    const config = await this.config();
    ttlMs ??= config.coordination.coordinatorLeaseMs;
    requiredString(owner, 'claim owner', 'INVALID_CLAIM');
    requiredString(environmentId, 'claim environmentId', 'INVALID_CLAIM');
    if (!s.tasks[taskId]) throw new WstackError(`Unknown task: ${taskId}`, 'UNKNOWN_TASK');
    if (!s.frontier.includes(taskId)) throw new WstackError(`Task is not on frontier: ${taskId}`, 'NOT_READY');
    const declared = [...s.tasks[taskId].resources].sort();
    if (resources && canonical([...resources].sort()) !== canonical(declared)) throw new WstackError('Claim resources must exactly match task declaration', 'RESOURCE_MISMATCH');
    resources = declared;
    const now = Date.now();
    if (Object.values(s.claims).filter(c => Date.parse(c.expiresAt) > now).length >= config.coordination.maxWorkers && !s.claims[taskId]) throw new WstackError('Maximum active worker claims reached', 'WORKER_LIMIT');
    for (const c of Object.values(s.claims)) if (Date.parse(c.expiresAt) > now) {
      if (c.taskId === taskId && c.owner !== owner) throw new WstackError(`Task already claimed: ${taskId}`, 'TASK_CLAIMED');
      if (c.taskId !== taskId) for (const a of resources) for (const b of c.resources) if (this.overlap(a, b)) throw new WstackError(`Resource overlaps active claim: ${a} / ${b}`, 'RESOURCE_CONFLICT');
    }
    if (s.tier !== 'lightweight' && !s.bindings.baseDigest) throw new WstackError('Structured claims require a frozen base binding', 'MISSING_BINDING');
    const attempt = (s.claimAttempts[taskId] || 0) + 1;
    const data = { taskId, owner, environmentId, resources, attempt, baseDigest: s.bindings.baseDigest, researchDigest: s.bindings.researchDigest, taskGraphDigest: s.taskGraph.digest, authorityPolicyDigest: s.authorityPolicyDigest, contractDigest: digest({ task: s.tasks[taskId], taskGraphDigest: s.taskGraph.digest, authorityPolicyDigest: s.authorityPolicyDigest, baseDigest: s.bindings.baseDigest, researchDigest: s.bindings.researchDigest, environmentId, attempt }), acquiredAt: new Date(now).toISOString(), expiresAt: new Date(now + ttlMs).toISOString() };
    await this.appendEvent(id, { type: 'claim.acquired', key: key || `claim:${taskId}:${owner}:attempt:${attempt}`, data }); return data;
  }

  async releaseClaim(id, taskId, owner, key = `claim:${taskId}:released`) {
    const s = await this.status(id, { writeViews: false });
    if (!s.claims[taskId] || s.claims[taskId].owner !== owner) throw new WstackError('Only the claim owner may release it', 'CLAIM_OWNER');
    await this.appendEvent(id, { type: 'claim.released', key, data: { taskId, owner } }); return this.status(id);
  }
  async completeTask(id, taskId, owner, key = `task:${taskId}:completed`) {
    const s = await this.status(id, { writeViews: false });
    if (!s.claims[taskId] || s.claims[taskId].owner !== owner) throw new WstackError('Task completion requires its active claim', 'CLAIM_REQUIRED');
    if (s.tasks[taskId]?.status !== 'pending') throw new WstackError('Only a current pending task may complete', 'STALE_CONTRACT');
    if (s.claims[taskId].taskGraphDigest !== s.taskGraph?.digest || s.claims[taskId].authorityPolicyDigest !== s.authorityPolicyDigest) throw new WstackError('Task claim no longer matches the run contract', 'STALE_CONTRACT');
    if (Date.parse(s.claims[taskId].expiresAt) <= Date.now()) throw new WstackError('Task claim has expired', 'CLAIM_EXPIRED');
    const evidence = Object.values(s.receipts).filter(r => r.taskId === taskId && this.receiptFresh(s, r).fresh);
    const criteria = s.tasks[taskId].acceptanceIds || [];
    const requirements = new Map(s.acceptance.map(a => [a.id, a]));
    if (!evidence.length || criteria.some(ac => !evidence.some(r => r.acceptanceIds.includes(ac) && this.evidenceSatisfies(requirements.get(ac), r)))) throw new WstackError('Task completion requires fresh sufficient evidence', 'EVIDENCE_REQUIRED');
    await this.appendEvent(id, { type: 'task.completed', key, data: { id: taskId, owner } });
    await this.appendEvent(id, { type: 'claim.released', key: `${key}:release`, data: { taskId, owner } }); return this.status(id);
  }
  async setPredicate(id, value, evidence, key = `predicate:${digest({ value, evidence })}`) {
    if (typeof value !== 'boolean' || !evidence) throw new WstackError('Predicate requires boolean value and evidence', 'INVALID_PREDICATE');
    await this.appendEvent(id, { type: 'predicate.set', key, data: { value, evidence } }); return this.status(id);
  }

  async recordEvaluation(id, decision) {
    for (const field of ['verdict', 'evaluatorId', 'contractDigest', 'baselineDigest', 'comparisonDigest']) requiredString(decision[field], `evaluation.${field}`, 'INVALID_EVALUATION');
    if (!['approve', 'reject', 'inconclusive'].includes(decision.verdict)) throw new WstackError('Unknown evaluation verdict', 'INVALID_EVALUATION');
    const s = await this.status(id, { writeViews: false });
    if (!['product-evaluation', 'agent-evaluation', 'hillclimb'].includes(s.workflow)) throw new WstackError('This workflow does not use an evaluation decision', 'INVALID_EVALUATION');
    if (decision.contractDigest !== this.currentContractDigest(s) || decision.comparisonDigest !== s.bindings.commitDigest) throw new WstackError('Evaluation decision is stale', 'STALE_CONTRACT');
    const data = { ...decision, recordedAt: decision.recordedAt || new Date().toISOString() };
    await this.appendEvent(id, { type: 'evaluation.recorded', key: decision.key || `evaluation:${digest(data)}`, data }); return data;
  }

  async recordResearch(id, decision) {
    const data = {
      outcome: decision.outcome ?? decision.verdict,
      researchContractDigest: decision.researchContractDigest ?? decision.contractDigest,
      groundingDigest: decision.groundingDigest,
      predicateEventDigest: decision.predicateEventDigest,
      confidence: decision.confidence,
      remainingUnknowns: decision.remainingUnknowns,
      limitations: decision.limitations,
      stoppingRationale: decision.stoppingRationale,
      receiptIds: decision.receiptIds,
      reviewIds: decision.reviewIds,
      projectionDigest: decision.projectionDigest ?? decision.briefDigest,
    };
    for (const field of ['outcome', 'researchContractDigest', 'groundingDigest', 'predicateEventDigest', 'confidence', 'stoppingRationale', 'projectionDigest']) requiredString(data[field], `research.${field}`, 'INVALID_RESEARCH');
    for (const field of ['remainingUnknowns', 'limitations', 'receiptIds', 'reviewIds']) if (!Array.isArray(data[field])) throw new WstackError(`research.${field} must be an array`, 'INVALID_RESEARCH');
    for (const field of ['receiptIds', 'reviewIds']) if (data[field].length === 0) throw new WstackError(`research.${field} must identify supporting records`, 'INVALID_RESEARCH');
    if (!['decision-ready', 'inconclusive'].includes(data.outcome)) throw new WstackError('Unknown research outcome', 'INVALID_RESEARCH');
    const s = await this.status(id, { writeViews: false });
    if (s.workflow !== 'decision-research') throw new WstackError('This workflow does not use a research decision', 'INVALID_RESEARCH');
    if (data.researchContractDigest !== this.currentContractDigest(s) || data.groundingDigest !== Object.values(s.artifacts.grounding || {})[0]?.digest || data.groundingDigest !== this.currentComparisonDigest(s)) throw new WstackError('Research outcome is stale', 'STALE_CONTRACT');
    if (data.predicateEventDigest !== s.predicateEventDigest) throw new WstackError('Research outcome must bind the current predicate event', 'STALE_CONTRACT');
    if (data.receiptIds.some(receiptId => !s.receipts[receiptId] || !this.receiptFresh(s, s.receipts[receiptId]).fresh)) throw new WstackError('Research outcome cites missing or stale receipts', 'INVALID_RESEARCH');
    if (data.reviewIds.some(reviewId => !Object.entries(s.reviews).some(([axis, review]) => (review.id || axis) === reviewId && this.reviewFresh(s, review)))) throw new WstackError('Research outcome cites missing or stale reviews', 'INVALID_RESEARCH');
    await this.appendEvent(id, { type: 'research.recorded', key: decision.key || `research:${digest(data)}`, data }); return data;
  }

  async recordDelivery(id, delivery) {
    for (const field of ['state', 'comparisonDigest', 'producerId']) requiredString(delivery[field], `delivery.${field}`, 'INVALID_DELIVERY');
    if (!['local-ready', 'pr-published', 'merged', 'deployed'].includes(delivery.state)) throw new WstackError('Unknown delivery state', 'INVALID_DELIVERY');
    const s = await this.status(id, { writeViews: false });
    const comparison = this.currentComparisonDigest(s);
    if (delivery.comparisonDigest !== comparison) throw new WstackError('Delivery must bind the current comparison point', 'STALE_CONTRACT');
    if (delivery.state !== 'local-ready') {
      const requiredKind = delivery.state === 'pr-published' ? 'pr.create' : delivery.state === 'merged' ? 'merge' : null;
      if (requiredKind && !Object.values(s.projections).some(p => p.kind === requiredKind && p.status === 'succeeded')) throw new WstackError('Remote delivery state lacks a reconciled projection', 'MISSING_PROJECTION');
      if (delivery.state === 'deployed' && !delivery.externalReceipt) throw new WstackError('Deployment requires an external receipt', 'MISSING_PROJECTION');
    }
    const data = { ...delivery, recordedAt: delivery.recordedAt || new Date().toISOString() };
    await this.appendEvent(id, { type: 'delivery.recorded', key: delivery.key || `delivery:${digest(data)}`, data }); return data;
  }

  async review(id, verdict) {
    const s = await this.status(id, { writeViews: false });
    const comparisonDigest = verdict.comparisonDigest || verdict.commitDigest;
    for (const f of ['axis', 'result', 'artifactDigests', 'reviewerId', 'subjectId', 'reviewerModelFamily', 'independenceClass']) if (verdict[f] === undefined) throw new WstackError(`Review missing ${f}`, 'INVALID_REVIEW');
    for (const f of ['axis', 'reviewerId', 'subjectId', 'reviewerModelFamily', 'independenceClass']) requiredString(verdict[f], `review.${f}`, 'INVALID_REVIEW');
    requiredString(comparisonDigest, 'review.comparisonDigest', 'INVALID_REVIEW');
    if (!['pass', 'fail', 'blocked'].includes(verdict.result)) throw new WstackError('Invalid review result', 'INVALID_REVIEW');
    if (!['self', 'independent', 'degraded'].includes(verdict.independenceClass) || (verdict.independenceClass === 'degraded' && !verdict.limitation)) throw new WstackError('Review independence is invalid or unexplained', 'INVALID_REVIEW');
    if ((verdict.independenceClass === 'self') !== (verdict.reviewerId === verdict.subjectId)) throw new WstackError('Review identities contradict independence class', 'INVALID_REVIEW');
    if (!Array.isArray(verdict.artifactDigests) || verdict.artifactDigests.length === 0) throw new WstackError('Review requires artifact digests', 'INVALID_REVIEW');
    const contractDigest = this.currentContractDigest(s);
    if (contractDigest && !verdict.artifactDigests.includes(contractDigest)) throw new WstackError('Review must bind the current contract', 'INVALID_REVIEW');
    if (s.workflow === 'decision-research' && !verdict.artifactDigests.includes(this.currentComparisonDigest(s))) throw new WstackError('Research review must bind the current grounding comparison', 'INVALID_REVIEW');
    const data = { ...verdict, comparisonDigest };
    await this.appendEvent(id, { type: 'review.recorded', key: verdict.key || `review:${verdict.axis}:${digest(data)}`, data }); return this.status(id);
  }
  reviewFresh(s, review) {
    const current = new Set(Object.values(s.artifacts).flatMap(group => Object.values(group)).map(a => a.digest));
    const comparison = this.currentComparisonDigest(s);
    return review.result === 'pass' && review.artifactDigests.every(d => current.has(d)) && (!comparison || (review.comparisonDigest || review.commitDigest) === comparison) && (s.tier === 'lightweight' || ['independent', 'degraded'].includes(review.independenceClass));
  }

  researchOutcomeFresh(s) {
    const outcome = s.research;
    if (!outcome || !['decision-ready', 'inconclusive'].includes(outcome.outcome)) return false;
    if (outcome.researchContractDigest !== this.currentContractDigest(s) || outcome.groundingDigest !== this.currentComparisonDigest(s) || outcome.predicateEventDigest !== s.predicateEventDigest) return false;
    if ((outcome.receiptIds || []).some(id => !s.receipts[id] || !this.receiptFresh(s, s.receipts[id]).fresh)) return false;
    if (this.coverage(s).freshReceiptIds.some(id => !(outcome.receiptIds || []).includes(id))) return false;
    if ((outcome.reviewIds || []).some(id => !Object.entries(s.reviews).some(([axis, review]) => (review.id || axis) === id && this.reviewFresh(s, review)))) return false;
    return [...this.requiredReviewAxes(s), ...(s.riskLenses || [])].every(axis => (outcome.reviewIds || []).includes(s.reviews[axis]?.id || axis));
  }

  async receipt(id, receipt) {
    const required = ['id', 'domain', 'acceptanceIds', 'result', 'evidenceClass', 'surface', 'artifactDigests', 'taskGraphDigest', 'verifierId', 'verifierDigest', 'procedureDigest', 'environmentId', 'environmentDigest', 'producerId', 'subjectId', 'independenceClass', 'verifierStatus', 'evidenceManifests'];
    for (const f of required) if (receipt[f] === undefined) throw new WstackError(`Receipt missing ${f}`, 'INVALID_RECEIPT');
    safeId(receipt.id, 'receipt.id', 'INVALID_RECEIPT');
    for (const f of ['domain', 'surface', 'taskGraphDigest', 'verifierId', 'verifierDigest', 'procedureDigest', 'environmentId', 'environmentDigest', 'producerId', 'subjectId', 'independenceClass', 'verifierStatus']) requiredString(receipt[f], `receipt.${f}`, 'INVALID_RECEIPT');
    requiredString(receipt.comparisonDigest || receipt.commitDigest, 'receipt.comparisonDigest', 'INVALID_RECEIPT');
    if (!['engineering', 'product', 'agent', 'research'].includes(receipt.domain) || !EVIDENCE_CLASSES.has(receipt.evidenceClass)) throw new WstackError('Receipt has unknown domain or evidence class', 'INVALID_RECEIPT');
    if (!['pass', 'fail', 'blocked', 'inconclusive'].includes(receipt.result)) throw new WstackError('Receipt has invalid result', 'INVALID_RECEIPT');
    if (!['self', 'independent', 'degraded'].includes(receipt.independenceClass) || (receipt.independenceClass === 'degraded' && !receipt.limitation)) throw new WstackError('Receipt has invalid or unexplained independence class', 'INVALID_RECEIPT');
    if ((receipt.independenceClass === 'self') !== (receipt.producerId === receipt.subjectId)) throw new WstackError('Receipt producer/subject identities contradict independence class', 'INVALID_RECEIPT');
    const statuses = new Set(['live-ui-verified', 'unit-test-verified', 'integration-test-verified', 'type-check-only', 'static-review', 'verifier-blocked', 'verifier-failed']);
    if (!statuses.has(receipt.verifierStatus)) throw new WstackError('Receipt has unknown verifier status', 'INVALID_RECEIPT');
    if ((receipt.result === 'blocked') !== (receipt.verifierStatus === 'verifier-blocked') || (receipt.result === 'fail') !== (receipt.verifierStatus === 'verifier-failed')) throw new WstackError('Receipt result and verifier status disagree', 'INVALID_RECEIPT');
    if (!Array.isArray(receipt.acceptanceIds) || !Array.isArray(receipt.artifactDigests) || !Array.isArray(receipt.evidenceManifests) || receipt.evidenceManifests.length === 0) throw new WstackError('Receipt arrays are invalid or evidence manifests are empty', 'INVALID_RECEIPT');
    const verifiedManifests = [];
    for (const manifest of receipt.evidenceManifests) {
      for (const field of ['digest', 'mediaType', 'availability', 'storage']) requiredString(manifest?.[field], `evidenceManifest.${field}`, 'INVALID_RECEIPT');
      if (!['available', 'unavailable', 'redacted'].includes(manifest.availability)) throw new WstackError('Evidence manifest availability is invalid', 'INVALID_RECEIPT');
      if (!['inline', 'object', 'external'].includes(manifest.storage)) throw new WstackError('Evidence manifest storage is invalid', 'INVALID_RECEIPT');
      let payloadVerified = manifest.availability === 'unavailable';
      if (manifest.availability === 'available' && manifest.storage === 'inline') payloadVerified = typeof manifest.content === 'string' && byteDigest(manifest.content) === manifest.digest;
      if (manifest.availability === 'available' && manifest.storage === 'object') {
        if (!/^[a-f0-9]{64}$/.test(manifest.digest)) throw new WstackError('Object evidence requires a SHA-256 digest', 'INVALID_RECEIPT');
        const payload = await readFile(join(this.dir, 'evidence', 'objects', manifest.digest)).catch(() => null);
        payloadVerified = Boolean(payload && byteDigest(payload) === manifest.digest);
      }
      if ((manifest.availability === 'available' && manifest.storage === 'external') || manifest.availability === 'redacted') payloadVerified = Boolean(manifest.uri && /^[a-f0-9]{64}$/.test(manifest.provenanceDigest || ''));
      if (!payloadVerified) throw new WstackError('Evidence payload or provenance cannot be verified', 'INVALID_RECEIPT');
      verifiedManifests.push({ ...manifest, payloadVerified });
    }
    const s = await this.status(id, { writeViews: false });
    const knownAcceptance = new Set(s.acceptance.map(item => item.id));
    if (receipt.acceptanceIds.some(ac => !knownAcceptance.has(ac))) throw new WstackError('Receipt references unknown acceptance criteria', 'INVALID_RECEIPT');
    if (receipt.taskId && (!s.tasks[receipt.taskId] || receipt.acceptanceIds.some(ac => !s.tasks[receipt.taskId].acceptanceIds.includes(ac)))) throw new WstackError('Receipt exceeds its task acceptance scope', 'INVALID_RECEIPT');
    const existing = s.receipts[receipt.id];
    const rawProposed = { ...receipt, comparisonDigest: receipt.comparisonDigest || receipt.commitDigest, evidenceManifests: verifiedManifests }; delete rawProposed.key; delete rawProposed.recordedAt;
    const proposed = JSON.parse(JSON.stringify(rawProposed));
    if (existing) {
      const prior = { ...existing }; delete prior.key; delete prior.recordedAt;
      if (canonical(prior) !== canonical(proposed)) throw new WstackError(`Receipt ID is immutable: ${receipt.id}`, 'INVALID_RECEIPT');
      return existing;
    }
    const path = join(this.runDir(id), 'receipts', `${receipt.id}.json`);
    let data = { ...proposed, recordedAt: receipt.recordedAt || new Date().toISOString() };
    if (await exists(path)) {
      const stored = await json(path), prior = { ...stored }; delete prior.recordedAt;
      if (canonical(prior) !== canonical(proposed)) throw new WstackError(`Receipt file conflicts: ${receipt.id}`, 'INVALID_RECEIPT');
      data = stored;
    } else await atomicJson(path, data);
    await this.appendEvent(id, { type: 'receipt.recorded', key: receipt.key || `receipt:${receipt.id}`, data }); return data;
  }
  receiptFresh(s, r) {
    const current = new Set(Object.values(s.artifacts).flatMap(group => Object.values(group)).map(a => a.digest));
    const reasons = [];
    for (const d of r.artifactDigests) if (!current.has(d)) reasons.push(`artifact:${d}`);
    if (s.taskGraph && r.taskGraphDigest !== s.taskGraph.digest) reasons.push('task-graph');
    const comparison = this.currentComparisonDigest(s);
    if (comparison && (r.comparisonDigest || r.commitDigest) !== comparison) reasons.push(s.workflow === 'decision-research' ? 'research' : 'commit');
    const verifierId = r.verifierId || 'default';
    if (r.evidenceClass === 'matching-surface' && !s.bindings.verifierDigests[verifierId]) reasons.push('verifier-binding-missing');
    if (r.evidenceClass === 'matching-surface' && !s.bindings.procedureDigests[verifierId]) reasons.push('procedure-binding-missing');
    if (s.bindings.verifierDigests[verifierId] && r.verifierDigest !== s.bindings.verifierDigests[verifierId]) reasons.push('verifier');
    if (s.bindings.procedureDigests[verifierId] && r.procedureDigest !== s.bindings.procedureDigests[verifierId]) reasons.push('procedure');
    if (s.bindings.environmentDigests[r.environmentId] && r.environmentDigest !== s.bindings.environmentDigests[r.environmentId]) reasons.push('environment');
    if ((r.evidenceManifests || []).some(m => m.availability === 'unavailable' || !m.payloadVerified)) reasons.push('payload-unavailable');
    if (r.result !== 'pass') reasons.push('result');
    if (['verifier-blocked', 'verifier-failed', 'blocked', 'failed'].includes(r.verifierStatus)) reasons.push('verifier-status');
    return { fresh: reasons.length === 0, reasons };
  }
  currentContractDigest(s) {
    const type = ['product-evaluation', 'agent-evaluation'].includes(s.workflow) ? 'evaluation-contract' : (s.workflow === 'hillclimb' ? 'qualification-contract' : (s.workflow === 'decision-research' ? 'research-contract' : 'spec'));
    return Object.values(s.artifacts[type] || {})[0]?.digest || null;
  }
  currentComparisonDigest(s) {
    return s.workflow === 'decision-research' ? s.bindings.researchDigest : s.bindings.commitDigest;
  }
  expectedEvidenceDomain(workflow) {
    if (workflow === 'product-evaluation') return 'product';
    if (workflow === 'agent-evaluation') return 'agent';
    if (workflow === 'decision-research') return 'research';
    return 'engineering';
  }
  evidenceSatisfies(criterion, receipt) {
    if (!criterion || receipt.surface !== criterion.surface) return false;
    const allowed = {
      static: new Set(['static', 'deterministic', 'matching-surface']),
      deterministic: new Set(['deterministic', 'matching-surface']),
      'matching-surface': new Set(['matching-surface']),
      probabilistic: new Set(['probabilistic']),
    };
    return allowed[criterion.evidenceClass]?.has(receipt.evidenceClass) || false;
  }
  coverage(s) {
    const contractDigest = this.currentContractDigest(s);
    const domain = this.expectedEvidenceDomain(s.workflow);
    const fresh = Object.values(s.receipts).filter(r => r.domain === domain && this.receiptFresh(s, r).fresh && (!contractDigest || r.artifactDigests.includes(contractDigest)));
    const missingAcceptance = (s.acceptance || []).filter(item => item.criticality !== 'optional').filter(item => !fresh.some(r =>
      r.acceptanceIds.includes(item.id) && this.evidenceSatisfies(item, r) &&
      (s.tier === 'lightweight' || ['independent', 'degraded'].includes(r.independenceClass))
    )).map(item => item.id);
    return { missingAcceptance, freshReceiptIds: fresh.map(r => r.id) };
  }
  requiredReviewAxes(s) {
    return s.workflow === 'decision-research'
      ? ['decision-relevance', 'evidence-quality', 'alternative-coverage', 'counterevidence', 'uncertainty-calibration', ...(s.artifacts['research-contract'] && Object.values(s.artifacts['research-contract'])[0]?.content?.rigor === 'intensive' ? ['independent-challenge', 'method-reproducibility'] : [])]
      : ['spec-fidelity', 'repository-standards'];
  }
  requiredReviewGaps(s) {
    return [...this.requiredReviewAxes(s), ...(s.riskLenses || [])].filter(axis => !s.reviews[axis] || !this.reviewFresh(s, s.reviews[axis]));
  }
  eligibility(s) {
    const missing = this.coverage(s).missingAcceptance;
    const incompleteTasks = Object.values(s.tasks).filter(t => t.status !== 'complete').map(t => t.id);
    const blockers = Object.keys(s.gates);
    const missingReviews = this.requiredReviewGaps(s);
    const evaluationMissing = ['product-evaluation', 'agent-evaluation', 'hillclimb'].includes(s.workflow) && s.evaluation?.verdict !== 'approve';
    const researchMissing = s.workflow === 'decision-research' && !this.researchOutcomeFresh(s);
    const researchEvidenceMissing = s.workflow === 'decision-research' && !Object.values(s.receipts).some(receipt => receipt.domain === 'research' && this.receiptFresh(s, receipt).fresh);
    return { eligible: ['REVIEWED', 'DELIVERED'].includes(s.lifecycle) && Boolean(s.predicate) && missing.length === 0 && incompleteTasks.length === 0 && blockers.length === 0 && missingReviews.length === 0 && !evaluationMissing && !researchMissing && !researchEvidenceMissing && !s.paused, missingAcceptance: missing, incompleteTasks, blockers, missingReviews, evaluationMissing, researchMissing, researchEvidenceMissing };
  }

  async retry(id, { taskId, failureClass, max = 2, key }) {
    const s = await this.status(id, { writeViews: false });
    if (!s.tasks[taskId]) throw new WstackError(`Unknown task: ${taskId}`, 'UNKNOWN_TASK');
    const strategies = {
      capacity: 'reduce-scope-or-concurrency', network: 'retry-idempotently', tool: 'change-tool-or-model',
      unknown: 'reproduce-and-instrument-once', assertion: 'diagnose-root-cause', infrastructure: 'activate-stop-line',
    };
    if (!strategies[failureClass]) throw new WstackError(`Unknown failure class: ${failureClass}`, 'INVALID_FAILURE_CLASS');
    const configured = s.tasks[taskId].retryBudget ?? (await this.config()).coordination.retryBudget;
    const budget = failureClass === 'infrastructure' ? 0 : (failureClass === 'unknown' ? Math.min(1, configured, max) : Math.min(configured, max));
    const attempt = (s.retries[taskId] || 0) + 1, needsReplan = attempt > budget;
    const data = { taskId, failureClass, strategy: strategies[failureClass], attempt, max: budget, needsReplan };
    await this.appendEvent(id, { type: 'retry.recorded', key: key || `retry:${taskId}:${attempt}`, data });
    if (failureClass === 'infrastructure') await this.setGate(id, `stop-line:${taskId}`, 'infrastructure failure requires recovery before more work', `stop-line:${taskId}:${attempt}`);
    return data;
  }

  async createBundle(id, { taskId, environmentId, commits = [], changedResources = null, receipts = [], proposedEvents = [], complete = true }) {
    const s = await this.status(id, { writeViews: false });
    const claim = s.claims[taskId];
    if (!claim) throw new WstackError('Completion bundle requires active claim', 'CLAIM_REQUIRED');
    if (!environmentId) throw new WstackError('Completion bundle requires environment identity', 'INVALID_BUNDLE');
    if (environmentId !== claim.environmentId) throw new WstackError('Completion environment differs from frozen claim', 'STALE_CONTRACT');
    if (!Array.isArray(commits) || commits.some(item => typeof item !== 'string' || !item)) throw new WstackError('Bundle commits must be digest strings', 'INVALID_BUNDLE');
    changedResources ??= claim.resources;
    if (!Array.isArray(changedResources) || changedResources.some(resource => !claim.resources.some(owned => this.overlap(owned, safeResource(resource))))) throw new WstackError('Bundle changed resources exceed the claim', 'INVALID_BUNDLE');
    const comparisonDigest = s.workflow === 'decision-research' ? s.bindings.researchDigest : (commits.at(-1) || claim.baseDigest);
    requiredString(comparisonDigest, 'bundle comparison digest', 'INVALID_BUNDLE');
    const bundle = { protocolVersion: PROTOCOL_VERSION, runId: id, taskId, environmentId, owner: claim.owner, resources: claim.resources, changedResources, attempt: claim.attempt, baseDigest: claim.baseDigest, comparisonKind: s.workflow === 'decision-research' ? 'artifact' : 'commit', comparisonDigest, taskGraphDigest: claim.taskGraphDigest, authorityPolicyDigest: claim.authorityPolicyDigest, contractDigest: claim.contractDigest, commits, receipts, proposedEvents, complete };
    if (Buffer.byteLength(JSON.stringify(bundle)) > 1024 * 1024) throw new WstackError('Completion bundle exceeds 1 MiB; store evidence out of band', 'INVALID_BUNDLE');
    return { ...bundle, digest: digest(bundle) };
  }
  async importBundle(id, bundle, key = `bundle:${bundle.digest}`) {
    if (!COMPATIBLE_PROTOCOLS.has(bundle.protocolVersion) || bundle.runId !== id) throw new WstackError('Bundle is incompatible', 'INVALID_BUNDLE');
    const claimedDigest = bundle.digest, body = { ...bundle }; delete body.digest;
    if (digest(body) !== claimedDigest) throw new WstackError('Bundle digest mismatch', 'INVALID_BUNDLE');
    if (Buffer.byteLength(JSON.stringify(bundle)) > 1024 * 1024) throw new WstackError('Completion bundle exceeds 1 MiB', 'INVALID_BUNDLE');
    let s = await this.status(id, { writeViews: false });
    if (s.tier === 'program' && (!s.coordinator || Date.parse(s.coordinator.expiresAt) <= Date.now())) throw new WstackError('Program bundle import requires an active coordinator lease', 'COORDINATOR_REQUIRED');
    if (s.importedBundles.includes(claimedDigest)) return { duplicate: true };
    let started = s.startedBundles[claimedDigest], claim = started?.claim || s.claims[bundle.taskId];
    if (!claim || (Date.parse(claim.expiresAt) <= Date.now() && s.tasks[bundle.taskId]?.status !== 'complete')) {
      await this.appendEvent(id, { type: 'bundle.rejected', key: `bundle:${claimedDigest}:zombie`, data: { digest: claimedDigest, reason: 'expired-or-missing-claim' } });
      throw new WstackError('Late completion bundle has no active claim', 'ZOMBIE_BUNDLE');
    }
    if (bundle.contractDigest !== claim.contractDigest || bundle.owner !== claim.owner || canonical(bundle.resources) !== canonical(claim.resources)) throw new WstackError('Completion bundle does not match frozen claim contract', 'STALE_CONTRACT');
    for (const field of ['attempt', 'baseDigest', 'taskGraphDigest', 'authorityPolicyDigest']) if (bundle[field] !== claim[field]) throw new WstackError(`Completion bundle ${field} differs from frozen claim`, 'STALE_CONTRACT');
    if (claim.baseDigest !== s.bindings.baseDigest || claim.taskGraphDigest !== s.taskGraph?.digest || claim.authorityPolicyDigest !== s.authorityPolicyDigest || (s.workflow === 'decision-research' && claim.researchDigest !== s.bindings.researchDigest)) throw new WstackError('Completion bundle lineage is stale', 'STALE_CONTRACT');
    if (!Array.isArray(bundle.changedResources) || bundle.changedResources.some(resource => !claim.resources.some(owned => this.overlap(owned, safeResource(resource))))) throw new WstackError('Completion bundle changed resources exceed the claim', 'STALE_CONTRACT');
    if (!Array.isArray(bundle.commits) || (s.workflow === 'decision-research' ? (!['artifact', 'research'].includes(bundle.comparisonKind) || bundle.commits.length || bundle.comparisonDigest !== s.bindings.researchDigest) : ((bundle.commits.length && bundle.comparisonDigest !== bundle.commits.at(-1)) || (!bundle.commits.length && bundle.comparisonDigest !== bundle.baseDigest)))) throw new WstackError('Completion bundle comparison lineage is invalid', 'INVALID_BUNDLE');
    if (bundle.environmentId !== claim.environmentId) throw new WstackError('Completion bundle environment does not match its claim', 'STALE_CONTRACT');
    const allowedProposals = new Set(['worker.note', 'deviation.reported', 'failure.recorded']);
    if ((bundle.proposedEvents || []).some(e => !allowedProposals.has(e.type))) throw new WstackError('Bundle proposed events may not bypass canonical commands', 'INVALID_BUNDLE');
    for (const receipt of bundle.receipts || []) {
      if (receipt.taskId !== bundle.taskId || receipt.environmentId !== bundle.environmentId || receipt.producerId !== bundle.owner) throw new WstackError('Bundle receipt is outside the frozen worker contract', 'STALE_CONTRACT');
      if ((receipt.comparisonDigest || receipt.commitDigest) !== bundle.comparisonDigest || receipt.taskGraphDigest !== bundle.taskGraphDigest) throw new WstackError('Bundle receipt does not bind the bundle comparison point', 'STALE_CONTRACT');
    }
    if (!started) {
      await this.appendEvent(id, { type: 'bundle.import.started', key: `bundle:${claimedDigest}:started`, data: { digest: claimedDigest, taskId: bundle.taskId, claim, bundle } });
      s = await this.status(id, { writeViews: false });
      started = s.startedBundles[claimedDigest];
    }
    for (const r of bundle.receipts || []) await this.receipt(id, r);
    for (const e of bundle.proposedEvents || []) await this.appendEvent(id, e);
    await this.setBinding(id, s.workflow === 'decision-research' ? 'research' : 'commit', null, bundle.comparisonDigest, `bundle:${claimedDigest}:comparison`);
    if (bundle.complete && (await this.status(id, { writeViews: false })).tasks[bundle.taskId]?.status !== 'complete') await this.completeTask(id, bundle.taskId, bundle.owner, `bundle:${claimedDigest}:complete`);
    await this.appendEvent(id, { type: 'bundle.imported', key, data: { digest: claimedDigest, taskId: bundle.taskId } });
    return { duplicate: false };
  }

  async requestProjection(id, request) {
    const kinds = new Set(['issue.create', 'issue.update', 'blocker.sync', 'pr.create', 'pr.update', 'review.observe', 'ci.observe', 'verdict.comment', 'merge']);
    for (const field of ['id', 'provider', 'kind', 'idempotencyKey']) requiredString(request[field], `projection.${field}`, 'INVALID_PROJECTION');
    if (request.provider !== 'github' || !kinds.has(request.kind)) throw new WstackError('Unsupported projection provider or kind', 'INVALID_PROJECTION');
    if (!request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload)) throw new WstackError('Projection payload must be an object', 'INVALID_PROJECTION');
    const data = { id: request.id, provider: request.provider, kind: request.kind, idempotencyKey: request.idempotencyKey, payloadDigest: digest(request.payload), payload: request.payload };
    await this.appendEvent(id, { type: 'projection.requested', key: `projection:${request.id}:requested`, data });
    return data;
  }
  async reconcileProjection(id, result) {
    for (const field of ['id', 'idempotencyKey', 'status']) requiredString(result[field], `projection.${field}`, 'INVALID_PROJECTION');
    if (!['succeeded', 'failed', 'unknown'].includes(result.status)) throw new WstackError('Invalid projection status', 'INVALID_PROJECTION');
    const s = await this.status(id, { writeViews: false }), request = s.projections[result.id];
    if (!request || request.idempotencyKey !== result.idempotencyKey) throw new WstackError('Projection result has no matching request', 'INVALID_PROJECTION');
    if (['succeeded', 'failed'].includes(request.status)) {
      if (request.status !== result.status) throw new WstackError('Terminal projection result cannot regress or change', 'PROJECTION_CONFLICT');
      return request;
    }
    const capability = request.kind === 'merge' ? 'merge' : (['review.observe', 'ci.observe'].includes(request.kind) ? null : 'publishRemote');
    if (capability) {
      const config = await this.config();
      if (!this.capabilityAllowed(s, config, capability, request.payload.target || '*')) throw new WstackError(`Projection requires ${capability} authority`, 'AUTHORITY_DENIED');
    }
    const data = { id: result.id, idempotencyKey: result.idempotencyKey, status: result.status, remoteId: result.remoteId || null, remoteUrl: result.remoteUrl || null, observationDigest: digest(result.observation || {}) };
    if (result.status === 'succeeded' && !['review.observe', 'ci.observe'].includes(request.kind) && !data.remoteId && !data.remoteUrl) throw new WstackError('Successful mutation requires a remote identity or URL', 'INVALID_PROJECTION');
    await this.appendEvent(id, { type: 'projection.reconciled', key: result.key || `projection:${result.id}:result:${digest(data)}`, data });
    return data;
  }

  async listRuns() {
    const root = join(this.dir, 'runs');
    if (!await exists(root)) return [];
    const entries = await readdir(root, { withFileTypes: true });
    const runs = [];
    for (const entry of entries.filter(x => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      try { const s = await this.status(entry.name, { writeViews: false }); runs.push({ id: s.id, outcome: s.outcome, workflow: s.workflow, lifecycle: s.lifecycle, active: s.lifecycle !== 'DELIVERED' && !s.disposition, paused: s.paused, gates: Object.keys(s.gates), disposition: s.disposition || null, replacementRunId: s.replacementRunId || null, lastEvent: (await this.events(entry.name)).at(-1)?.type || null, statusPath: join(this.runDir(entry.name), 'views', 'status.json') }); } catch (error) { runs.push({ id: entry.name, error: error.code || error.message }); }
    }
    return runs;
  }

  async view(id, { snapshot = null, open = false } = {}) {
    const { writeProjection } = await import('./projection.mjs');
    const state = snapshot || await this.status(id, { writeViews: false });
    const events = await this.events(id);
    const artifactRecords = await structuredRecords(join(this.runDir(id), 'artifacts'), this.root);
    const runRecords = await structuredRecords(this.runDir(id), this.root, { skip: new Set(['artifacts', 'views', 'events.ndjson', 'locks']) });
    const sharedRecords = [
      ...runRecords,
      ...await structuredRecords(this.dir, this.root, { skip: new Set(['runs', 'locks', 'secrets', 'scratch', 'raw', 'objects']) }),
    ];
    const projection = await writeProjection({ root: this.root, runId: id, snapshot: state, events, artifactRecords, sharedRecords, eventHeadDigest: events.at(-1)?.eventDigest || null, generatedAt: events.at(-1)?.at || new Date(0).toISOString() });
    if (open) {
      const command = process.platform === 'darwin' ? ['open', projection.explorerPath] : process.platform === 'win32' ? ['cmd', '/c', 'start', '', projection.explorerPath] : ['xdg-open', projection.explorerPath];
      const child = spawn(command[0], command.slice(1), { detached: true, stdio: 'ignore', shell: false }); child.unref();
    }
    return { reviewPath: projection.reviewPath, explorerPath: projection.explorerPath, snapshotDigest: projection.snapshotDigest, eventHeadDigest: projection.eventHeadDigest };
  }
  async disposeRun(id, disposition, { replacementRunId = null, key = null } = {}) {
    if (!['abandoned', 'superseded'].includes(disposition)) throw new WstackError('Invalid run disposition', 'INVALID_DISPOSITION');
    const s = await this.status(id, { writeViews: false });
    if (s.disposition) throw new WstackError('Run is already retired', 'DISPOSITION_CONFLICT');
    if (disposition === 'superseded') requiredString(replacementRunId, 'replacementRunId', 'INVALID_DISPOSITION');
    if (replacementRunId === id) throw new WstackError('A run cannot supersede itself', 'INVALID_DISPOSITION');
    if (replacementRunId && !await exists(this.runDir(replacementRunId))) throw new WstackError('Superseding run does not exist', 'INVALID_DISPOSITION');
    await this.appendEvent(id, { type: 'run.dispositioned', key: key || `run:${id}:${disposition}`, data: { disposition, replacementRunId, at: new Date().toISOString() } });
    return this.status(id);
  }
  async restoreRun(id, key = `run:${id}:restored`) {
    const s = await this.status(id, { writeViews: false });
    if (!['abandoned', 'superseded'].includes(s.disposition)) throw new WstackError('Run is not retired', 'DISPOSITION_CONFLICT');
    await this.appendEvent(id, { type: 'run.dispositioned', key, data: { disposition: null, restored: true, at: new Date().toISOString() } });
    return this.status(id);
  }

  async handoff(id) {
    const s = await this.status(id);
    const handoff = {
      protocolVersion: PROTOCOL_VERSION, runId: id, outcome: s.outcome, lifecycle: s.lifecycle,
      nextAction: this.nextAction(s), comparisonPoint: s.workflow === 'decision-research' ? s.bindings.comparison : { kind: 'commit', digest: s.bindings.commitDigest }, disposition: s.disposition, replacementRunId: s.replacementRunId,
      frontier: s.frontier, criticalPath: s.graph.criticalPath, coordinator: s.coordinator,
      claims: s.claims, gates: s.gates, approvals: s.approvals, retries: s.retries,
      failures: s.failures, stale: s.stale, receiptFreshness: s.receiptFreshness,
      taskGraph: s.taskGraph, artifacts: Object.fromEntries(Object.entries(s.artifacts).map(([type, group]) => [type, Object.fromEntries(Object.entries(group).map(([name, artifact]) => [name, { revision: artifact.revision, digest: artifact.digest }]))])),
      eligibility: s.eligibility,
    };
    handoff.snapshotDigest = digest(handoff);
    const comparison = s.workflow === 'decision-research' ? `${s.bindings.comparison?.artifactType || 'grounding'}/${s.bindings.comparison?.artifactId || 'main'}@${this.currentComparisonDigest(s) || 'unbound'}` : (s.bindings.commitDigest || 'unbound');
    const text = `# Handoff: ${id}\n\n- Outcome: ${s.outcome}\n- Lifecycle: ${s.lifecycle}\n- Disposition: ${s.disposition || 'active'}${s.replacementRunId ? ` (replacement: ${s.replacementRunId})` : ''}\n- Comparison point: ${comparison}\n- Coordinator: ${s.coordinator?.owner || 'none'}\n- Frontier: ${s.frontier.join(', ') || 'none'}\n- Critical path: ${s.graph.criticalPath.join(' -> ') || 'none'}\n- Eligible: ${s.eligibility.eligible}\n- Next: ${handoff.nextAction}\n\n## Gates\n\n${Object.values(s.gates).map(g => `- ${g.id}: ${g.reason}`).join('\n') || '- None'}\n\n## Claims\n\n${Object.values(s.claims).map(c => `- ${c.taskId}: ${c.owner} in ${c.environmentId}`).join('\n') || '- None'}\n\n## Evidence\n\n- Fresh: ${Object.entries(s.receiptFreshness).filter(([, value]) => value.fresh).map(([receipt]) => receipt).join(', ') || 'none'}\n- Stale: ${Object.entries(s.receiptFreshness).filter(([, value]) => !value.fresh).map(([receipt]) => receipt).join(', ') || 'none'}\n`;
    await atomicJson(join(this.runDir(id), 'views', 'handoff.json'), handoff);
    await atomicText(join(this.runDir(id), 'views', 'handoff.md'), text); return text;
  }

  async execute(id, commandName) {
    const [config, s] = await Promise.all([this.config(), this.status(id, { writeViews: false })]);
    const profile = s.authorityPolicy;
    if (!profile?.executeCommands) throw new WstackError('Command execution is not authorized', 'AUTHORITY_DENIED');
    const spec = config.deterministicCommands[commandName];
    if (!spec || !Array.isArray(spec.argv) || !spec.argv.length) throw new WstackError('Command is not allowlisted', 'COMMAND_NOT_ALLOWED');
    if (s.authority === 'reviewOnly' && spec.mode !== 'read-only') throw new WstackError('Review-only profile cannot execute mutating commands', 'AUTHORITY_DENIED');
    const startedAt = new Date().toISOString();
    const result = await new Promise((resolveResult, reject) => {
      const child = spawn(spec.argv[0], spec.argv.slice(1), { cwd: this.root, env: { PATH: process.env.PATH }, shell: false });
      let stdout = '', stderr = '';
      child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);
      child.on('error', reject); child.on('close', code => resolveResult({ code, stdout, stderr }));
    });
    const data = { commandName, argvDigest: digest(spec.argv), startedAt, finishedAt: new Date().toISOString(), ...result, outputDigest: digest({ stdout: result.stdout, stderr: result.stderr }) };
    await this.appendEvent(id, { type: 'command.executed', key: `command:${commandName}:${data.outputDigest}:${startedAt}`, data });
    return data;
  }
}
