# Workflow map

Every run uses one shared lifecycle and one continuous control loop:

```text
request
  ↓
w-mode: discover/resume run + classify tier + select workflow + frame outcome
  ↓
ground → specify → plan (when required) → assign
  ↓
implement → verify → review
  ↓
authorized delivery projection or an explicit gate/replan
```

The runtime records the state transitions and evidence. Skills supply
judgment at the boundaries and keep advancing until a user decision, missing
authority, failed exit predicate, infrastructure stop-line, or terminal
predicate requires a pause.

## Shared lifecycle

```text
FRAMED → GROUNDED → SPECIFIED → PLANNED → ASSIGNED
       → IMPLEMENTED → VERIFIED → REVIEWED → DELIVERED
```

The lifecycle has stable meanings; workflow graphs add required artifacts and
allowed skips. Pause, gate, retry, failure, and staleness are orthogonal
conditions. See [lifecycle](../../skills/w-mode/references/lifecycle.md) and
[adaptive rigor](../../skills/w-mode/references/adaptive-rigor.md).

## Adaptive tiers

- **Lightweight:** one owner and one localized surface; a precise originating
  request may approve the minimal contract and same-agent deterministic proof.
- **Structured:** multi-step or cross-cutting work; explicit specification
  approval, task/resource graph, independent verification, and separate
  specification-fidelity and standards reviews.
- **Program:** coordinated tracks or evolving dependencies; coordinator lease,
  bounded rolling fan-out, completion bundles, an independent verification
  queue, and a durable stop-line.

The highest material risk factor selects the tier. A user may lower it only
with a recorded residual-risk override; lowering ceremony never lowers the
authority boundary or fresh-evidence requirement.

## Workflow boundaries

Select by the terminal decision, not the activity performed:

| Decision | Graph |
|---|---|
| Deliver a new capability | [feature](../../skills/w-mode/references/workflows/feature.md) |
| Restore violated behavior | [bug](../../skills/w-mode/references/workflows/bug.md) |
| Preserve behavior while changing structure (`refactor`) | [refactor/migration](../../skills/w-mode/references/workflows/refactor-migration.md) |
| Move between interfaces, schemas, storage, or dependencies (`migration`) | [refactor/migration](../../skills/w-mode/references/workflows/refactor-migration.md) |
| Improve one measured property | [hillclimb](../../skills/w-mode/references/workflows/hillclimb.md) |
| Judge probabilistic product behavior offline | [product evaluation](../../skills/w-mode/references/workflows/product-evaluation.md) |
| Judge a coding-agent system change | [agent evaluation](../../skills/w-mode/references/workflows/agent-evaluation.md) |
| Produce a hypothesis-led decision brief | [decision research](../../skills/w-mode/references/workflows/decision-research.md) |

Product evaluation judges a fixed evidence portfolio and produces
`approve`, `reject`, or `inconclusive`; it does not prove production impact.
Agent evaluation blinds candidate variants and judges actual files read and
artifacts; it does not promote suite defaults without repeated evidence and
explicit approval. A deterministic defect found during either evaluation is a
separate bug run.

Use engineering verification to ask “does this code meet its acceptance
contract?”, product evaluation to ask “is this probabilistic product behavior
good enough?”, and agent evaluation to ask “did this coding-agent change help?”
Decision research asks which action is best supported by competing hypotheses,
counterevidence, and a proportional stopping rule.
The table names all eight concrete runtime IDs. `refactor` and `migration`
share one design graph; `refactor-migration` is only its filename.
The low-cost default is one changed surface for verification, one narrow
baseline/candidate decision for product evaluation, and one blinded project and
prompt for agent evaluation. Scale only when risk or uncertainty requires it.

## Delivery and continuity

[open-pr](../../skills/open-pr/SKILL.md) is an optional delivery specialist.
Preparing local commits and a description is distinct from pushing, publishing,
merging, deploying, or messaging externally. Those capabilities require an
authority grant. GitHub observations are reconciled as a projection of
canonical `.wstack/` state.

[continue-work](../../skills/continue-work/SKILL.md) renders a handoff from
replayed events. A local or cloud worker returns a typed completion bundle;
only the lease-holding coordinator imports it. Takeover requires authorized
release or lease expiry and a recorded takeover event.

The runtime is intentionally passive: there is no daemon to keep alive. A
host-specific heartbeat, queue consumer, CI job, or scheduled wake may call
the CLI, replay the run, write an iteration checkpoint, and advance one legal
step. If no wake adapter is available, a human or agent can invoke the same
commands manually; the durable event log remains authoritative.
