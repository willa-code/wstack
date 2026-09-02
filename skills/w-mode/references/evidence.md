# Evidence algebra and freshness

Evidence proves acceptance claims; task completion and green CI do not. Keep
three epistemic domains distinct:

- **Engineering verification:** deterministic claims about an implementation.
- **Product evaluation:** probabilistic judgments over fixed offline evidence.
- **Agent evaluation:** blinded observations of coding-agent behavior.
- **Decision research:** graded evidence and counterevidence supporting a
  choice among hypotheses or alternatives.

They share provenance and freshness mechanics, not decision rules.

## Receipt shape

Each receipt binds `receipt_id`, domain, acceptance or criterion IDs,
comparison point, specification revision, verifier ID and revision,
environment digest, procedure/command, result, evidence manifests, producer,
independence class, model family when applicable, and time. Payloads may stay
in a content-addressed local or remote store; committed manifests retain hash,
media type, redaction, availability, and provenance.

## Strength and composition

Engineering evidence classes, weakest to strongest, are `static`,
`deterministic`, and `matching-surface`. Self-report is provenance, never
proof. A specification assigns every acceptance criterion a claimed surface
and minimum class. Stronger evidence may satisfy a weaker requirement only
when it exercises the same claimed behavior. Different receipts may jointly
cover one criterion when the declared composition is conjunction; averages
cannot hide a failed critical guard.

Product evaluation receipts record dataset identity, sampling, evaluator
versions, uncertainty, guards, and paired/matched comparison. Their verdict is
`approve`, `reject`, or `inconclusive`; it never proves production impact.
Agent evaluation receipts record sanitized environment, organic prompt,
variant identity hidden from candidates, files actually read, artifacts,
judge identity, independence limitation, and promotion recommendation.

Decision-research receipts use the `research` domain and bind the current
research-contract digest plus an artifact comparison point for the accepted
grounding revision. They record source provenance, evidence coverage,
counterevidence, procedure, environment, producer, and independence. Review
separately covers decision relevance, evidence quality, alternatives,
counterevidence, and uncertainty calibration; intensive work also requires
independent challenge and method reproducibility.

## Freshness

A receipt is current only when every bound input still matches. A new code
head, specification successor, acceptance change, verifier/journey revision,
relevant environment change, or evidence corruption stales the affected
receipt. Restacks and rebases require exact-head revalidation unless verified
patch identity and unchanged bound inputs prove equivalence. A verifier verdict
overrides worker self-report. `blocked`, `failed`, `inconclusive`, missing
payload, and wrong-surface evidence never satisfy a terminal criterion.

A run is proof-complete only when every required criterion has fresh evidence
of the declared class, every critical guard passes, all blocking review
findings are resolved or explicitly gated, and the exit predicate evaluates
true. The engine computes coverage; reports project it without rounding up.
