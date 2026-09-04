---
name: maintain-wstack
description: Maintain the canonical wstack repository, including change planning, implementation, verification, review preparation, versioning, and release readiness. Use only inside the wstack source repository; do not use for consumer projects that merely install wstack.
metadata:
  internal: true
---

# Maintain wstack

Keep `main` releasable, the public skill suite internally consistent, and the producer checkout free of consumer-generated state.

Before changing files, identify the repository root, read `MAINTAINING.md`, and classify the request using [references/change-policy.md](references/change-policy.md). Confirm the affected public skills, shared contracts, documentation, and release impact rather than inferring impact from paths alone.

Before any implementation edit, establish a safe Git workspace:

1. Inspect the current branch and working-tree status. Preserve existing work and stop if unrelated changes make the intended scope unsafe. Treat related uncommitted changes as part of the task only after confirming their provenance and intended scope.
2. Fetch `origin/main` when the remote is available. If it cannot be fetched, state that base freshness is unverified; do not begin a new implementation from that base unless the user explicitly accepts the limitation.
3. When starting on `main`, create a focused branch or isolated worktree from current `origin/main`—or another base the user explicitly selected—before editing. Never implement directly on `main`.
4. When already on an intended task branch or worktree, confirm its base and divergence from `origin/main`. If the base is stale or unexpected, report it before implementation. Do not discard, rebase, or overwrite existing work without authorization.

For an implementation, work through this sequence:

1. Inspect the repository and classify every applicable change class. Combined classes inherit the union of their evidence obligations.
2. State acceptance criteria and enumerate affected skills, shared contracts, version authorities, catalog entries, and documentation.
3. Implement the focused change with a deterministic regression when practical.
4. Run `npm run verify:fast` while iterating, then `npm run verify` before handoff. The full command includes runtime tests, the local-source consumer sandbox, and a before/after repository-state check.
5. For changed skill behavior, use a clean evaluator context that did not author the implementation. At minimum, this means a separate context with no implementation transcript, given only the candidate skill and realistic request; record its request, expected behavior, observed behavior, and ambiguities in the review evidence. This forward test complements deterministic regressions; the installer sandbox does not replace it.
6. Update affected docs and the canonical catalog. For a public skill addition, removal, or rename, also run `npm run version:check`.
7. Create release metadata with `npm exec changeset` for every user-visible change, or record an explicit no-release rationale for internal-only maintenance. Never hand-edit product version copies; the version workflow owns those changes.
8. Prepare the review evidence and stop before external mutations.

Use the smallest applicable mode:

- **Plan or analyze:** inspect facts and produce a scoped change/evidence plan. Do not mutate external state.
- **Implement:** make the focused change, add a meaningful regression when possible, and keep unrelated work intact.
- **Verify:** run the fast checks during iteration and the full repository check before handoff. Test unreleased skills only through the disposable candidate sandbox; never run the public install command from this checkout.
- **Prepare review:** summarize intent, affected surfaces, targeted and suite-wide evidence, documentation impact, behavioral forward-test evidence when applicable, and SemVer impact.
- **Prepare or verify a release:** follow [references/release-policy.md](references/release-policy.md). Stop before any push, settings change, merge, tag, or publication unless the user explicitly authorizes that exact external action.

Preserve these invariants:

- `skills/*` is the public distributable surface and must match the canonical public catalog.
- `.agents/skills/maintain-wstack` is the only repository-local internal skill. A root `skills-lock.json`, root `.wstack/`, or any other `.agents/skills/*` entry is producer pollution.
- Root `package.json` owns the product version. The runtime manifest owns the persisted-state protocol version. Derived copies must match their authority.
- Product and protocol versions both begin at `2.1.0` but change independently after that point.
- Meaningful skill behavior changes need independent forward-test evidence; durable deterministic failures should become focused regression fixtures.
- Verification must not change tracked files or leave non-allowlisted untracked files behind.

Treat passing checks as evidence, not permission. Publishing and other external mutations always retain their normal authorization boundaries.

Canonical commands are `npm ci`, `npm run verify:fast`, `npm run verify`, `npm run verify:sandbox`, `npm run version:check`, and `npm run release:dry-run`. `npm run verify:latest` is a networked compatibility check used only when installation/distribution or release-relevant changes require it. It uses a longer timeout (5 minutes, overridable with `WSTACK_SANDBOX_TIMEOUT_MS`) and retries once; treat a timeout with no installer output as a network flake to rerun, not as a product defect. For unreleased source, `npm run verify:sandbox` is the only supported installation test; never install the public GitHub channel into the producer checkout.
