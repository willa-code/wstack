# Getting started

## Set up the repository

Invoke [setup-wstack](../../skills/setup-wstack/SKILL.md) explicitly. It inspects existing
instructions, Git state, project commands, verification surfaces, and legacy
records; installs the pinned dependency-free runtime under `.wstack/bin/`; and
records the authority and durable-state policy. It creates or updates marked
guidance in root `AGENTS.md` and `CLAUDE.md`, and existing nested files with
those exact names. Setup is idempotent and preserves user content.

After setup, the installed runtime exposes its actual command surface:

```text
node .wstack/bin/wstack.mjs help
```

The runtime can initialize state, create and inspect runs, advance lifecycle
states, accept immutable artifacts, validate task DAGs, manage gates and
leases, record receipts, import worker bundles, render handoffs, and execute
allowlisted deterministic commands. See [durable state](04-durable-state.md)
for what those records mean.

## Choose where to start

Start substantial development, evaluation, or decision-grade research with
[w-mode](../../skills/w-mode/SKILL.md). The model may enter it automatically
when the request is multi-step, consequential, evidence-bound, or resumable.
It lists runs, resumes a clearly matching active run, asks you to choose when
matches are ambiguous, and creates a new run only for distinct work.

If important product or design decisions are unsettled, `w-mode` enters
[grill](../../skills/grill/SKILL.md) in the same run. Grill records the decision
tree in grounding and stops when you confirm shared understanding, then
w-mode continues from specification.

```text
Unsettled idea: w-mode → grill gate → grill → confirm → w-mode resumes
Clear feature:   w-mode → specify → plan → implement → verify
```

You may invoke `grill` directly, but consequential grill work always establishes
or joins the appropriate w-mode run and never creates a parallel state system.
Setup remains explicit-only.

## Start the continuous flow

Invoke `w-mode` with the outcome, constraints,
and proof you expect:

```text
w-mode add JSON output to this command. Existing text output must remain
byte-for-byte identical. Verify both output paths.
```

```text
w-mode reproduce the duplicate notification after a retry, fix the root
cause, and verify the original path and the retry path.
```

The router selects one of seven workflow graphs—feature, bug, shared
refactor/migration, hillclimb, product evaluation, agent evaluation, or
decision research—and keeps moving through the shared lifecycle. Those graphs
map to eight runtime IDs: `feature`, `bug`, `refactor`, `migration`,
`hillclimb`, `product-evaluation`, `agent-evaluation`, and
`decision-research`. You do not need to name every phase skill.

For an AI product decision:

```text
w-mode decide whether the candidate improves answer completeness without
increasing unsupported claims. Use the current production prompt as baseline.
```

For a coding-agent change:

```text
w-mode decide whether this skill revision improves task completion without
increasing unauthorized edits. Compare it blindly with the current skill.
```

## Use a direct specialist when the boundary is known

- [grill](../../skills/grill/SKILL.md) resolves consequential product or
  design decisions and waits for confirmation.
- [understand](../../skills/understand/SKILL.md) builds a grounded mechanics
  and rationale model without mutating the repository.
- [prototype](../../skills/prototype/SKILL.md) answers a design question with
  disposable evidence.
- [tdd](../../skills/tdd/SKILL.md) proves a deterministic seam through a
  red-green-refactor loop.
- [open-pr](../../skills/open-pr/SKILL.md) prepares or publishes a verified
  delivery projection when the run grants that authority.

The core phases are [specify](../../skills/specify/SKILL.md),
[plan-tasks](../../skills/plan-tasks/SKILL.md),
[implement-run](../../skills/implement-run/SKILL.md), and
[verify-review](../../skills/verify-review/SKILL.md). Use
[continue-work](../../skills/continue-work/SKILL.md) at a session or
coordinator boundary and [learn](../../skills/learn/SKILL.md) only to propose
suite changes backed by repeated evidence.

Inside an active run, every meaningful result is recorded through the runtime.
A casual read-only specialist call may remain ephemeral. If its result must be
resumed or audited, start a lightweight run rather than relying on chat history.

## Verify the real claim

Verification records typed receipts bound to the specification revision,
comparison point, verifier, procedure, environment, and evidence. Terminal
eligibility requires fresh coverage of every required acceptance criterion,
resolved review findings, and a true exit predicate. A worker's completion
message is provenance, not independent proof.
