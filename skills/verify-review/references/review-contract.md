# Independent Review Contract

Review one immutable comparison point. Refresh the point before starting; if it
changes during review, the verdict is stale and must not be promoted.

## Required axes

### Specification fidelity

Check every acceptance criterion and material constraint against the diff and
fresh receipts. Find omissions, contradictions, unintended behavior, and proof
that does not exercise the claimed surface. Trace findings to criterion IDs.

### Repository standards

Inspect correctness, maintainability, tests, local conventions, boundary
handling, and integration with surrounding code. Findings cite exact files and
tight line ranges where possible.

Neither axis may be reduced to or hidden by a combined score.

### Decision research

For a decision-research run, replace the engineering axes above with separate
verdicts for `decision-relevance`, `evidence-quality`,
`alternative-coverage`, `counterevidence`, and `uncertainty-calibration`.
Intensive rigor also requires `independent-challenge` and
`method-reproducibility`. Bind every verdict to the current research-contract
and grounding comparison digests. Review the quality of reasoning and source
use; do not turn the required axes into a mechanical checklist or combined
score.

## Risk-triggered lenses

Load only lenses activated by the run's risk record. Typical triggers include:

- **Security/privacy:** trust boundaries, identity, secrets, permissions, or
  sensitive data.
- **Performance/reliability:** hot paths, concurrency, resource limits, retries,
  or distributed failure.
- **Migration/compatibility:** data shapes, public APIs, persisted state, or
  rollout sequencing.
- **Accessibility:** user-facing interaction or content.
- **Adversarial:** high blast radius, ambiguous behavior, or contested design.

An activated lens produces its own verdict and findings. Do not silently skip
it; record unavailable expertise or tooling as a gate.

## Finding lifecycle

Classify each finding as blocking, non-blocking, or dismissed, with rationale
and evidence. Automated review comments are hypotheses until reproduced or
confirmed against the code. Fixes create a new comparison point and invalidate
affected verdicts; re-run the narrowest sufficient verification and review.

The final review bundle contains comparison identifiers, observer identities,
input digests, verdict per axis/lens, findings and dispositions, evidence
references, freshness, and degraded-independence notes.

## Routes for review outcomes

The same contract supports the retired audit, report, and verifier-maintenance
capabilities without creating parallel sources of truth:

- **Audit:** record each axis/lens verdict, finding disposition, evidence
  pointer, comparison point, and limitation as a `review-add` bundle. A green
  summary without those receipts is not an audit result.
- **Stakeholder report:** project the reviewed run into a concise report with
  outcome, acceptance coverage, risks, limitations, delivery state, and exact
  next action. The report is a derived view or durable handoff, never a second
  verdict store.
- **Verifier maintenance:** when a procedure, feature journey, surface, or
  helper changes, create a new immutable verifier version, re-run the affected
  journey, and re-review receipts bound to the old version. The maintenance
  decision and first-run proof belong in the same run's evidence chain.
