---
name: open-pr
description: "Prepare or publish a pull request from verified wstack delivery state, using clean commits, evidence-backed description, idempotent GitHub reconciliation, and an explicit remote-authority boundary."
---

# Open PR

Inside a wstack run, consume the accepted specification, task and commit graph,
fresh receipt coverage, separate review verdicts, and delivery authority.
Outside a run, establish a temporary delivery record with a fixed base and
head before preparing the PR.

Prepare small ordered commits that remain green independently. Do not rewrite
unrelated user changes or use destructive recovery. Generate the PR title and
body from canonical artifacts: intent, scope, real tradeoffs, blast radius,
acceptance coverage, review findings, and exact verification evidence. Attach
screenshots or recordings only when they prove a claimed surface.

Preparing the branch and description is local work. Pushing, creating or
updating a remote PR, posting verdicts, enabling merge, or changing tracker
state requires the corresponding run capability. Use the GitHub adapter's
idempotency key and reconcile the returned remote ID before reporting success.
GitHub observations such as CI and reviews enter the run as events; they do not
replace canonical state or independent verification.

Green is not automatically safe. Publish only from the current verified head;
changed commits stale affected receipts and verdicts. Merge remains a distinct,
explicitly authorized delivery action. Opening a PR does not start indefinite
babysitting unless the selected workflow requests it.

Report the local readiness state, URL when published, base and head identities,
acceptance coverage, independent verdicts, remaining gates, and exact next
action.

Use `delivery-record` for local readiness and the projection commands for
remote requests and results. Outside an active run, start a lightweight run if
the delivery state must be durable.
