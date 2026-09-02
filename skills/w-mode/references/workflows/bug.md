# Bug workflow

**Entry:** observed behavior violates an existing contract or reasonable
expectation. A performance target with iterative search uses
[hillclimb.md](hillclimb.md); an intentional behavior change uses
[feature.md](feature.md).

**Required artifacts:** original report; matching-surface failing reproduction;
hypothesis ledger; runtime evidence for the surviving causal mechanism;
minimal fix specification and acceptance IDs; task/resource graph when the
tier requires it; failing-then-passing receipts; candidate comparison point;
reviews; delivery projection.

**Transitions:** `FRAMED` fixes the failure and exit predicate. `GROUNDED`
includes behavior, history, eliminated hypotheses, and confirmed mechanism.
`SPECIFIED` freezes the smallest root-cause correction. `PLANNED` selects
minimal acceptance-linked units; `ASSIGNED` grants isolated ownership;
`IMPLEMENTED` fixes the candidate point; `VERIFIED` binds passing evidence to
the original reproduction; `REVIEWED` resolves causal-fit and standards axes;
`DELIVERED` reaches the authorized publication state. Meanings follow
[../lifecycle.md](../lifecycle.md).

**Allowed skips:** `PLANNED` may skip for a localized single-owner fix.
Reproduction may not skip; inability to reproduce produces a gated
investigation, never an implemented fix.

**Gates:** ambiguous expected behavior; no credible reproduction after
instrumentation; evidence points to a materially broader product decision;
authority beyond the active profile.

**Evidence and review:** retain the original failure before editing. Prefer a
failing deterministic regression test when it calls the real faulty path; for
external behavior, rerun the exact matching-surface reproduction. A unit pass
cannot replace an external repro. Review causal fit and scope under spec
fidelity, then repository standards separately. Any changed fix invalidates
affected passing evidence.

**Terminal condition:** the original reproduction passes at the current
comparison point, the regression path remains green, no shipped line lacks a
causal justification, reviews resolve, and delivery reaches its authority
boundary.

**Reply projection:** symptom; confirmed root cause and eliminated plausible
alternative; smallest fix; verbatim or linked failing/passing evidence;
remaining limitation; delivery state.
