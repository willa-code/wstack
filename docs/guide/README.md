# wstack guide

wstack is a workflow for development and AI evaluation. Skills guide the
agent; the pinned runtime records valid, replayable state in `.wstack/`. Read
these pages in order:

1. [Getting started](01-getting-started.md) — install or upgrade the runtime
   and start a run.
2. [Skill catalog](02-skill-catalog.md) — the public kernel and its boundaries.
3. [Workflow map](03-workflow-map.md) — the continuous flow and evaluation
   boundaries.
4. [Durable state](04-durable-state.md) — the run-centric protocol and
   generated views.
5. [Skill model](05-skill-model.md) — how judgment, mechanics, and authority
   divide responsibilities.
6. [Implementation status](../IMPLEMENTATION-STATUS.md) — enforced behavior,
   harness responsibilities, evidence limits, and remaining demonstrations.
7. [v2 migration](../MIGRATION-v2.md) — mapping from the retired skill surface
   and migrating existing state.

The [root README](../../README.md) is the short introduction. The individual
[`SKILL.md`](../../skills/w-mode/SKILL.md) files are the operational contracts
agents load when a skill is invoked.

## The one-minute version

Invoke [w-mode](../../skills/w-mode/SKILL.md) with an outcome and its proof, or
let the model enter it automatically for substantial work. It discovers and
resumes a matching active run, or classifies and starts one, then advances through
the next real gate until a user decision, authority boundary, replan, or
terminal predicate is reached. Invoke
[setup-wstack](../../skills/setup-wstack/SKILL.md) explicitly once per
repository to install the pinned runtime, establish `.wstack/`, and manage
marked `AGENTS.md`/`CLAUDE.md` guidance.

Engineering verification, product evaluation, and agent evaluation share
provenance and freshness mechanics but remain separate claims. A passing test
does not become a product verdict, and a product verdict does not prove that
the coding-agent suite improved.
