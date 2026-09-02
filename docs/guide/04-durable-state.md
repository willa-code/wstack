# Durable state

`.wstack/` is the workspace-resident source of truth. The append-only event
log is canonical; JSON and Markdown status, handoff, and report files are
derived views and may be regenerated. A run can therefore be reconstructed
after a context loss, local/cloud transfer, or coordinator replacement.

## Layout

```text
.wstack/
  config.json                 # protocol, authority, command policy
  bin/                        # pinned runtime (committed)
  context/                    # shared project context
  decisions/                  # confirmed decisions and learning records
  verifiers/                  # versioned verify-<project> packages
  migrations/                 # protocol and legacy-state migration records
  runs/
    <run-id>/
      events.ndjson           # append-only canonical events
      artifacts/              # immutable accepted revisions
      receipts/               # typed evidence manifests
      views/                  # generated status and handoff projections
  evidence/objects/            # content-addressed payloads, by policy
```

Project context, decisions, authority policy, and verifier definitions are
shared. A run owns its event history, accepted artifacts, receipts, and
generated views. This avoids duplicated context while making each run a
traceable unit.

Each `verify-<project>` package is versioned shared project infrastructure: a
machine-readable verifier manifest, feature map, and real-surface procedures
with Launch, Doctor, Journey, Evidence, and Cleanup guidance. Creation and
maintenance belong to [verify-review](../../skills/verify-review/SKILL.md);
the first-run journey must execute against an owned instance before the
package can support terminal proof.

The package reuses the project's existing CLI, API client, browser tests, app
harness, or available agent tools. wstack does not supply a universal browser
or test platform. For ordinary changes, run only the journey that covers the
changed surface and store the smallest useful evidence.

The installed runtime's command surface is discoverable with
`node .wstack/bin/wstack.mjs help`. Its implemented operations include:
`init`, `run-create`, `status`, `transition`, `artifact-add`,
`artifact-approve RUN TYPE ID DIGEST APPROVER`, `tasks-set`, `frontier`,
`gate-set`/`gate-clear`, `authority-grant`, `pause`/`resume`,
`binding-set RUN base|commit DIGEST` (and verifier/procedure/environment
bindings), `coordinator`, `claim`, `task-complete`, `receipt-add`,
`review-add`, `predicate-set RUN true|false EVIDENCE`,
`evaluation-record RUN FILE`, `delivery-record RUN FILE`, `eligible`,
`retry`, `bundle-create`/`bundle-import`,
`projection-request`/`projection-reconcile`, `handoff`, and `exec`. There is
no generic event command that can bypass validated transitions. `exec` runs
only a configured deterministic command under the run's snapshotted authority
profile.

V2.1 adds `wstack runs` for deterministic run summaries and `wstack view RUN`
for regenerated `views/review.md` and self-contained `views/explorer.html`.
Active-run discovery excludes `DELIVERED`, `abandoned`, and `superseded` runs;
paused and gated runs remain active. Retirement and restoration are append-only
dispositions and never delete history.

Each run manifest preserves the protocol that created it. Derived status
exposes that value as `createdProtocolVersion`, exposes the replaying runtime as
`runtimeProtocolVersion`, and marks whether replay crossed a compatible
protocol version. Upgrades never rewrite historical manifests merely to make
their version look current.

The base binding freezes the worker's comparison starting point; structured and
program claims cannot be issued without it. `artifact-approve` approves the
current immutable artifact digest, while `predicate-set` records the evidence
used to evaluate the exit predicate. `evaluation-record` is for the explicit
approve/reject/inconclusive decision of product, agent, or hillclimb workflows;
`delivery-record` records local-ready or an externally reconciled publication,
merge, or deployment state. These records are not interchangeable.

An AI evaluation keeps a simple chain: decision contract → sample manifest →
evaluator definition → baseline/candidate outputs → report → evaluation record.
The final record stores the durable verdict and artifact digests. The report
stores sampling, rubric, uncertainty, guards, privacy, and limitations.

Decision research has its own terminal record: `decision-ready` or
`inconclusive`, bound to the current research contract, grounding, predicate,
and projection. It must identify at least one fresh research receipt in
`receiptIds` and one fresh review in `reviewIds`; terminal eligibility still
requires every acceptance criterion and required review axis to be covered.

## Events, artifacts, and freshness

Events require a type and idempotency key and form a tamper-detecting hash
chain. Repeating a key with the same body is a no-op; a conflicting body fails. Accepted artifacts are immutable
revisions. An amendment creates a successor digest and records staleness for
dependent work.

Receipts bind acceptance IDs, artifact and commit identities, verifier digest,
procedure, environment, producer, and result. Engineering evidence strengthens
from static to deterministic to matching-surface; probabilistic evidence is a
separate evaluation class and never substitutes for deterministic proof. A receipt is stale when any bound input
changes, its payload is unavailable, or the result/status is failed or blocked.
Fresh evidence must exercise the claimed surface; self-report never counts as
independent proof.

Terminal eligibility requires `REVIEWED`, a true exit predicate, complete
tasks, no gates or pause, and fresh evidence for every acceptance criterion at
the required strength. Structured and program runs also require independent
worker/verifier identities.

## Authority and workers

The default safe, risk-based profile permits local edits, branches, commits, and
declared commands. Push, remote publication, merge, deploy, destructive
cleanup, and external messages remain gated. See
[authority profiles](../../skills/w-mode/references/authority.md).

One coordinator lease owns canonical event ingestion. “Local” identifies the
canonical workspace coordinator and/or a workspace-resident checkout; it does
not require every worker to run on that machine. Workers may instead run in
isolated hosted/cloud checkouts, receive a frozen contract hash, and return a
typed completion bundle. The coordinator validates lineage, scope, authority,
receipts, and idempotency before importing it. wstack has no daemon: a CLI,
host harness, or scheduled wake may call `status`/`handoff`/`resume` and drive
the next event. Optional heartbeat or wake adapters are external and must not
be treated as canonical state.
Default retry is bounded at two attempts; repeated failure becomes
`needs-replan`, and infrastructure failure activates a stop-line.

## GitHub and learning

GitHub is an idempotently reconciled delivery projection, never the source of
truth. Remote CI, reviews, and URLs enter `.wstack/` as observations. A changed
head invalidates affected receipts and verdicts before publication.

[learn](../../skills/learn/SKILL.md) promotes no lesson from one anecdote. A
proposal needs recurrence evidence, a root mechanism, the smallest enforcement
change, migration and rollback, a blind comparison against the current
baseline, and explicit approval. Promotion records the protocol and skill
versions so the next run can reproduce the improvement.

Commit semantic state, the pinned runtime, small redacted evidence, manifests,
and generated views. Keep locks, leases, raw logs, inbox scratch, secrets, and
large private payloads out of Git.

Every meaningful outcome inside an active run uses one of these typed records.
Read-only exploration and regenerated views do not create activity events.
