---
name: continue-work
description: "Pause, hand off, resume, or take over a wstack run using durable runtime events and regenerated views. Use for session boundaries, context loss, local/cloud transfer, coordinator recovery, or continuing prior work without redoing it."
---

# Continue Work

Continuity is one protocol with three operations: pause records a safe boundary,
handoff renders current truth, and pickup reconstructs before advancing. The
event log and accepted artifacts are authoritative; conversation summaries and
generated handoffs are views.

## Route the operation

- **Pause:** finish or back out of the current atomic step, start nothing new,
  record a pause event, release or preserve claims according to policy, and
  regenerate the handoff view.
- **Handoff:** regenerate the run's Markdown and JSON handoff views from runtime
  state at every session or context boundary. Point to durable artifacts
  instead of copying their contents; include the exact next action, current
  frontier, claims, gates, retries, comparison point, and evidence freshness.
- **Review:** regenerate `views/review.md` and the self-contained
  `views/explorer.html` with `wstack view <run>`. Use `--open` only when the
  user wants the local explorer opened.
- **Pickup:** replay events, validate derived views and environment identity,
  check active claims and fresh load-bearing evidence, then route the exact next
  transition.
- **Takeover:** acquire coordinator authority only after authorized release or
  lease expiry. Read [references/recovery.md](references/recovery.md).

## Pause safely

Do not cross an external or irreversible boundary merely to make pausing neat.
The authority profile decides whether a local checkpoint commit is allowed.
Never create an unauthorized push, PR, message, merge, deployment, deletion, or
credential-bearing artifact.

Record the current lifecycle position, active unit and atomic boundary, working
tree/commit identity, owned resources, claims and leases, fresh and stale
receipts, gates, decisions, retry state, and next eligible action. Secrets and
raw sensitive evidence stay out of committed views.

## Resume from facts

Read the latest generated overview or review, then its referenced accepted artifacts and
recent events. Do not re-derive settled intent or redo completed work. Treat
prior narrative as a claim: cheaply validate the environment, comparison point,
active ownership, and any evidence required by the next transition. If a view
does not match replayed state, regenerate it rather than editing it.

Workers running in cloud or isolated checkouts return completion bundles. They
never append canonical events directly. The coordinator validates contract
hashes, ownership, receipts, and event IDs before idempotent import.

## Completion

A pause or handoff completes when the runtime can reconstruct the same state
without conversation context and the generated view names one exact next
action. A pickup completes when coordinator authority, environment, claims,
freshness, and resume transition are validated. Report inherited versus redone
work, any recovery performed, current gate, and next action.

Pause, resume, gate, takeover, and dispositions are durable events. Status,
handoff, review, and explorer files are regenerated views, so a read-only
refresh does not need a new event. A retired run requires an explicit
user-confirmed restore before pickup.
