# Product evaluation workflow

**Entry:** an offline decision about probabilistic AI-product behavior using
recorded, curated, or synthetic evidence. It does not prove deterministic code
correctness, production impact, coding-agent improvement, or a broad strategic
choice among competing hypotheses. Use decision research for that last case.

## Low-cost default

Evaluate one decision, not the whole product:

1. Freeze the question, criteria, critical guards, and `approve`, `reject`, or
   `inconclusive` rule.
2. Reuse a small, redacted, representative sample of real failures and normal
   cases. Add synthetic cases only for missing risks.
3. Freeze the baseline, candidate, prompts, configuration, evaluator, and
   environment.
4. Use deterministic checks for formats and hard guards. Use one blinded judge
   only for subjective criteria, calibrated on a small protected set.
5. Run baseline and candidate on the same examples, then record rates, guard
   failures, limitations, and the final verdict.

Start small. Add examples, repeated runs, judges, or red-team work only when
risk, noise, or an inconclusive result justifies the cost. A baseline-only run
stops after describing current behavior; a comparison run uses paired examples
where possible.

**Required artifacts:** product/context map; accepted decision contract with
populations, criteria, error costs, guards, thresholds, privacy constraints,
and inconclusive rule; failure taxonomy; evaluator definitions and protected
validation; risk record and, whenever a risk trigger fires, an adversarial
red-team plan and report; immutable baseline; paired/matched candidate
qualification when a candidate exists; durable report or gated handoff.

**Transitions:** specialize the lifecycle as `FRAMED` decision contract,
`GROUNDED` product/evidence map and discovered failures, `SPECIFIED` accepted
measurement contract, `PLANNED` evaluation portfolio, `ASSIGNED` frozen run
inputs, `IMPLEMENTED` validated evaluators/candidate identity, `VERIFIED`
baseline or qualification results, `REVIEWED` decision audit, and `DELIVERED`
report/handoff. No candidate is required for a baseline-only run. New candidate
failure modes return to grounding/discovery through a successor contract or
recorded coverage amendment; they are never silently added mid-comparison.

**Allowed skips:** qualification skips for a baseline-only decision. Elevated
risk review skips only when the accepted risk record shows no trigger. Product
mapping, decision framing, failure discovery, evaluator validation, baseline,
decision audit, and limitation reporting never skip.

**Gates:** human confirmation of decision contract, baseline, threshold or
guard changes; unauthorized/private evidence; elevated risk before baseline;
insufficient protected evidence; live experiment, deployment, or user contact.
When a risk trigger fires, baseline approval is blocked until the red-team
report is complete, its findings are dispositioned, and the decision contract
records any residual risk. “No trigger” must itself be recorded in the risk
record; a missing risk assessment cannot bypass the red-team gate.

**Evidence and review:** apply the product rules in [../evidence.md](../evidence.md).
Validate evaluators independently of candidate qualification. Use the same
validated portfolio on baseline and candidate; pair samples when possible and
record why matching replaced pairing. Critical guard failure overrides average
quality. Review evaluator validity and decision-rule application; risk may add
privacy, safety, or adversarial review.

**Terminal condition:** the predeclared rule yields `approve`, `reject`, or
`inconclusive`; every critical guard is accounted for; uncertainty, coverage,
provenance, and limitations are explicit; result is durably reported or gated.

Store the contract, sample manifest, evaluator definition, baseline/candidate
outputs, report, and final verdict as immutable artifacts or evidence pointers.
`evaluation-record` stores the final verdict and artifact links; the report
carries sampling, rubric, uncertainty, guards, privacy, and limitations.

**Reply projection:** decision supported; verdict and confidence; baseline and
candidate identities; guard outcomes; coverage and privacy limitations; new
failure modes; exact next action. Never claim production readiness from this
workflow alone.
