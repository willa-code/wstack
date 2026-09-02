# Lifecycle and adaptive rigor

Every run uses one stable lifecycle. Workflow graphs specialize its required
artifacts and allowed transitions; they do not redefine the meanings below.

```text
FRAMED -> GROUNDED -> SPECIFIED -> PLANNED -> ASSIGNED
       -> IMPLEMENTED -> VERIFIED -> REVIEWED -> DELIVERED
```

`FRAMED` records the falsifiable outcome and exit predicate. `GROUNDED`
records current behavior and relevant rationale. `SPECIFIED` freezes an
accepted behavioral contract. `PLANNED` freezes a dependency graph with
acceptance coverage. `ASSIGNED` means every active unit has a valid owner and
contract hash. `IMPLEMENTED` means the candidate exists at an immutable
comparison point. `VERIFIED` means required acceptance evidence is fresh.
`REVIEWED` means all required review axes are resolved. `DELIVERED` means the
authorized delivery projection has reached its terminal state.

Pause, retry, gate, failure, staleness, and activity are orthogonal conditions,
not lifecycle states. An accepted artifact is immutable; an amendment creates
a successor revision and stales dependent claims. A skipped lifecycle stage
is an event with `stage`, `reason`, `authority`, and `consequence`, never an
absent record. Derived status is rebuilt from accepted artifacts and events.

Abandonment and supersession are also orthogonal dispositions, not lifecycle
states. They retire a run from automatic discovery without deleting history;
`restored` makes one active again. Each disposition is append-only,
user-confirmed, and visible in status, handoff, review, and run-list views.

For decision research, `IMPLEMENTED` binds an immutable accepted grounding
artifact rather than a code commit, and `DELIVERED` requires a current
`research-outcome` of `decision-ready` or `inconclusive`. The workflow reference
defines the remaining stage meanings and review requirements.

Select the minimum enforced lifecycle gates through
[adaptive-rigor.md](adaptive-rigor.md). All tiers share the terminal proof
rule in [evidence.md](evidence.md) and the capability boundary in
[authority.md](authority.md). Ceremony may shrink; fresh acceptance coverage
may not.
