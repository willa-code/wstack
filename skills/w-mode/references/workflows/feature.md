# Feature workflow

**Entry:** a new user-visible or system capability. Unsettled product intent
enters the design-tree interview before `FRAMED`; a one-metric optimization
uses [hillclimb.md](hillclimb.md).

**Required artifacts:** outcome and exit predicate; grounding record; accepted
specification with acceptance IDs, claimed surfaces, and evidence classes;
design decision when alternatives are material; task/resource graph for
structured or program tiers; candidate comparison point; receipts; spec and
standards reviews; delivery projection. Structured and program runs also
record a throughput checkpoint: the smallest vertical unit that can prove
progress, the expected verification cost, and the decision to continue,
serialize, or split the remaining work.

**Transitions:** `FRAMED` fixes outcome and exit predicate; `GROUNDED` records
current subsystem behavior and rationale; `SPECIFIED` accepts capability and
evidence contracts; `PLANNED` creates vertical acceptance-linked units;
`ASSIGNED` grants isolated ownership; `IMPLEMENTED` fixes the candidate point;
`VERIFIED` closes acceptance coverage; `REVIEWED` resolves required axes; and
`DELIVERED` reaches the authorized publication state. These are the shared
lifecycle meanings in [../lifecycle.md](../lifecycle.md).

**Allowed skips:** lightweight work may skip a separate task graph when one
owner, one localized change, and direct acceptance coverage are recorded.
Design exploration may skip only when repository precedent makes the shape
unambiguous. Grounding, specification, matching-surface proof, and both review
axes never skip.

**Gates:** explicit specification approval for structured/program tiers;
product or preference forks; authority beyond the active profile; verifier
creation when an externally observable claim has no credible project verifier.

**Evidence and review:** use a cheap deterministic seam during implementation
when available, then prove every externally observable criterion through its
declared CLI, UI, API, storage, or integration surface. Structured/program
runs require an independent verifier at the current comparison point. Review
specification fidelity and repository standards separately; risk may add
security, performance, migration, accessibility, or adversarial axes.

**Terminal condition:** every accepted criterion has fresh evidence of the
required class, blocking findings are resolved or gated, the exit predicate is
true, and delivery has reached its authorized boundary.

**Reply projection:** capability delivered; key design choice and rejected
alternative; acceptance coverage and limitations; blocking gates or open
decisions; delivery state and next action.
