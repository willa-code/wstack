---
name: understand
description: "Explain how a codebase or subsystem works, investigate why it was built that way, or combine both into grounded constraints for a change. Use for architecture walkthroughs, runtime traces, design rationale, regressions, onboarding, and historical intent."
---

# Understand

Build a trustworthy mental model before design. Keep mechanics and rationale as
distinct evidence: current code can prove what happens, but usually cannot prove
why that shape was chosen.

## Select a mode

- **How:** trace current runtime behavior, data flow, ownership, configuration,
  boundaries, and failure paths from the code and executable system.
- **Why:** investigate historical intent, constraints, alternatives, and
  tradeoffs across available evidence sources.
- **Combined:** complete How first, then use its concrete symbols, files,
  boundaries, and anomalies to seed Why. Reconcile the results without turning
  inferred rationale into runtime fact.

For a simple, narrow subsystem, explore directly. For a cross-cutting flow,
partition read-only exploration by non-overlapping concerns and synthesize the
actual files read. Never ask the user for repository facts that can be found in
the workspace or connected evidence sources.

## How mode

Start from a real entry point and trace input to observable output. Identify the
few types and abstractions needed to follow the path; include persistence,
queues, external calls, configuration, and errors only where they affect it.
Spot-check claims against source rather than inferring behavior from names.

Present an overview, key concepts, ordered flow, where the relevant pieces live,
and gotchas. Cite paths and symbols a reader can inspect. In a wstack run, record
runtime evidence separately from rationale evidence in the `GROUNDED`
transition.

## Why mode

Read [references/rationale-evidence.md](references/rationale-evidence.md).
Anchor the investigation in the current code, then search the available
evidence categories most likely to discriminate among the live explanations.
Report direct evidence, supported inference,
competing hypotheses, contradictions, explicit null results, and unknowns.

## Combined output

Keep the How explanation independently usable, followed by the Why findings.
When the result feeds a change, conclude with a cited constraint set. When it
instead informs a consequential choice among alternatives, route the grounded
result into the decision-research workflow rather than treating understanding
as the recommendation itself:

- **Preserve:** behavior or constraints still load-bearing.
- **Change:** accidental structure or superseded assumptions.
- **Avoid:** rejected or demonstrated failure paths.
- **Risk:** uncertainties requiring specification, prototype, or verification.

Do not mutate code, documents, tickets, or remote systems during understanding.
The next workflow decides whether and how to act on the findings.

Inside a run, store the cited mechanics, rationale, constraints, assumptions,
and unknowns in the accepted grounding or diagnosis artifact before advancing.
Standalone read-only understanding may remain ephemeral.
