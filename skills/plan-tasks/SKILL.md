---
name: plan-tasks
description: "Compile an accepted specification into a validated DAG of vertical, independently verifiable tasks with acceptance references, resource ownership, and a computable frontier."
---

# Plan tasks

Create a task graph for the active specification revision. Each task has a
stable ID, goal, acceptance references, blocker IDs, writable resources,
verification requirements, retry budget, and expected completion bundle. Do
not copy acceptance meaning into tasks.

Prefer vertical tracer bullets that end in demonstrable behavior. Use
expand-migrate-contract only when a wide mechanical change cannot remain green
as vertical slices. The runtime must reject cycles, dangling references,
uncovered required acceptance criteria, conflicting parallel resource claims,
or a stored frontier that differs from the computed one.

For decision research, partition tasks by disjoint evidence, falsification,
synthesis, or challenge scopes. Every task must trace to the accepted research
contract and return provenance plus support, contradiction, or
non-discrimination—not a volume of links. Keep synthesis downstream of the
evidence it depends on.

Generate each worker brief from the accepted specification, task, ownership
claim, authority profile, standing orders, and verifier requirements. Briefs
are projections, not independently authored sources of truth.

Record the validated graph with `tasks-set`. A plan that exists only in chat is
not an executable run plan.
