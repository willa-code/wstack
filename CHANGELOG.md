# Changelog

All notable changes are recorded here by Changesets during the version-PR
phase of a release.

## 2.1.0 — 2026-09-03

First formal public release of wstack. It provides the 13-skill workflow suite
for clarifying work, shaping implementation, executing safely, verifying
evidence, reviewing changes, and completing delivery.

- Adds the dependency-free `.wstack` runtime with resumable execution,
  projection, migration, and replay behavior carried forward from the V2 line.
- Establishes product `2.1.0` and persisted-state protocol `2.1.0` as separate
  version authorities so future product releases do not imply protocol changes.
- Adds canonical catalog, documentation, runtime, migration, and isolated
  installer verification, including regression coverage for V2-to-V2.1 state.
- Adds a producer-only maintenance process, Changesets bookkeeping, read-only
  pull-request checks, and an explicitly authorized immutable tag/GitHub Release
  path. The package remains private and is never published to npm.
