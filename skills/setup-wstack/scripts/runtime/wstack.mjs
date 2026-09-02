#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { Workspace, WstackError, PROTOCOL_VERSION } from './core.mjs';

const HELP = `wstack ${PROTOCOL_VERSION}

Usage: wstack [--root PATH] <command> [arguments]

Commands:
  init [discovery.json]                         Initialize versioned project state
  run-create ID WORKFLOW TIER ACCEPTANCE [options.json] Create a run
  status RUN                                    Regenerate and print derived status
  transition RUN STATE [SKIP_REASON]            Advance or explicitly mark an allowed skip
  artifact-add RUN TYPE ID FILE                 Accept immutable artifact revision
  artifact-approve RUN TYPE ID DIGEST APPROVER   Record explicit current-revision approval
  tasks-set RUN FILE                            Validate and accept task DAG
  frontier RUN                                  Print ready task IDs
  gate-set RUN ID REASON | gate-clear RUN ID     Manage orthogonal gates
  authority-grant RUN FILE                       Record scoped, expiring authority
  pause RUN [REASON] | resume RUN                Pause/resume without changing lifecycle
  binding-set RUN base|commit|research DIGEST    Bind frozen base or legacy research comparison
  binding-set RUN artifact TYPE ID DIGEST        Bind an artifact comparison point
  binding-set RUN verifier|procedure|environment ID DIGEST
  coordinator RUN OWNER [--takeover]             Acquire/take over coordinator lease
  claim RUN TASK OWNER ENVIRONMENT               Claim task's declared resources
  claim-release RUN TASK OWNER                   Release an owned task claim
  task-complete RUN TASK OWNER                   Complete task and release claim
  predicate-set RUN true|false EVIDENCE           Record evaluated exit predicate
  receipt-add RUN FILE                           Record typed verification receipt
  review-add RUN FILE                            Record typed review verdict
  evaluation-record RUN FILE                     Record product/agent/hillclimb decision
  delivery-record RUN FILE                       Record local or externally reconciled delivery
  eligible RUN                                  Evaluate terminal eligibility
  retry RUN TASK FAILURE_CLASS                   Record bounded retry / needs-replan
  bundle-create RUN TASK FILE                    Create completion bundle from body
  bundle-import RUN FILE                         Validate and import completion bundle
  projection-request RUN FILE                    Record an idempotent remote projection
  projection-reconcile RUN FILE                  Reconcile a provider result under authority
  handoff RUN                                    Generate Markdown handoff
  view RUN [--open]                              Generate review.md and explorer.html
  runs [--json]                                  List runs (human-readable by default)
  retire RUN abandoned|superseded [REPLACEMENT]  Retire a run without deleting history
  restore RUN                                    Restore a retired run
  research-record RUN FILE                       Record decision-ready/inconclusive outcome
  exec RUN COMMAND                               Execute allowlisted deterministic command
  help                                          Show this help
`;

function take(args, flag) { const i = args.indexOf(flag); if (i < 0) return null; const v = args[i + 1]; args.splice(i, v && !v.startsWith('--') ? 2 : 1); return v || true; }
async function file(path, fallback = {}) { return path ? JSON.parse(await readFile(path, 'utf8')) : fallback; }

