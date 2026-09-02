# Versioned Project Verifier

A generated `verify-<project>` package teaches a cold agent to operate the
actual product like an end user or downstream caller. It is maintained product
infrastructure, not a one-off test script.

## Create

Interview the repository before asking the user. Establish:

- the primary externally observable surface and any secondary surfaces;
- the repository's real launch path, readiness signal, auth and test data;
- the safest programmable driver already available;
- observable outputs and persistent side effects;
- isolation boundaries for concurrent instances; and
- owned cleanup that cannot damage a user's existing session.

Create the smallest package that makes those facts repeatable and
machine-identifiable. Each version is
immutable and lives beneath an explicit version directory; `current.json` is
only the replaceable pointer:

```text
verify-<project>/
├── current.json                 # pointer to one immutable version
└── versions/
    └── <version>/
        ├── SKILL.md
        ├── verifier.json
        ├── features/
        └── scripts/             # repeatable deterministic helpers only
```

`verifier.json` in a version directory is machine-readable and includes a stable verifier ID, schema
version, verifier version, supported surfaces, feature-map digest, procedure
digests, required tools, isolation strategy, and evidence kinds. The canonical
`procedureDigest` covers Launch, Doctor, Cleanup, and the complete feature map.
Bind `verifierDigest` to the current pointer's `manifestDigest` and bind this
`procedureDigest` under the stable verifier ID. `SKILL.md`
contains Launch, Doctor, Journey, Evidence, Cleanup, and Helpers instructions with
real commands and stable handles. The feature map starts with the top three to
five externally observable capabilities; each journey names its acceptance
surface, starting state, actions, observable end state, side effects, evidence,
and cleanup.

Never add placeholders. If the checkout cannot launch, report that as a blocker
instead of encoding imaginary instructions.

The package does not supply a universal driver. Reuse the project's existing
CLI, HTTP client, Playwright/Cypress suite, application harness, or available
agent tools. Prefer CLI or API driving when it proves the same claim more
cheaply; use a browser only for UI-specific behavior.

After discovering those facts, encode them in a JSON contract and run
`node scripts/create_verifier.mjs <project-root> <contract.json>` from the
`verify-review` skill directory. The generator rejects missing commands,
surfaces, isolation, or journey details and writes the versioned package under
`.wstack/verifiers/verify-<project>/versions/<version>/`. It also updates the
`current.json` pointer. An existing version may be reused only when its
manifest and feature digests are byte-for-byte identical; a changed contract
requires a new version. It does not discover or invent facts; repository
interview and the first-run proof remain agent responsibilities.

## Run

Validate the package and environment, launch only an owned instance, run Doctor,
perform the mapped journey through the real boundary, observe visible and
persistent effects, record evidence, then clean up only owned resources.
Evidence must survive cleanup. A run returns a typed completion bundle; it does
not directly edit canonical run state.

## Maintain

Re-interview only the changed surfaces. Increment the verifier version whenever
behavioral instructions, feature journeys, helpers, or evidence semantics
change. Recompute digests, record lineage to the prior version, and run one
representative journey end to end. The runtime decides which older receipts are
now stale from their referenced procedure and feature digests.

## First-run proof

Before handing off a new or changed package, execute Launch → Doctor → one mapped
journey → Evidence → Cleanup. Confirm the captured evidence remains readable.
Fix and repeat on failure; an unexecuted verifier package is a draft.
