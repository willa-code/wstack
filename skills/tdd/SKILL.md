---
name: tdd
description: "Build deterministic behavior through red-green-refactor at an accepted public seam. Use when a cheap test can prove a feature or reproduce a defect."
---

# Test-driven development

Take the seam and acceptance criterion from the accepted specification. For a
precise lightweight request, record the chosen seam in the minimal contract;
do not add an approval turn for an observable, reversible engineering choice.

Work one vertical slice at a time:

1. Write the smallest test that fails for the intended reason.
2. Record the red result against the acceptance criterion.
3. Implement only enough behavior to pass.
4. Run the focused test, then affected deterministic checks.
5. Refactor without changing behavior and keep the checks green.

Test public behavior, not private implementation. Expected values come from an
independent source such as the specification, a known literal, or a worked
example. Mock only external boundaries; prefer real controlled dependencies
when cheap. Never let a tautological assertion or a screenshot stand in for a
deterministic check.

Skip failing-test-first only when the test is expensive, integration-heavy, or
the assertion is not yet knowable. Record the reason and the stronger
matching-surface proof that will replace it. Runtime receipts, not the agent's
summary, carry test outcomes into terminal evidence.

Inside a run, record the relevant red result and final green proof with
`receipt-add`; intermediate commands need no separate event.
