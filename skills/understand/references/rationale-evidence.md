# Rationale Evidence

Historical rationale is an evidence investigation, not a story inferred from
the current implementation.

## Search categories

Anchor first with target files, symbols, blame/history, and linked commits or
pull requests. Select the available sources most likely to distinguish the
live explanations; the categories are prompts, not mandatory ceremony:

1. source-control history, review discussion, and code comments;
2. issues, tickets, and planning records;
3. specifications, ADRs, RFCs, postmortems, and long-form documents;
4. team communication;
5. observability and incident evidence;
6. error tracking; and
7. product analytics or other operational data.

Parallelize independent sources when useful. Each investigator returns cited
findings or an explicit empty result. Record skipped categories only when the
omission would otherwise be material to confidence.

## Confidence classes

- **Direct:** an authoritative source explicitly states the claim.
- **Supported:** multiple concrete sources strongly support it without saying
  it verbatim.
- **Inferred:** a reasoned conclusion from named evidence; show the chain.
- **Speculative:** plausible but weakly supported; never use as a settled
  design constraint.
- **Unknown:** evidence is absent, contradictory, or inaccessible.

Use confidence-matching language and cite every non-obvious historical claim.
Do not treat current mechanics as evidence of original intent. Preserve
contradictions and competing explanations rather than silently choosing the
smoothest narrative. The user's prior belief is another hypothesis to test.

## Result shape

State the question and code anchor, then separate direct findings, supported
and inferred conclusions, competing hypotheses, unknowns, and sources searched
(including empty or skipped categories). If the investigation informs a change,
derive Preserve / Change / Avoid / Risk constraints with their confidence and
source links.
