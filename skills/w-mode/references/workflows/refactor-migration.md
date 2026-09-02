# Refactor and migration workflow

This one design graph serves two concrete runtime workflow IDs: `refactor` for
behavior-preserving structural change and `migration` for an intentional move
between interfaces, schemas, storage shapes, or dependencies. Select exactly
one of those IDs when creating a run; `refactor-migration` is only the shared
graph filename, not a valid runtime workflow ID.

**Entry:** change an interface, representation, dependency, storage shape, or
architecture while preserving or deliberately evolving behavior. A net-new
capability uses [feature.md](feature.md).

**Required artifacts:** target outcome and invariants; caller/consumer and data
inventory; current and target interface/schema identities; migration strategy;
compatibility window and rollback rule; staged task/resource graph; per-stage
receipts; legacy-removal proof; reviews; delivery projection.

**Transitions:** `GROUNDED` completes the consumer inventory before the target
contract is accepted. `FRAMED` fixes target state and preserved invariants;
`SPECIFIED` declares preserved and changed behavior plus the final state with
no accidental dual API. `PLANNED` orders expand, migrate, and contract only
when compatibility is required; otherwise it records one green migration wave.
`ASSIGNED` isolates each stage; `IMPLEMENTED` reaches the target candidate;
`VERIFIED` proves invariants, consumers, and legacy removal; `REVIEWED`
resolves behavior, standards, migration, and data-integrity axes; `DELIVERED`
reaches the authorized rollout state. Meanings follow
[../lifecycle.md](../lifecycle.md).

**Allowed skips:** compatibility expansion may skip when all callers can
migrate atomically. Legacy removal may skip only when the accepted
specification declares a dated, owned compatibility window and terminal
delivery is correspondingly gated.

**Gates:** unknown consumers; irreversible data conversion without tested
backup/rollback; public compatibility decision; cross-system rollout authority;
scope expansion beyond the accepted migration inventory.

**Evidence and review:** establish invariant and consumer checks before change.
Every stage ends green; temporary red state never crosses a checkpoint. Verify
the shared boundary on its matching surface and prove all inventoried callers
moved before deletion. Review behavior preservation/spec changes and repository
standards separately; activate migration and data-integrity review by default.

**Terminal condition:** target interfaces are active, intended callers and data
are migrated, obsolete surfaces are removed or explicitly gated by the
accepted window, rollback obligations are satisfied, and current receipts and
reviews pass.

**Reply projection:** old-to-new model; migration stages completed; consumer
coverage; compatibility or rollback status; removed legacy surface; gates and
delivery state.
