import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Build the human-readable projections for one replayed run.  The runtime owns
 * replay and validation; this module deliberately accepts a snapshot rather
 * than reading status.json, so a stale derived view cannot become a source of
 * truth.
 *
 * Input shape:
 *   { root, runId, snapshot, events?, artifactRecords?, sharedRecords? }
 * Records are { path, value } (or { path, data }); `path` is displayed only.
 */

const SECRET_KEY = /(?:password|passwd|token|secret|privatekey|private_key|credential|authorization|cookie|approvalkey|api[_-]?key)/i;
const PRIVACY_KEY = /(?:private|sensitive|confidential|redact|secret)/i;
const SECRET_TEXT = /(?:bearer\s+|basic\s+)[a-z0-9._~+/=-]+|(?:--(?:token|secret|password|api[_-]?key)(?:=|\s+))\S+|(?:[?&](?:access_token|token|api[_-]?key|password|secret)=)[^&#\s]+|(?:https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi;

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function sha256(value) { return createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex'); }

function recordValue(record) {
  // Event objects must remain intact (their type/key/digest are provenance);
  // ordinary wrappers may use either `value` or `data`.
  if (record?.eventDigest || (record?.type && record?.data !== undefined)) return record;
  return record?.value ?? record?.data ?? record;
}
function recordPath(record) { return record?.path || record?.file || null; }
function viewRelativePath(path, runId) {
  if (!path) return null;
  const normalized = String(path).replaceAll('\\', '/').replace(/^\.\//, '');
  const prefix = `.wstack/runs/${runId}/`;
  if (normalized.startsWith(prefix)) return `../${normalized.slice(prefix.length)}`;
  if (normalized.startsWith('.wstack/')) return `../../../${normalized.slice('.wstack/'.length)}`;
  return `../../../../${normalized}`;
}

function redact(value, key = '', path = '') {
  if (SECRET_KEY.test(key) || PRIVACY_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item, index) => typeof value[index - 1] === 'string' && /^--(?:token|secret|password|api[_-]?key)$/i.test(value[index - 1]) ? '[REDACTED]' : redact(item, String(index), `${path}/${index}`));
  if (typeof value === 'string') return value.replace(SECRET_TEXT, match => {
    if (/^https?:\/\//i.test(match)) return match.replace(/\/\/.*@/, '//[REDACTED]@');
    const delimiter = match.match(/^(.*?(?:=|\s+))/)?.[1];
    return delimiter ? `${delimiter}[REDACTED]` : '[REDACTED]';
  });
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([child, item]) => [child, redact(item, child, `${path}/${child}`)]));
}

function jsonForScript(value) {
  // Prevent data from closing the JSON script element or becoming a JS line
  // separator. The explorer never evaluates artifact text as code.
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

function flatten(value, prefix = '') {
  if (!value || typeof value !== 'object') return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((item, i) => flatten(item, `${prefix}[${i}]`));
  return Object.entries(value).flatMap(([key, item]) => flatten(item, prefix ? `${prefix}.${key}` : key));
}

function semanticLabel(path) {
  if (/acceptance.*predicate|predicate/.test(path)) return 'acceptance predicate changed';
  if (/evidenceClass/.test(path)) return 'evidence strength changed';
  if (/scope|exclusions/.test(path)) return 'scope changed';
  if (/approval|approver/.test(path)) return 'approval changed';
  if (/confidence|uncertainty/.test(path)) return 'confidence/uncertainty changed';
  if (/parentDigest|digest/.test(path)) return 'artifact lineage changed';
  return null;
}

function artifactDiagnostics(records, snapshot) {
  const groups = new Map();
  const invalid = [];
  for (const record of records || []) {
    const value = recordValue(record);
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.diagnostic) {
      invalid.push({ type: 'invalid', id: recordPath(record) || `record-${invalid.length + 1}`, revision: null, digest: null, parentDigest: null, status: 'invalid/unlinked', issues: [value?.diagnostic || 'artifact record is not an object'], path: recordPath(record), content: redact(value, 'content', 'invalid') });
      continue;
    }
    const type = value.type || value.kind || 'unknown';
    const id = value.id || value.artifactId || recordPath(record) || 'record';
    const key = `${type}/${id}`;
    const list = groups.get(key) || [];
    const item = { ...value, sourcePath: recordPath(record) };
    if (item.digest && item.content !== undefined && item.digest !== sha256(item.content)) item.diagnostic = 'digest does not match content';
    list.push(item); groups.set(key, list);
  }
  const out = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => (a.revision || 0) - (b.revision || 0));
    const [type, id] = key.split('/');
    const current = snapshot?.artifacts?.[type]?.[id];
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      const prior = list[i - 1];
      const issues = [];
      if (prior && item.parentDigest !== prior.digest) issues.push('parent digest does not match previous revision');
      if (!current || current.digest !== item.digest) issues.push(item.revision > (current?.revision || 0) ? 'not present in replayed snapshot' : 'historical revision');
      out.push({ type, id, revision: item.revision || null, digest: item.digest || null, parentDigest: item.parentDigest || null, status: current?.digest === item.digest ? 'current' : (item.revision > (current?.revision || 0) ? 'pending/unlinked' : 'historical'), issues: [...issues, ...(item.diagnostic ? [item.diagnostic] : [])], path: item.sourcePath, content: redact(item.content, 'content', `${type}/${id}/${item.revision}`) });
    }
  }
  return [...out, ...invalid];
}

