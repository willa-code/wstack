---
name: grill
description: "Resolve unsettled product or design intent through an evidence-grounded decision tree, persist decisions and reasons, and stop only when the user confirms shared understanding."
---

# Grill

Build a decision tree whose frontier contains every decision that can be asked
without guessing an unresolved prerequisite. Ask the whole frontier in rounds,
number each question, and include a recommended answer. Facts are the agent's
job: inspect documents, repository evidence, prior decisions, and prototypes
instead of asking the user.

Always establish or enter the appropriate w-mode context because grill is for
consequential unresolved decisions. Resume one clearly matching active run;
ask the user to choose among plausible matches; otherwise create an
appropriately tiered run after the explicit setup gate is satisfied. Never
create a parallel grill-only state or silently guess among ambiguous runs.
Begin domain/design questioning only after setup and active-run selection are
resolved; the only earlier user question may be the setup gate or a choice
among ambiguous matching runs.

Persist four distinct classes through the runtime: discovered facts with
provenance, assumptions, user decisions with reasons, and unresolved branches.
Update shared vocabulary and create an architectural decision only when the
choice is costly to reverse, surprising without context, and a real tradeoff.

Do not implement or silently compile a final specification. When the frontier
is empty, regenerate the run review, present the resolved tree, and ask the user to confirm shared
understanding. Confirmation permits [specify](../specify/SKILL.md) to compile
the accepted decisions into an acceptance contract.

Persist the resolved facts, assumptions, decisions, reasons, remaining
unknowns, and a flexible `decisionTree` envelope in the accepted grounding
artifact, then return control to w-mode. Continue only within the authority of
the original request; planning-only work still stops after planning.
