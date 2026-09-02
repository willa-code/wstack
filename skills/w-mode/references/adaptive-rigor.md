# Adaptive rigor

Before `SPECIFIED`, classify the run from observable factors:

| Factor | Lightweight | Structured | Program |
|---|---|---|---|
| Scope | localized, one owner | multi-step or cross-cutting | multiple coordinated tracks |
| Reversibility | cheaply reversible | recovery needs checkpoints | failures affect a program frontier |
| Surfaces | one known surface | several interfaces or consumers | several products, services, or repositories |
| Concurrency | no beneficial fan-out | bounded disjoint work | rolling worker window and sub-coordination |
| Uncertainty | intent and design settled | material design or repository uncertainty | dependencies and sequencing evolve during execution |
| Verification cost | one cheap proof path | several criteria or real-surface verifier | independent verification queue and delivery frontier |

The agent proposes a tier with one sentence per material factor. The user may
override it. The engine records the factors, proposal, override, and final tier,
then enforces its minimum gates:

- **Lightweight:** the precise originating request may approve a compiled
  minimal specification; one owner; deterministic same-agent proof permitted.
- **Structured:** explicit specification approval; task graph; resource
  claims; independent verification; separate spec and standards review.
- **Program:** structured requirements plus coordinator lease, rolling bounded
  fan-out, completion bundles, independent verification queue, and durable
  stop-line/replan decisions.

Choose the highest tier indicated by any material factor; lower it only with a
recorded user override and the residual risk. Raising a tier adds coordination
and review gates but never widens authority. All tiers use the lifecycle in
[lifecycle.md](lifecycle.md), terminal proof in [evidence.md](evidence.md), and
capability limits in [authority.md](authority.md).

Decision research uses the same lightweight, structured, and program run
tiers, plus a methodological rigor label of `light`, `standard`, or
`intensive`. Standard is the default for consequential strategic or
competitive research. The methodological label changes evidence depth and
review axes, not authority. Do not invent a token, time, query, or source
budget; preserve state and remaining uncertainty when the user asks to stop.
