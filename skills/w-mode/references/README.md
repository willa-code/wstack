# W-mode reference map

Load only the references needed for the current decision.

| Need | Read |
|---|---|
| Classify work | [adaptive-rigor.md](adaptive-rigor.md) |
| Advance or reconstruct a run | [lifecycle.md](lifecycle.md) |
| Decide whether an action is permitted | [authority.md](authority.md) |
| Accept, invalidate, or report proof | [evidence.md](evidence.md) |
| Run decision-grade research | [workflows/decision-research.md](workflows/decision-research.md) |
| Decide whether a skill result needs a durable record | [recording.md](recording.md) |
| Delegate, parallelize, resume, or use cloud workers | [coordination.md](coordination.md) |
| Apply named engineering judgment | [principles.md](principles.md) |
| Publish issues/PRs or observe delivery | [delivery.md](delivery.md) |

Choose exactly one primary graph from the [workflow index](workflows/README.md).

All workflows inherit shared lifecycle, authority, evidence, recording, and
coordination rules. Workflow text may strengthen but never weaken them.

## Activation map

The graph is the primary reference. Load the following shared references only
when the graph or decision needs them; the runtime remains the single source
of truth for whether a transition is legal.

| Workflow | Always load | Load when triggered |
|---|---|---|
| Feature | `lifecycle.md`, `authority.md`, `evidence.md` | `principles.md`, `coordination.md`, `delivery.md` |
| Bug | `lifecycle.md`, `authority.md`, `evidence.md` | `principles.md`, `coordination.md`, `delivery.md` |
| Refactor/migration | `lifecycle.md`, `authority.md`, `evidence.md` | `principles.md`, `coordination.md`, `delivery.md` |
| Hillclimb | `lifecycle.md`, `authority.md`, `evidence.md` | `principles.md`, `coordination.md`, `delivery.md` |
| Product evaluation | `lifecycle.md`, `authority.md`, `evidence.md` | `principles.md`, `coordination.md`, `delivery.md` |
| Agent evaluation | `lifecycle.md`, `authority.md`, `evidence.md` | `principles.md`, `coordination.md`, `delivery.md` |
| Decision research | `lifecycle.md`, `authority.md`, `evidence.md`, `workflows/decision-research.md` | `principles.md`, `coordination.md`, `delivery.md` |

`coordination.md` is required for more than one worker, a cloud checkout,
handoff, retry, or program-tier run. `delivery.md` is required for any issue,
PR, push, merge, deploy, or remote observation. `principles.md` is loaded by
the active trigger rather than as a generic checklist. This activation map is
an attention-budget rule, not permission to omit a runtime gate.
