## Summary

<!-- What changed, and why? Link the issue or decision record when applicable. -->

- Change class: <!-- skill behavior | runtime/protocol | docs | distribution | release infrastructure -->
- Affected skills and shared contracts:

## SemVer and Changeset

- [ ] A Changeset is included for every user-visible change.
- [ ] The Changeset level (`patch`, `minor`, or `major`) matches `MAINTAINING.md`.
- [ ] Or: this is explicitly a no-release change, with rationale below.
- [ ] No package version was hand-edited to bypass Changesets.

## Verification evidence

- Fast checks: `npm run verify:fast` — result:
- Full checks: `npm run verify` — result:
- Sandbox/installer checks: `npm run verify:sandbox` — result:
- Independent forward-test evidence, when behavior changed:
- Documentation impact:

## Compatibility and safety

- [ ] Node minimum (`>=20`) remains accurate.
- [ ] Consumer docs keep `skills@latest` as the primary installer and use `#vX.Y.Z` only for optional source pinning.
- [ ] Producer-vs-consumer behavior is clear.
- [ ] No `npm publish`, tag, or GitHub Release was performed from this PR.
- [ ] Workflow permissions remain read-only unless a narrowly scoped release job
      requires a documented write permission.
- [ ] Third-party GitHub Actions remain pinned to immutable commit SHAs with
      version comments.

## Review notes

<!-- Known limitations, migration notes, or follow-up work. -->
