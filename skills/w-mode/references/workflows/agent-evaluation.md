# Agent evaluation workflow

**Entry:** decide whether a skill, router, prompt structure, operating rule, or
agent-harness change improves coding-agent behavior. Product behavior uses
[product-evaluation.md](product-evaluation.md).

## Low-cost default

Start with one bounded variant, one organic prompt hidden from the candidates,
one small sanitized project, and one blinded judge using the same short rubric
for baseline and candidate. Inspect the actual files read and artifacts created,
then record `promote`, `reject`, or `inconclusive`. Add more projects, prompts,
models, or repeated runs only when the change is broad, noisy, or expensive to
reverse.

**Required artifacts:** bounded variant and current baseline; three-to-six
criterion judge rubric; sanitized project-shaped environments; one organic
prompt hidden from candidates' evaluation context; candidate run manifests and
artifacts; transcript-derived files-read evidence; blinded judge verdict;
lead synthesis; promotion record.

**Transitions:** `FRAMED` freezes the promotion question and rubric.
`GROUNDED` identifies the failure evidence and baseline behavior. `SPECIFIED`
freezes blinding, sample, model/fallback, and promotion rules. `PLANNED` maps
isolated candidate runs and one common judging pass. `ASSIGNED` records model
roles without exposing them to candidates. `IMPLEMENTED` means all candidate
artifacts exist. `VERIFIED` means transcripts and artifacts have been graded.
`REVIEWED` is lead synthesis against the judge. `DELIVERED` records promote,
reject, or inconclusive. A same-family judge is allowed only with an explicit
independence limitation.

**Allowed skips:** repeated same-model runs may replace heterogeneous workers
when alternatives are unavailable. No blind candidate run, artifact inspection,
files-read verification, common-scale judgment, or lead synthesis may skip.

**Gates:** rubric or promotion-rule changes after candidates run; blinding
leakage; unavailable transcripts; judge/lead disagreement caused by ambiguous
criteria; changing suite defaults without explicit human approval.

**Evidence and review:** candidate-visible names and prompts contain no
evaluation, comparison, rubric, or chain-eliciting cues. Grade actual artifacts
and files read, never claimed principle use. One blinded judge scores all
variants in one pass; prefer a different model family and record identities.
A suite default changes only after bounded failure evidence, blind comparison
against the current baseline, and human approval; repeated corroborating runs
are required for broad operating rules.

**Terminal condition:** all candidate outputs have been inspected, judge and
lead conclusions are reconciled, limitations are recorded, and the promotion
decision is explicit. `Inconclusive` does not promote.

**Reply projection:** variant and baseline; rubric; per-sanitized-candidate
observations; judge verdict and independence; lead synthesis/disagreement;
promote, reject, or rerun recommendation with evidence paths.
