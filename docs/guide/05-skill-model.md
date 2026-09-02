# Skill model

wstack has a narrow public kernel and a strict responsibility split:

```text
skills: judgment, routing, decisions, artifacts, proposed events
                         ↓
runtime: schemas, lifecycle, idempotency, ownership, receipts, freshness
                         ↓
views: status, handoff, reports, GitHub projection
```

A “worker” is not a wstack service. It is the agent assigned a bounded task.
The current agent can be both coordinator and worker for small work; a host may
launch separate local or cloud agents for larger work. wstack validates their
ownership and returned results but does not launch them.

## Judgment versus mechanics

[w-mode](../../skills/w-mode/SKILL.md) discovers or resumes runs, reads only the
references activated by the selected workflow, and classifies adaptive rigor.
[grill](../../skills/grill/SKILL.md)
handles consequential product/design choices. [understand](../../skills/understand/SKILL.md)
grounds mechanics and rationale. [prototype](../../skills/prototype/SKILL.md)
settles empirical uncertainty. [tdd](../../skills/tdd/SKILL.md) gives a cheap
deterministic implementation loop.

[specify](../../skills/specify/SKILL.md) freezes acceptance meaning;
[plan-tasks](../../skills/plan-tasks/SKILL.md) freezes executable ownership;
[implement-run](../../skills/implement-run/SKILL.md) drives workers and
completion bundles; and [verify-review](../../skills/verify-review/SKILL.md)
proves the real surface and reviews the fixed comparison point.

[continue-work](../../skills/continue-work/SKILL.md) treats pause, handoff,
pickup, and takeover as one recovery protocol. [open-pr](../../skills/open-pr/SKILL.md)
is deliberately standalone because remote delivery is an authority boundary.
[learn](../../skills/learn/SKILL.md) is deliberately downstream of evidence:
it proposes suite changes but cannot silently change defaults.

## Progressive loading

The shared references under `w-mode/references/` define lifecycle, adaptive
tiers, authority profiles, evidence algebra, coordination, principles, and the
seven workflow graphs. Those graphs map to eight concrete runtime IDs because
`refactor` and `migration` share one graph. Load the selected graph and only the
shared references it activates. This keeps the context small without weakening
the protocol.

## Non-negotiable invariants

- Canonical state is append-only and replayable; views are regenerated.
- Accepted artifacts and specification revisions are immutable.
- A single lease-holding coordinator imports canonical worker events.
- Claims are exclusive over overlapping writable resources.
- Receipt freshness is computed from bound inputs, not narrative.
- Independent matching-surface evidence is required where the tier demands it.
- Authority never widens through a brief, retry, workflow, or remote projection.
- Remote systems are projections; `.wstack/` remains canonical.

The complete old surface and its migration destinations are in
[MIGRATION-v2.md](../MIGRATION-v2.md).