function diffs(records) {
  const groups = new Map();
  for (const record of records || []) {
    const value = recordValue(record); if (!value?.content || value.revision === undefined) continue;
    const key = `${value.type || value.kind || 'unknown'}/${value.id || value.artifactId || recordPath(record) || 'record'}`;
    const list = groups.get(key) || []; list.push(value); groups.set(key, list);
  }
  const result = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => a.revision - b.revision);
    for (let i = 1; i < list.length; i += 1) {
      const before = Object.fromEntries(flatten(redact(list[i - 1].content)).map(([k, v]) => [k, v]));
      const after = Object.fromEntries(flatten(redact(list[i].content)).map(([k, v]) => [k, v]));
      const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(path => canonical(before[path]) !== canonical(after[path]));
      result.push({ key, from: list[i - 1].revision, to: list[i].revision, changes: paths.map(path => ({ path, before: before[path], after: after[path], semantic: semanticLabel(path) })) });
    }
  }
  return result;
}

function markdown(input, model) {
  const s = input.snapshot || {};
  const lines = [`# Wstack review: ${input.runId}`, '', `> Derived snapshot. Regenerate with \`wstack view ${input.runId}\`.`, '', '## Overview', '', `- Outcome: ${s.outcome ?? 'unknown'}`, `- Workflow: ${s.workflow ?? 'unknown'}`, `- Lifecycle: ${s.lifecycle ?? 'unknown'}`, `- Created under protocol: ${s.createdProtocolVersion ?? 'unknown'}`, `- Replayed by runtime protocol: ${s.runtimeProtocolVersion ?? 'unknown'}${s.protocolMigrated ? ' (migrated)' : ''}`, `- Disposition: ${s.disposition || 'active'}`, `- Research outcome: ${s.research?.outcome || 'not applicable'}`, `- Snapshot event head: ${model.eventHeadDigest}`, `- Snapshot digest: ${model.snapshotDigest}`, ''];
  lines.push('## Decision or contract', '');
  const decisions = [
    ...model.artifacts.filter(record => /grounding|spec|contract|decision/i.test(record.type)).map(record => record.path),
    ...model.sharedRecords.filter(r => /(?:^|\/)decisions\//i.test(recordPath(r) || '')).map(r => recordPath(r)),
  ].filter(Boolean);
  lines.push(decisions.length ? decisions.map(p => `- [${p}](${viewRelativePath(p, input.runId)})`).join('\n') : '- See the contract and grounding sections in the explorer.', '');
  lines.push('## Acceptance and evidence', '');
  const acceptance = s.acceptance || [];
  const missing = s.eligibility?.missingAcceptance || [];
  lines.push(acceptance.length ? acceptance.map(a => `- ${a.id}: ${missing.includes(a.id) ? 'MISSING' : 'covered'} — ${a.predicate}`).join('\n') : '- No acceptance criteria recorded.', '');
  lines.push(`- Fresh receipts: ${Object.entries(s.receiptFreshness || {}).filter(([, x]) => x.fresh).map(([id]) => id).join(', ') || 'none'}`, `- Stale receipts: ${Object.entries(s.receiptFreshness || {}).filter(([, x]) => !x.fresh).map(([id]) => id).join(', ') || 'none'}`, `- Missing reviews: ${(s.eligibility?.missingReviews || []).join(', ') || 'none'}`, '');
  lines.push('## Changes', '');
  lines.push(model.artifacts.map(a => `- ${a.type}/${a.id} r${a.revision ?? '?'} (${a.status})${a.issues.length ? ` — ${a.issues.join('; ')}` : ''}`).join('\n') || '- No artifact files supplied.', '');
  if (model.diffs.length) lines.push(model.diffs.flatMap(d => d.changes.map(c => `- ${d.key} r${d.from} → r${d.to}: ${c.path}${c.semantic ? ` (${c.semantic})` : ''}`)).join('\n'), '');
  lines.push('## Limitations', '', `- Gates: ${Object.keys(s.gates || {}).join(', ') || 'none'}`, `- Blockers: ${(s.eligibility?.blockers || []).join(', ') || 'none'}`, `- Unavailable or stale evidence: ${Object.entries(s.receiptFreshness || {}).filter(([, x]) => !x.fresh).map(([id]) => id).join(', ') || 'none'}`, '- Open [explorer.html](explorer.html) for searchable raw JSON/NDJSON, provenance, diagnostics, and advanced metadata.', '');
  lines.push('## Next action', '', s.nextAction || 'See the current status view.');
  return lines.join('\n');
}

function explorer(input, model) {
  const s = input.snapshot || {};
  const payload = redact({
    snapshot: s,
    events: (input.events || []).map((record, index) => ({ path: `events.ndjson#${index + 1}`, href: '../events.ndjson', value: recordValue(record) })),
    artifacts: model.artifacts.map(record => ({ ...record, href: viewRelativePath(record.path, input.runId) })),
    diffs: model.diffs,
    sharedRecords: model.sharedRecords.map(record => ({ path: recordPath(record), href: viewRelativePath(recordPath(record), input.runId), value: recordValue(record) })),
  });
  const title = `Wstack explorer — ${input.runId}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"><title>${escapeText(title)}</title><style>
body{font:15px system-ui,sans-serif;max-width:1200px;margin:2rem auto;padding:0 1rem;color:#17202a}header{border-bottom:1px solid #ccd6dd;margin-bottom:1rem}nav{display:flex;gap:.75rem;flex-wrap:wrap;margin:1rem 0}nav a,a{color:#075985}button,input,select{font:inherit;padding:.35rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.7rem}.card{border:1px solid #ccd6dd;border-radius:6px;padding:.7rem;margin:.5rem 0}details{margin:.35rem 0 0 1rem}code{overflow-wrap:anywhere}.muted{color:#5f6b76}.warn{color:#9a3412}section{scroll-margin-top:1rem}
</style></head><body><header id="overview"><h1>${escapeText(title)}</h1><p class="muted">Derived snapshot · event head <code>${escapeText(model.eventHeadDigest)}</code> · snapshot <code>${escapeText(model.snapshotDigest)}</code> · generated ${escapeText(model.generatedAt)}</p><p>Regenerate with <code>wstack view ${escapeText(input.runId)}</code>. This explorer is read-only.</p><nav><a href="#decision-contract">Decision or contract</a><a href="#work">Work</a><a href="#evidence">Evidence</a><a href="#reviews">Reviews</a><a href="#outcome">Outcome</a><a href="#records">Records</a><a href="#changes">Changes</a></nav></header>
<main><section class="grid"><div class="card"><b>Outcome</b><br>${escapeText(s.outcome)}</div><div class="card"><b>Lifecycle</b><br>${escapeText(s.lifecycle)}</div><div class="card"><b>Protocol</b><br>created ${escapeText(s.createdProtocolVersion || 'unknown')} · runtime ${escapeText(s.runtimeProtocolVersion || 'unknown')}${s.protocolMigrated ? ' (migrated)' : ''}</div><div class="card"><b>Disposition</b><br>${escapeText(s.disposition || 'active')}</div></section>
<section id="decision-contract"><h2>Decision or contract</h2><div data-view="decision"></div></section><section id="work"><h2>Work</h2><div data-view="work"></div></section><section id="evidence"><h2>Acceptance and evidence</h2><div data-view="evidence"></div></section><section id="reviews"><h2>Reviews</h2><div data-view="reviews"></div></section><section id="outcome"><h2>Outcome and next action</h2><div data-view="outcome"></div></section>
<section id="records"><h2>All records</h2><label>Search <input id="q" type="search" placeholder="type, path, digest, text"></label> <label>Filter <select id="kind"><option value="">all records</option><option>artifact</option><option>event</option><option>shared</option></select></label><div id="record-list"></div></section><section id="changes"><h2>Revision diffs</h2><div data-view="changes"></div></section></main>
<script type="application/json" id="payload">${jsonForScript(payload)}</script><script>(()=>{const p=JSON.parse(document.getElementById('payload').textContent),q=document.getElementById('q'),kind=document.getElementById('kind'),list=document.getElementById('record-list');const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const tree=x=>{if(x===null||typeof x!=='object')return '<code>'+esc(x)+'</code>';return (Array.isArray(x)?x.map((v,i)=>[i,v]):Object.entries(x)).map(([k,v])=>'<details><summary>'+esc(k)+'</summary>'+tree(v)+'</details>').join('')};const put=(name,value)=>{document.querySelector('[data-view="'+name+'"]').innerHTML=tree(value)};const records=[...(p.artifacts||[]).map(x=>({kind:'artifact',path:x.path||x.type+'/'+x.id,href:x.href,value:x})),...(p.events||[]).map(x=>({kind:'event',path:x.path,href:x.href,value:x.value})),...(p.sharedRecords||[]).map(x=>({kind:'shared',path:x.path||'shared',href:x.href,value:x.value}))];const rows=()=>{const term=(q.value||'').toLowerCase(),filter=kind.value;list.innerHTML=records.filter(x=>(!filter||x.kind===filter)&&(!term||JSON.stringify(x).toLowerCase().includes(term))).map(x=>'<details class="card"><summary><b>'+esc(x.kind)+'</b> '+(x.href?'<a href="'+esc(x.href)+'">'+esc(x.path)+'</a>':esc(x.path))+'</summary>'+tree(x.value)+'</details>').join('')||'<p class="muted">No matching records.</p>'};put('decision',{artifacts:p.artifacts.filter(x=>/grounding|spec|contract|decision/i.test(x.type)),decisions:p.sharedRecords.filter(x=>/(^|\\/)decisions\\//i.test(x.path||''))});put('work',{taskGraph:p.snapshot.taskGraph,tasks:p.snapshot.tasks,frontier:p.snapshot.frontier,claims:p.snapshot.claims});put('evidence',{acceptance:p.snapshot.acceptance,receiptFreshness:p.snapshot.receiptFreshness,missingAcceptance:p.snapshot.eligibility&&p.snapshot.eligibility.missingAcceptance,receipts:p.sharedRecords.filter(x=>/(^|\\/)receipts\\//i.test(x.path||''))});put('reviews',{reviews:p.snapshot.reviews,missingReviews:p.snapshot.eligibility&&p.snapshot.eligibility.missingReviews});put('outcome',{outcome:p.snapshot.outcome,research:p.snapshot.research,evaluation:p.snapshot.evaluation,delivery:p.snapshot.delivery,disposition:p.snapshot.disposition,nextAction:p.snapshot.nextAction});put('changes',p.diffs||[]);q.oninput=rows;kind.onchange=rows;rows()})()</script></body></html>`;
}

function escapeText(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export function projectRun(input) {
  if (!input?.runId || !input?.snapshot) throw new TypeError('projectRun requires runId and replayed snapshot');
  const events = input.events || [];
  const eventValues = events.map(recordValue);
  const eventHeadDigest = input.eventHeadDigest || eventValues.at(-1)?.eventDigest || sha256(eventValues);
  const artifacts = artifactDiagnostics(input.artifactRecords || [], input.snapshot);
  const sharedRecords = input.sharedRecords || [];
  const artifactDiffs = diffs(input.artifactRecords || []);
  const snapshotDigest = sha256({ runId: input.runId, snapshot: redact(input.snapshot), eventHeadDigest, artifacts, sharedRecords: redact(sharedRecords.map(record => ({ path: recordPath(record), value: recordValue(record) }))), diffs: artifactDiffs });
  const model = { generatedAt: input.generatedAt || new Date().toISOString(), eventHeadDigest, snapshotDigest, sharedRecords, artifacts, diffs: artifactDiffs };
  return { ...model, reviewMarkdown: markdown(input, model), explorerHtml: explorer(input, model) };
}

export async function writeProjection(input) {
  if (!input?.root || !input?.runId) throw new TypeError('writeProjection requires root and runId');
  const projection = projectRun(input);
  const dir = join(input.root, '.wstack', 'runs', input.runId, 'views');
  await mkdir(dir, { recursive: true });
  const suffix = randomUUID();
  const reviewTemp = join(dir, `.review-${suffix}.tmp`), explorerTemp = join(dir, `.explorer-${suffix}.tmp`);
  await writeFile(reviewTemp, `${projection.reviewMarkdown}\n`, { mode: 0o600 });
  await writeFile(explorerTemp, projection.explorerHtml, { mode: 0o600 });
  await rename(reviewTemp, join(dir, 'review.md'));
  await rename(explorerTemp, join(dir, 'explorer.html'));
  return { ...projection, reviewPath: join(dir, 'review.md'), explorerPath: join(dir, 'explorer.html') };
}

export { canonical, redact, artifactDiagnostics, diffs };
