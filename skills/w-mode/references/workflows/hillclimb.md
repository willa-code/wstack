# Hillclimb workflow

**Entry:** sustained improvement of one measurable property against a target.
A single known defect uses [bug.md](bug.md); multiple product-quality criteria
use [product-evaluation.md](product-evaluation.md).

**Required artifacts:** realistic workload; one metric and direction; target
plus minimum-attempt stop predicate; sensitivity proof; frozen harness identity;
immutable baseline; append-only attempt ledger; one comparison point and
receipt set per kept attempt; regression guards; reviews; delivery projection.

**Transitions:** `FRAMED` fixes target, direction, attempt floor, and stop rule.
`GROUNDED` models workload and likely mechanisms. `SPECIFIED` freezes metric,
harness, noise treatment, and regression guards. `PLANNED` is a live hypothesis
frontier rather than a fixed implementation DAG. Each attempt cycles through
assignment, implementation, verification, and keep/revert before another
attempt. Changing the harness creates a successor baseline and stales all
earlier comparisons.

**Allowed skips:** a separate fixed task DAG may skip because the hypothesis
frontier is live. Design exploration, sensitivity proof, attempt logging,
per-attempt measurement, and regression guards never skip or collapse into
stacked, untested changes.

**Gates:** user numbers are absent and target choice is consequential; harness
cannot distinguish contrasting workloads; correctness guard conflicts with the
metric; remaining hypotheses require scope or authority expansion.

**Evidence and review:** one mechanism-grounded change per attempt; measure
with the frozen harness beyond declared noise; run every regression guard;
keep only a material improvement with green guards, otherwise revert in full.
Independent hypotheses may race in isolated checkouts, but only validated
winners enter the canonical line. Review final spec fidelity, standards, and
performance methodology.

**Terminal condition:** target and minimum-attempt floor both pass, or the run
ends in an explicit `needs-replan` with non-marginal ideas exhausted; accepted
commits retain fresh measurements and guards; reviews resolve; delivery reaches
its authority boundary. The predicate is never relaxed to claim success.

**Reply projection:** metric, workload, target, baseline-to-final delta;
attempts kept/reverted; accepted mechanisms; harness/ledger paths; stop reason;
best remaining idea and delivery state.
