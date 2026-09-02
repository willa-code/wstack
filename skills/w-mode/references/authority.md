# Authority profiles and gates

Authority is data in the run contract. At run creation, the selected profile
and its behavior metadata are snapshotted with an `authorityPolicyDigest`.
Existing runs continue under that snapshot even when project configuration is
later edited; a successor run is required for a policy change. A worker
inherits the intersection of the snapshotted run profile, task grant,
environment policy, and parent authority. No brief, retry, projection, or
workflow transition may widen it.

| Capability | Review-only | Safe (default) | Autonomous | Overnight |
|---|---:|---:|---:|---:|
| Inspect and run read-only checks | allow | allow | allow | allow |
| Edit within claimed resources | deny | allow | allow | allow |
| Create isolated branch/worktree | deny | allow | allow | allow |
| Commit locally | deny | allow | allow | allow |
| Run declared deterministic commands | allow | allow | allow | allow |
| Push or mutate remote tracker/PR | gate | gate | allow when explicitly granted | allow when explicitly granted |
| Merge, deploy, delete durable data | gate | gate | gate | gate |
| Send external messages | gate | gate | gate | gate |

`Autonomous` extends unattended progress, not irreversible authority.
`Overnight` additionally enables bounded retries, worker replacement, and
coordinator takeover under predeclared budgets. Per-run overrides name the
exact capability, scope, grantor, expiry, and whether delegation is allowed.
Profiles also persist behavior metadata such as whether unattended progress,
automatic worker replacement, and coordinator takeover are enabled. These
metadata flags select operating behavior; they never grant a capability that
the capability table denies.

A gate records the requested capability, target, reason, current safe state,
default action, and alternatives. While gated, route around independent work
when possible. Approval is an immutable event; changed target or expired grant
requires a new approval. For irreversible grants, setup may configure an
`approvalKeyDigest`. The CLI then accepts `WSTACK_APPROVAL_KEY` only when its
digest matches that configured value; the secret is never written to the
workspace. Without a configured digest, such grants are denied. This is an
optional harness authentication hook, not a replacement for human policy.
Denial is terminal only for the affected transition.

Artifact approver names and approval events are durable provenance, but are
attested claims by default: filesystem access alone cannot prove who supplied
the name. A harness may bind the event to an authenticated identity. The
approval-key mechanism authenticates irreversible authority grants; it does not
automatically authenticate ordinary artifact approvals. Reports must say when
provenance is only attested and must not present it as cryptographic identity
proof.

Default safe behavior ends at verified local commits and a ready-to-publish
delivery projection. Pushing, publishing issues or pull requests, merging,
deploying, destructive cleanup, and contacting people require matching
authority. Ordinary implementation never implies delivery authority.
