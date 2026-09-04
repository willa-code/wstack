# Maintaining wstack

This repository is a private npm package. Its package metadata is useful for
reproducible development and release bookkeeping; consumers install the
versioned skills from the repository with the channel or tag-pinned installer described in
[`docs/maintenance/install.md`](docs/maintenance/install.md). There is no npm
publication step.

## Local checks

Core verification supports Node 20 or newer. Full and installer verification
uses Node 22.20 or newer because the locked `skills@1.5.23` development tool
declares that minimum:

```bash
npm ci
npm run verify:fast
npm run verify:core
npm run verify
```

Tests use Node's built-in `node --test` runner. `verify:core` is the offline
structural/runtime suite. `verify` adds the disposable local-source installer
sandbox using the locked installer dependency. Use `npm run verify:latest`
only for an explicit compatibility check against the upstream latest CLI.
It allows 5 minutes by default (`WSTACK_SANDBOX_TIMEOUT_MS` overrides) and
retries networked installs once; a timeout with no installer output is a
network flake to rerun, and the failure now reports timeout, signal, exit
status, and elapsed time.

## SemVer policy

Every user-visible change has a Changeset. The package follows SemVer:

- `patch`: backwards-compatible fixes or public maintenance with no new
  supported behavior. Documentation and tests accompanying such a change
  inherit its patch release.
- `minor`: backwards-compatible skills, commands, schemas, or guidance that
  add supported capability.
- `major`: incompatible command/schema/skill contracts, removed behavior, or
  a migration that requires consumer action.

Pure documentation or test maintenance that does not change the public
distribution is explicitly no-release work; record that decision in the pull
request.

Changesets are the sole release engine. Do not hand-edit a version to bypass a
Changeset, use another versioning bot, or publish to npm.

Create a Changeset with `npm exec changeset`, select the package and SemVer
level, and describe the user-visible outcome. Package version and derived
version metadata are changed only by the generated version workflow.

## Release sequence

1. Merge the change and its Changeset into `main`.
2. The push to `main` runs the release workflow's version-PR phase. It runs
   `changeset version`, updates the lockfile and changelog, and opens or
   updates a reviewable `release/version` PR.
3. Review and merge that PR. Confirm the package version, changelog, generated
   artifacts, and installer checks.
4. After an authorized reviewer approves the protected `release` environment,
   run the tag/release phase with the merged version-PR number. It verifies
   that the release commit is exactly that merge, then creates an annotated
   `vX.Y.Z` tag only when that tag does not already exist. It installs from the
   exact remote tag before creating the matching GitHub Release.

Tags are immutable release records: never move, delete, or recreate a released
tag. If a release is wrong, prepare a new patch release. The workflow does not
run `npm publish`.

The tag/release phase is safely resumable after an infrastructure failure. If
the tag already exists, it proceeds only when the annotated tag resolves to the
exact authorized commit; it then repeats exact-tag verification and creates the
GitHub Release only when absent. A product defect found after tagging is not a
retry case—document it and fix forward with a new patch version.

Do not run the tag/release phase speculatively. A local maintainer may inspect
the generated diff and run all verification jobs without pushing, tagging, or
creating a release.

### One-time `v2.1.0` bootstrap

The repository has no earlier formal tag and its product and protocol metadata
already agree on `2.1.0`. For this first release only, the maintenance-system
pull request is the reviewed bootstrap PR: no synthetic version bump or empty
version PR is required. After it is merged and all required checks pass, supply
that merged PR number to the protected tag/release phase. Every later release
must follow the normal Changeset and generated version-PR sequence above.

Before requesting either release path, run `npm run release:dry-run`. It checks
the synchronized version authorities, full suite, disposable installer,
local proposed-tag absence, and canonical changelog notes without making any
external change. The protected workflow separately checks the remote tag. A
successful rehearsal deletes its temporary evidence; a failure keeps the
diagnostic directory it reports.
