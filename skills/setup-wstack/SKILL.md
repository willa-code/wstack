---
name: setup-wstack
description: "Bootstrap or upgrade wstack in a repository: install the pinned project runtime, configure authority and durable-state policy, discover verification commands, and validate cross-harness invocation metadata."
disable-model-invocation: true
---

# Setup wstack

Bootstrap or upgrade the repository idempotently. Inspect existing instructions,
Git state, project commands, verification surfaces, remote capabilities, and
legacy workflow artifacts before proposing changes.

## Install

Run `scripts/discover_project.mjs` to produce a reviewable setup input without
requesting credentials, then run the shipped runtime installer. The installer
creates or updates the marked wstack section in root `AGENTS.md` and
`CLAUDE.md`, and in existing nested files with those exact names. It preserves
user content, replaces the exact legacy routing sentence, and reports affected
paths. It installs a pinned dependency-free
JavaScript executable and protocol metadata under `.wstack/bin/`. Commit the
runtime so fresh local and cloud checkouts share the same protocol version.
Upgrades require compatibility validation, migration records, and rollback
metadata; never rewrite accepted artifacts in place.

Create the run-centric layout described in
[project layout](references/project-layout.md). Semantic records and generated
handoffs are committed. Locks, leases, raw logs, inbox scratch, secrets, and
bulky evidence are ignored. Always create or update root `AGENTS.md` and
`CLAUDE.md`, and update existing nested files with either exact name. Do not
guess or edit other instruction-file conventions.
The managed pointer says that substantial development, evaluation, or
decision-grade research enters `w-mode` and resumes a matching active
`.wstack` run before creating another one. Use grill when consequential
decisions remain unresolved. Setup itself remains explicitly user-invoked.

### Executable behavior and security boundary

The shipped runtime is executable JavaScript. Discovery runs `gh --version`
only to report whether the GitHub CLI is available; it does not request or
store credentials. `wstack exec` runs only a command name present in the
configured `.wstack/config.json` allowlist, using the recorded project argv;
review that file and the referenced project scripts before execution. Bundle
creation returns JSON on stdout and does not write to a path supplied in the
input body.

## Configure

Record:

- the default safe, risk-based authority profile and optional review-only or
  unattended profiles;
- permitted edit, branch, commit, push, publish, merge, deploy, destructive,
  and external-message capabilities;
- maximum workers, retry budget, and coordinator lease duration;
- project build, test, lint, typecheck, and run commands;
- GitHub adapter availability without requesting or storing credentials;
- evidence privacy and storage policy.

The default permits local edits, branches, and commits. Remote publication,
merge, deployment, deletion, and external communication remain gated.

Offer [verify-review](../verify-review/SKILL.md) to create the first versioned
project verifier when the repository exposes a CLI, UI, API, service, desktop,
mobile, or public-library surface.

## Validate

Run the suite and runtime validators. Setup is complete only when the runtime
can initialize and replay a run, configuration conforms to the current
protocol, Git inclusion boundaries are correct, instruction pointers are
unique, and invocation metadata agrees across skill frontmatter and Codex
policy.

Setup records the installed protocol version, configuration, discovery input,
validation result, and any upgrade lineage in shared `.wstack/` state. It does
not create a run solely to record installation.
