---
name: implement-run
description: "Execute a validated task graph through isolated ownership, idempotent transitions, bounded retries, completion bundles, and evidence-backed checkpoints."
---

# Implement run

Execute the active graph through the project runtime. One coordinator owns
canonical event ingestion. Workers may run locally or in cloud checkouts, but
each receives a frozen brief hash and exclusive task and resource claim.
Concurrent writers use isolated worktrees or branches; overlapping live claims
are a hard failure unless the graph serializes them.

Use deterministic commands through the runtime when policy allows. Engineering
bundles bind commits; decision-research bundles bind the current accepted
grounding artifact comparison and contain no invented code commit. Interactive
or tool-driven work returns the same typed completion bundle: commit or
artifact identities, receipts, evidence manifests, deviations, and proposed
events. The coordinator validates and imports bundles idempotently.

Classify failures before retrying. Retry at most twice by default with a
changed strategy appropriate to the failure, then mark the unit needs-replan.
Never weaken the acceptance predicate to declare success. Infrastructure-wide
failure activates the run stop line.

A task is implemented only when its accepted output exists. It is not complete
until [verify-review](../verify-review/SKILL.md) records fresh required evidence.
Claims, retries, comparison bindings, completion bundles, receipts, and task
completion must be recorded through the runtime; do not log every worker action.
