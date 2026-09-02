---
name: verify-review
description: "Create, run, or maintain a project-specific end-user verifier, collect fresh acceptance evidence, and independently review a fixed comparison point for specification fidelity and repository standards. Use when proving a change, reviewing it, or establishing a maintained verify-<project> capability."
---

# Verify and Review

Prove the accepted specification at the claimed product boundary, then review
the same fixed comparison point. Verification and review are separate gates:
evidence that behavior works does not waive a code finding, and clean code does
not prove acceptance.

## Route the request

- **Create verifier:** interview the repository and create a versioned
  `verify-<project>` skill. Read
  [references/verifier-package.md](references/verifier-package.md), then pass
  the grounded verifier contract to `scripts/create_verifier.mjs`.
- **Run verifier:** use the current verifier package to exercise the real user
  or downstream-caller path and return typed evidence.
- **Maintain verifier:** update its feature map or procedures after a product,
  harness, or environment change, then prove the updated package once.
- **Review change:** independently assess the fixed comparison point. Read
  [references/review-contract.md](references/review-contract.md).
- **Full gate:** run acceptance verification first, then independent review.
- **Review decision research:** verify the accepted corpus and synthesis at the
  artifact comparison point, then review decision relevance, evidence quality,
  alternative coverage, counterevidence, and uncertainty calibration. Read the
  workflow's research contract before applying the review contract.

## Lowest-cost verification

Reuse the project's existing CLI, API client, browser tests, or application
driver. Do not build a second test platform. For each changed surface, run the
smallest representative path:

`Launch → Doctor → one relevant journey → compact evidence → Cleanup`

Prefer text, JSON, or a durable state check. Capture screenshots only for
visual claims. Run more journeys only when several surfaces changed, the first
journey fails, or the risk requires broader coverage. Lightweight work may use
same-agent deterministic proof; structured and program work require a separate
verifier, with degraded independence recorded when necessary.

For a wstack run, obtain the accepted specification revision, acceptance
criteria, comparison point, required evidence classes, risk lenses, and
authority policy from the runtime. Do not infer replacements for missing
required inputs. Outside a run, state a fixed base/head or artifact digest and
record a temporary review manifest before gathering evidence.

## Shared invariants

1. Bind every receipt and verdict to immutable inputs: acceptance-criterion
   IDs, spec digest, comparison point, verifier ID/version, procedure digest,
   environment identity, and observer identity/model family where applicable.
   For decision research, the comparison point is the accepted grounding
   artifact and the receipt domain is `research`.
2. Exercise the claimed surface. Static analysis cannot prove a UI, CLI, API,
   storage, or integration claim. Stronger matching-surface evidence may satisfy
   a weaker requirement; unrelated evidence may not.
3. Keep implementation-worker self-reports as inputs, never independent proof.
   Structured and program runs require a separate verifier. Prefer a different
   model family; if unavailable, record the degraded independence explicitly.
4. Record evidence through the runtime. Changed code, specification, verifier,
   procedure, or relevant environment inputs make affected receipts stale.
5. A blocked or failed verifier is not a pass. Preserve evidence produced before
   failure, record the reason, and return the run to repair, replan, or a named
   authority gate.
6. Do not publish remote comments, change a PR, merge, deploy, or communicate
   externally without the run's explicit authority.

Record acceptance IDs, specification and comparison digests, verifier,
procedure and environment digests, evidence manifests, result, observer,
independence class, and cleanup result through `receipt-add`. Record each review
axis through `review-add`.

## Completion

Verification completes only when every acceptance criterion has fresh evidence
of its required class or an explicit unresolved gate. Review completes only
when the workflow's required review-axis verdicts exist and
every blocking finding is fixed and reverified or explicitly gated. Report the
comparison point, coverage, stale or unavailable evidence, findings by axis,
degraded independence, and exact next action.
