# Project layout

```text
.wstack/
  config.json
  bin/
    wstack.mjs
    projection.mjs
    runtime.json
  context/
  decisions/
  verifiers/
  runs/
    <run-id>/
      manifest.json
      events.ndjson
      artifacts/
      receipts/
      views/
        status.json
        status.md
        handoff.json
        handoff.md
        review.md
        explorer.html
  evidence/
    objects/
  migrations/
```

Project context, accepted decisions, policies, and verifiers are shared.
Lifecycle artifacts, receipts, research contracts/outcomes, and generated
views belong to one run. Setup also manages marked wstack sections in root
`AGENTS.md` and `CLAUDE.md`, plus existing nested files with those exact names;
those instruction files remain ordinary repository files outside `.wstack/`.

Commit the configuration, pinned runtime, semantic events and artifacts,
receipt manifests, redacted small evidence, and generated review or handoff
views. Ignore live leases and locks, raw command logs, completion inbox
scratch, secrets, and large evidence objects. Receipts must report unavailable
payloads honestly when a local object did not travel with the repository.