async function main() {
  const args = process.argv.slice(2), root = take(args, '--root') || process.cwd(), command = args.shift() || 'help';
  const ws = new Workspace(root); let out;
  switch (command) {
    case 'help': case '--help': case '-h': process.stdout.write(HELP); return;
    case 'init': out = await ws.init(await file(args[0], {})); break;
    case 'run-create': out = await ws.createRun({ ...(await file(args[4], {})), id: args[0], workflow: args[1], tier: args[2], acceptance: await file(args[3], []) }); break;
    case 'status': out = await ws.status(args[0]); break;
    case 'transition': out = await ws.transition(args[0], args[1], `transition:${args[1]}`, { skipReason: args.slice(2).join(' ') || null }); break;
    case 'artifact-add': out = await ws.acceptArtifact(args[0], { type: args[1], artifactId: args[2], content: await file(args[3]) }); break;
    case 'artifact-approve': out = await ws.approveArtifact(args[0], { type: args[1], artifactId: args[2], digest: args[3], approver: args[4], source: 'explicit' }); break;
    case 'tasks-set': out = await ws.setTasks(args[0], await file(args[1], [])); break;
    case 'frontier': out = (await ws.status(args[0])).frontier; break;
    case 'gate-set': out = await ws.setGate(args[0], args[1], args.slice(2).join(' ')); break;
    case 'gate-clear': out = await ws.clearGate(args[0], args[1]); break;
    case 'authority-grant': out = await ws.grantAuthority(args[0], { ...(await file(args[1])), approvalSecret: process.env.WSTACK_APPROVAL_KEY }); break;
    case 'pause': out = await ws.pause(args[0], args.slice(1).join(' ') || 'requested'); break;
    case 'resume': out = await ws.resume(args[0]); break;
    case 'binding-set':
      if (['base', 'commit', 'research'].includes(args[1])) out = await ws.setBinding(args[0], args[1], null, args[2]);
      else if (args[1] === 'artifact') out = await ws.setBinding(args[0], 'artifact', `${args[2]}/${args[3]}`, args[4]);
      else out = await ws.setBinding(args[0], args[1], args[2], args[3]);
      break;
    case 'coordinator': out = await ws.coordinator(args[0], { owner: args[1], takeover: args.includes('--takeover') }); break;
    case 'claim': out = await ws.claim(args[0], { taskId: args[1], owner: args[2], environmentId: args[3] }); break;
    case 'claim-release': out = await ws.releaseClaim(args[0], args[1], args[2]); break;
    case 'task-complete': out = await ws.completeTask(args[0], args[1], args[2]); break;
    case 'predicate-set': out = await ws.setPredicate(args[0], args[1] === 'true', args.slice(2).join(' ')); break;
    case 'receipt-add': out = await ws.receipt(args[0], await file(args[1])); break;
    case 'review-add': out = await ws.review(args[0], await file(args[1])); break;
    case 'evaluation-record': out = await ws.recordEvaluation(args[0], await file(args[1])); break;
    case 'delivery-record': out = await ws.recordDelivery(args[0], await file(args[1])); break;
    case 'eligible': out = (await ws.status(args[0])).eligibility; break;
    case 'retry': out = await ws.retry(args[0], { taskId: args[1], failureClass: args[2] }); break;
    case 'bundle-create': { const body = await file(args[2]); out = await ws.createBundle(args[0], { taskId: args[1], ...body }); if (body.output) await writeFile(body.output, JSON.stringify(out, null, 2)); break; }
    case 'bundle-import': out = await ws.importBundle(args[0], await file(args[1])); break;
    case 'projection-request': out = await ws.requestProjection(args[0], await file(args[1])); break;
    case 'projection-reconcile': out = await ws.reconcileProjection(args[0], await file(args[1])); break;
    case 'handoff': process.stdout.write(await ws.handoff(args[0])); return;
    case 'view': out = await ws.view(args[0], { open: args.includes('--open') }); break;
    case 'runs': {
      const runs = await ws.listRuns();
      if (args.includes('--json')) out = runs;
      else {
        const header = ['RUN', 'WORKFLOW', 'LIFECYCLE', 'STATE', 'OUTCOME'].join('\t');
        const rows = runs.map(run => run.error ? [run.id, '-', '-', run.error, '-'] : [run.id, run.workflow, run.lifecycle, run.disposition || (run.paused ? 'paused' : run.gates.length ? 'gated' : 'active'), run.outcome]).map(row => row.join('\t'));
        process.stdout.write(`${[header, ...rows].join('\n')}\n`); return;
      }
      break;
    }
    case 'retire': out = await ws.disposeRun(args[0], args[1], { replacementRunId: args[2] || null }); break;
    case 'restore': out = await ws.restoreRun(args[0]); break;
    case 'research-record': out = await ws.recordResearch(args[0], await file(args[1])); break;
    case 'exec': out = await ws.execute(args[0], args[1]); break;
    default: throw new WstackError(`Unknown command: ${command}\n\n${HELP}`, 'USAGE');
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}
main().catch(e => { process.stderr.write(`${e.code || 'ERROR'}: ${e.message}\n`); process.exitCode = 1; });
