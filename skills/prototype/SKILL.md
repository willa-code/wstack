---
name: prototype
description: "Build disposable code or competing sketches to settle an empirical design question, record the evidence and decision, then keep prototype code out of production."
---

# Prototype

State one question and its pass or comparison rule before building. Use a
single runnable probe for behavior, timing, API, or state-model questions. Use
several structurally different candidates for a contested design; isolate
their outputs and compare them under one predeclared rubric.

Prototype code is disposable, trivial to run, visibly marked, and outside the
production task claim. Add no persistence, abstraction, or polish unless the
question requires it. Surface the relevant state and capture evidence that
another agent can inspect.

Record the verdict as a run decision with provenance. Production work may
adopt the resulting contract or data shape, never the prototype wholesale.
When no candidate separates, record the result as inconclusive rather than
inventing a winner.

Inside a run, store the question, comparison rule, evidence, and verdict in the
grounding decision record. Disposable prototype code is not canonical state.
