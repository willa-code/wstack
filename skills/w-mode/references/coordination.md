# Coordinator, workers, and portable execution

“Local” means the workspace-resident canonical coordinator and/or a checkout
with the project files. It does not mean every worker must be local: workers
may run in isolated hosted/cloud checkouts and return bundles. One
lease-holding coordinator is the sole importer of canonical run events; its
location is irrelevant and may change after a checkpoint.

The coordinator derives the ready frontier, grants exclusive resource claims,
issues worker contracts, imports completions, schedules independent
verification, and applies retry/replan policy. Structured and program workers
write only in isolated checkouts. Overlapping writable paths or resources
must be serialized by the task graph; the engine refuses overlapping live
claims. Workers never mutate canonical run records or delivery topology. The
runtime is passive and has no daemon: an optional host heartbeat, queue
consumer, CI job, or scheduled wake may invoke the CLI to advance the loop.
Such adapters are replay-safe prompts, not sources of truth; each wake must
first replay state, record its checkpoint, and then take the next legal
transition.

## Worker contract

A generated worker brief projects the accepted spec revision, task and
acceptance IDs, base comparison point, writable resources, blockers,
authority, required evidence, verify procedure, timebox, forbidden actions,
report shape, standing orders, and contract hash. The worker refuses a
missing, mismatched, or stale contract.

## Completion bundle

A worker returns one typed bundle containing:

- run, task, attempt, contract, base, and resulting commit or accepted-artifact
  comparison identities;
- changed resources and ownership violations, if any;
- receipt and evidence manifests, with self-report clearly identified;
- checks executed and exact outcomes;
- deviations, discovered work, risks, and requested gates;
- proposed events and terminal status: `completed`, `needs-verify`, `failed`,
  or `blocked`.

Import is idempotent by bundle ID. The coordinator validates contract, claim,
base lineage, resource scope, authority, and manifests before emitting events.
Late returns are reconciled against the current frontier; they never rewind it.
At every iteration checkpoint, persist the current frontier, claims, retry
budget, comparison point, and next action so a context boundary can resume
without relying on a transcript.

## Recovery

Coordinator authority uses a renewable lease. Takeover requires authorized
release or expiry, then event replay, claim validation, and a takeover event.
Liveness is inferred from leases, commits, bundles, and external side effects,
not transcript timestamps. Classify failure before retry: resource exhaustion
narrows scope, network failure retries unchanged, tool/runtime failure changes
strategy, and unknown failure retries once diagnostically. Default maximum is
two retries, then `needs-replan`; never weaken the predicate. Shared
infrastructure failure activates a stop-line instead of consuming every unit's
budget.

For program runs, drain completion bundles at scheduling boundaries, update
the derived frontier, then refill a bounded rolling window. Completions are
events, not interruptions.
