# Skill catalog

The public surface is intentionally small. The names below are the skills
agents and users should invoke; workflow-specific behavior lives in
`w-mode`'s references and is not another skill to remember.

## Entry and routing

| Skill | Role |
|---|---|
| [setup-wstack](../../skills/setup-wstack/SKILL.md) | Install or upgrade the pinned workspace runtime and establish project policy. |
| [w-mode](../../skills/w-mode/SKILL.md) | Classify work, select one workflow graph, and advance continuously through the protocol. |
| [grill](../../skills/grill/SKILL.md) | Resolve unsettled consequential intent and persist confirmed decisions. |

## Core flow

| Skill | Role |
|---|---|
| [specify](../../skills/specify/SKILL.md) | Compile confirmed intent into a versioned acceptance contract. |
| [plan-tasks](../../skills/plan-tasks/SKILL.md) | Compile the contract into an acceptance-linked, resource-aware DAG. |
| [implement-run](../../skills/implement-run/SKILL.md) | Execute owned units with leases, bounded retries, bundles, and checkpoints. |
| [verify-review](../../skills/verify-review/SKILL.md) | Run or maintain the project verifier and perform independent review. |
| [continue-work](../../skills/continue-work/SKILL.md) | Pause, hand off, resume, or take over through replayable runtime state. |
| [learn](../../skills/learn/SKILL.md) | Evaluate repeated failures and promote approved suite improvements. |

## Standalone specialists

| Skill | Role |
|---|---|
| [understand](../../skills/understand/SKILL.md) | Explain mechanics, rationale, constraints, and failure paths from evidence. |
| [prototype](../../skills/prototype/SKILL.md) | Compare disposable probes or sketches against a predeclared rule. |
| [tdd](../../skills/tdd/SKILL.md) | Drive deterministic implementation from a public seam. |
| [open-pr](../../skills/open-pr/SKILL.md) | Prepare or publish a GitHub delivery projection under explicit authority. |

## Invocation rule

Setup is the sole human-only entry point:

- `setup-wstack` — intentionally install or upgrade wstack.
- `grill` — model-invokable when consequential decisions remain unresolved.
- `w-mode` — model-invokable for substantial work and explicit start/resume.

Setup cannot be selected implicitly because it changes repository instructions
and configuration. W-mode may enter automatically for substantial work, and it
enters grill when unresolved consequential intent requires the user's answers.
Grill returns to the same run after confirmation.

The runtime owns transitions, accepted artifact revisions, idempotency,
claims, coordinator leases, receipts, freshness, and derived views. Skills
provide reasoning, decisions, artifacts, and proposed events. They must not
edit canonical events or derived status directly. `disable-model-invocation`
metadata remains the source of truth for the setup boundary.

Record durable results, not invocations. Decisions, changes, failures, proof,
reviews, evaluations, and delivery belong in typed `.wstack/` records. Opening
a skill, reading state, or regenerating a view does not need a new event.

Feature, bug, shared refactor/migration, hillclimb, product-evaluation,
agent-evaluation, and decision-research are the seven workflow graphs under
[`w-mode/references/workflows`](../../skills/w-mode/references/workflows/README.md),
not public entry points. They map to the concrete runtime IDs `feature`, `bug`,
`refactor`, `migration`, `hillclimb`, `product-evaluation`,
`agent-evaluation`, and `decision-research`; the shared graph name
`refactor-migration` is not a runtime ID. Evaluation graphs deliberately do
not collapse into ordinary engineering verification.
