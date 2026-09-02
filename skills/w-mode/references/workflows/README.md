# Workflow graph index

Choose exactly one graph from the decision the run supports:

| Decision | Graph |
|---|---|
| Deliver a new capability | [feature.md](feature.md) |
| Restore violated behavior | [bug.md](bug.md) |
| Preserve behavior while changing structure (`refactor`) | [refactor-migration.md](refactor-migration.md) |
| Move between interfaces, schemas, storage, or dependencies (`migration`) | [refactor-migration.md](refactor-migration.md) |
| Improve one metric against a target | [hillclimb.md](hillclimb.md) |
| Judge probabilistic AI-product behavior offline | [product-evaluation.md](product-evaluation.md) |
| Judge a coding-agent system change | [agent-evaluation.md](agent-evaluation.md) |
| Produce a decision-ready recommendation from evidence | [decision-research.md](decision-research.md) |

If two graphs appear to apply, classify by terminal decision, not requested
activity. A feature may include a migration but remains a feature when success
is the new capability. A product evaluation may expose a deterministic defect;
fix that defect in a separate bug run so its proof does not become an
evaluation verdict.

Decision research is distinct from product evaluation: it compares hypotheses
or alternatives to inform a consequential choice, while product evaluation
applies a frozen decision rule to probabilistic product behavior. A casual
fact lookup is neither and remains outside w-mode.

Every graph declares entry, required artifacts, transitions, allowed skips,
gates, evidence and review, terminal condition, and reply projection. Shared
mechanics live one directory up and are not reinterpreted here.

The seven design graphs map to eight concrete runtime IDs: `feature`, `bug`,
`refactor`, `migration`, `hillclimb`, `product-evaluation`,
`agent-evaluation`, and `decision-research`. The shared refactor/migration
graph never creates a ninth `refactor-migration` ID.
