# Change and evidence policy

Classify a proposed change before selecting checks. File paths are evidence for the classification, not the final decision.

| Change class | Required focused evidence | Broader obligations | Release impact |
| --- | --- | --- | --- |
| Skill behavior | Representative scenario and regression where deterministic | Public catalog, all-skill integrity, docs, candidate sandbox, independent forward test | Patch for compatible fixes; minor for additive capability; major for incompatible behavior |
| Shared runtime | Runtime tests for the changed contract | All runtime regressions, installed-runtime smoke test, affected skills and docs | Patch or minor unless incompatible |
| Persisted-state protocol | Old-state fixtures, migration, replay/round-trip, rollback behavior | Compatibility set, migration guide, runtime and schema checks | Minor when backward-compatible; major when incompatible |
| Documentation only | Link and canonical-wording checks | Confirm examples still match behavior | Explicitly no release unless public distribution meaning changes |
| Installation or distribution | Local and GitHub-source sandbox checks | Catalog, lock/ref expectations, consumer instructions | Usually patch or minor |
| Release infrastructure | Dry-run and provenance checks | Permissions, immutable dependencies, maintainer docs | Explicitly classify; internal-only changes may need no release |

Every pull request records:

1. Intent and change class.
2. Affected skills and shared contracts.
3. Targeted verification.
4. Whole-suite verification.
5. Documentation impact.
6. Independent behavioral evidence when applicable.
7. Changeset or explicit no-release decision.

Prefer a deprecation period of at least one minor release before removing or renaming a public skill. Immediate incompatible removal requires a major release and explicit justification.
