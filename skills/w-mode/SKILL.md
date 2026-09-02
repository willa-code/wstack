---
name: w-mode
description: "Run substantial development, evaluation, or decision-grade research through wstack's typed, resumable protocol. Use automatically for durable multi-step work, consequential research, coordinated execution, or work needing recorded proof; keep small lookups and isolated reversible edits outside it."
---

# W-mode

Use wstack as the operating system for substantial work. Enter automatically
when observable scope, consequence, coordination, resumability, or proof needs
make durable state valuable. Announce the reason, selected workflow, and run
choice, then continue. Once active, keep it active until the run ends or the
user opts out for the task or run.

## Start from state

Read `.wstack/config.json`, inspect Git state, and use `wstack runs` before
creating a run. Resume one clearly matching active run; ask the user to choose
when several plausibly match; create a distinct run when none match. Do not
select by recency alone, and do not resume a retired run without a recorded
restore. If setup is missing or incompatible, preserve the request, explain
the gate, and ask the user to invoke
[setup-wstack](../setup-wstack/SKILL.md); never run setup implicitly.

Classify the request as lightweight, structured, or program using
[adaptive rigor](references/adaptive-rigor.md). Record the observable factors
and any user override. Select exactly one workflow graph from
[workflows/](references/workflows/README.md), then use its exact concrete
runtime workflow ID. The shared refactor/migration graph maps to the separate
`refactor` and `migration` IDs; `refactor-migration` is not a runnable ID.

Small explanations, quick factual lookups, casual summaries, and isolated
reversible edits stay outside w-mode. Borderline work stays outside unless the
user explicitly invokes w-mode.

## Advance continuously

The runtime owns canonical transitions, accepted artifact revisions, claims,
leases, events, receipts, freshness, and generated views. Skills and agents
supply judgment and proposed artifacts; never edit canonical events or derived
status directly.

Read [durable results](references/recording.md). Inside an active run, every
meaningful decision, change, proof, failure, or delivery result must be recorded
through its typed runtime command before it is reported complete. Do not log a
skill invocation or read-only no-op merely to prove activity.

Advance until one of these conditions is true:

- a product decision or required specification approval belongs to the user;
- the run lacks authority for an external or irreversible action;
- the exit predicate fails after its retry budget and needs replanning;
- infrastructure triggers the workflow's stop line;
- the workflow reaches its terminal predicate.

Before a gate that asks the user to review or approve durable state, regenerate
`review.md` and `explorer.html` with `wstack view <run>` and point to the readable
review rather than a raw canonical JSON file.

A user stop preserves current state and remaining uncertainty. It does not
turn blocked, incomplete, or inconclusive work into a successful terminal
result.

A precise lightweight request may serve as specification approval. Structured
and program runs require explicit approval of the acceptance contract. Task
decomposition remains an engineering decision unless policy says otherwise.

When a required product or design decision is unresolved, record a grill gate
and enter [grill](../grill/SKILL.md) in the same run. Grill remains
confirmation-gated: after the user confirms shared understanding, clear the
gate and resume the same run. Never bypass the user's decision or authority
boundary.

## Shared invariants

Read only the references activated by the selected workflow:

- [Lifecycle and state](references/lifecycle.md)
- [Authority profiles](references/authority.md)
- [Evidence and freshness](references/evidence.md)
- [Coordinator and workers](references/coordination.md)
- [Principles](references/principles.md)

Facts are discovered by the agent. Consequential product decisions are put to
the human. Reversible work proceeds inside recorded authority. Remote systems
are projections of canonical `.wstack/` state.

## Reply

Lead with the outcome or current gate. Report the run ID, lifecycle state,
acceptance coverage, stale or blocked evidence, authority needed, and exact
next action. Do not replace deterministic status with narrative.
