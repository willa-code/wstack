# Release policy

`main` is the continuously installable channel. Formal releases are immutable `vX.Y.Z` Git tags and matching GitHub Releases. The repository is private npm tooling metadata only; it is never published to npm.

## Normal release flow

1. Merge a validated release-worthy pull request containing a Changeset.
2. Let automation create or update the version pull request.
3. Review its version, changelog, and exact-commit verification evidence.
4. Merge the version pull request only with explicit human approval.
5. From the protected release workflow, prove the release commit came from that merged pull request, required checks passed, version metadata agrees, and the tag is absent—or, under the recovery rules below, that the existing annotated tag resolves to the exact authorized commit.
6. Create or safely resume the annotated tag, then install from that exact remote tag into a disposable consumer.
7. Create the matching GitHub Release from the canonical changelog entry only after exact-tag verification passes.

The first formal release is a one-time `v2.1.0` bootstrap after the maintenance system passes its isolated rehearsal. Later releases use Changesets normally.

## Authority and recovery

Pull-request validation is read-only. Version-PR automation receives narrowly scoped branch and pull-request write access; the separately protected tag/release job receives release write access only after authorization. Pin third-party actions to reviewed immutable commits.

Never move, replace, or delete a published tag to conceal a defect. Mark the problem clearly, fix forward under a new patch version, and document user remediation. Treat validation as evidence rather than authorization: never push, change repository settings, merge, tag, or publish without explicit permission for that action.

An infrastructure failure after the tag push may be retried only when the existing annotated tag resolves to the exact authorized commit. Repeat exact-tag verification and create the missing GitHub Release. Do not use this recovery path for a product defect.

## Automation limits

- `verify:latest` installs through `npx skills@latest` on a cold cache and can exceed its timeout on slow networks. The sandbox now reports timeout, signal, exit status, and elapsed time, waits longer for `--latest` (5 minutes by default, overridable with `WSTACK_SANDBOX_TIMEOUT_MS`), and retries networked installs once before failing. A timeout with no installer output is a flake signal: rerun the job before treating it as a product defect.
- The version-PR job pushes `release/version` with the Actions bot, but this repository blocks the bot from opening pull requests. When the job reports `createPullRequest not permitted`, the branch push has still succeeded: open the version PR manually under user auth with `gh pr create --base main --head release/version`. Do not change repository permission settings to work around this.
