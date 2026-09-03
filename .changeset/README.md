# Changesets

Changesets are the only release metadata accepted by this repository. Add one
for every user-visible change, choosing `patch`, `minor`, or `major` according
to the policy in [MAINTAINING.md](../MAINTAINING.md).

The package starts at `2.1.0`; the bootstrap release is already recorded in
`CHANGELOG.md`, so this directory intentionally has no pending changeset.
The release workflow turns pending changesets into a version PR. It never runs
`npm publish`.
