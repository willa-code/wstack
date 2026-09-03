# wstack v2 migration

This document covers the supported, bounded recovery path from the v2.0
durable-state protocol to v2.1. It is deliberately not a generic importer for
arbitrary legacy workflow files. The current checkout and the installed v2.1
runtime are authoritative; historical records are inputs to replay, never
instructions to execute.

## v2.1 forward compatibility

V2.1 keeps the v2 run-centric protocol and immutable history. `w-mode` and
`grill` are model-invokable; `setup-wstack` remains explicitly user-invoked
because it changes repository configuration and managed `AGENTS.md` and
`CLAUDE.md` guidance. Existing v2.0 runs remain replayable. `wstack runs`
discovers unfinished work, while append-only abandoned or superseded
dispositions keep obsolete runs out of discovery without deleting their events
or artifacts. Review Markdown and offline explorer views are additive; old
status and handoff views remain supported.

Run manifests retain the protocol version that created the run. After an
upgrade, derived status and review views show both `createdProtocolVersion` and
the replaying `runtimeProtocolVersion`; a difference is migration provenance,
not source/runtime drift.

The recovery envelope accepts v2.0 and v2.1 protocol records only. An unknown
protocol version must stop before changing canonical state. Recovery may update
the workspace config and append one setup migration record, and may regenerate
derived views from a verified event log. It must not rewrite a historical run
manifest, event, accepted artifact, receipt, or migration record in place.

V2 replaces the former 65-skill decision surface with 13 public skills. The
table below is the complete old-to-new mapping. Names in the left column are
retired entry points, not compatibility aliases.

## Skill mapping

| Retired skill | v2 destination |
|---|---|
| `agent-brief` | [`specify`](../skills/specify/SKILL.md) + [`plan-tasks`](../skills/plan-tasks/SKILL.md) (worker briefs are generated projections) |
| `agent-evaluation` | [`w-mode`](../skills/w-mode/SKILL.md), `agent-evaluation` workflow |
| `audit` | [`verify-review`](../skills/verify-review/SKILL.md), evidence and provenance checks |
| `autopilot` | [`w-mode`](../skills/w-mode/SKILL.md), continuous flow under the selected authority tier |
| `baseline` | [`w-mode`](../skills/w-mode/SKILL.md), `product-evaluation` workflow |
| `blast-radius` | [`understand`](../skills/understand/SKILL.md) + [`verify-review`](../skills/verify-review/SKILL.md) risk lenses |
| `bug-fix` | [`w-mode`](../skills/w-mode/SKILL.md), `bug` workflow |
| `build-evaluator` | [`w-mode`](../skills/w-mode/SKILL.md), `product-evaluation` workflow |
| `deep-modules` | [`w-mode`](../skills/w-mode/SKILL.md), `Deep Modules and Honest Seams` in the loaded principles |
| `discover-failures` | [`w-mode`](../skills/w-mode/SKILL.md), `product-evaluation` workflow |
| `evidence-ladder` | [`verify-review`](../skills/verify-review/SKILL.md), evidence algebra |
| `feature-work` | [`w-mode`](../skills/w-mode/SKILL.md), `feature` workflow |
| `frame-decision` | [`grill`](../skills/grill/SKILL.md) for consequential decisions; [`w-mode`](../skills/w-mode/SKILL.md) frames the run |
| `frame-outcome` | [`w-mode`](../skills/w-mode/SKILL.md), `FRAMED` lifecycle stage |
| `handoff` | [`continue-work`](../skills/continue-work/SKILL.md) |
| `hillclimb` | [`w-mode`](../skills/w-mode/SKILL.md), `hillclimb` workflow |
| `how-it-works` | [`understand`](../skills/understand/SKILL.md) |
| `maintain-verification-skill` | [`verify-review`](../skills/verify-review/SKILL.md), verifier maintenance route |
| `orient` | [`w-mode`](../skills/w-mode/SKILL.md), `product-evaluation` workflow |
| `pause-safely` | [`continue-work`](../skills/continue-work/SKILL.md) |
| `phase-boundary` | [`continue-work`](../skills/continue-work/SKILL.md) + continuous [`w-mode`](../skills/w-mode/SKILL.md) routing |
| `principle-boundary-discipline` | [`w-mode`](../skills/w-mode/SKILL.md), loaded principle reference |
| `principle-build-the-lever` | [`w-mode`](../skills/w-mode/SKILL.md), loaded principle reference |
| `principle-encode-lessons-in-structure` | [`learn`](../skills/learn/SKILL.md) + [`w-mode`](../skills/w-mode/SKILL.md) principle reference |
| `principle-exhaust-the-design-space` | [`grill`](../skills/grill/SKILL.md) or [`prototype`](../skills/prototype/SKILL.md) |
| `principle-experience-first` | [`w-mode`](../skills/w-mode/SKILL.md), loaded principle reference |
| `principle-fix-root-causes` | [`understand`](../skills/understand/SKILL.md) + `bug` workflow in [`w-mode`](../skills/w-mode/SKILL.md) |
| `principle-foundational-thinking` | [`w-mode`](../skills/w-mode/SKILL.md), loaded principle reference |
| `principle-guard-the-context-window` | [`w-mode`](../skills/w-mode/SKILL.md), progressive loading |
| `principle-laziness-protocol` | [`w-mode`](../skills/w-mode/SKILL.md), loaded principle reference |
| `principle-make-operations-idempotent` | [`w-mode`](../skills/w-mode/SKILL.md), runtime idempotency invariant |
| `principle-migrate-callers-then-delete-legacy-apis` | `refactor-migration` workflow in [`w-mode`](../skills/w-mode/SKILL.md) |
| `principle-minimize-reader-load` | [`w-mode`](../skills/w-mode/SKILL.md), progressive loading |
| `principle-model-the-domain` | [`w-mode`](../skills/w-mode/SKILL.md), loaded principle reference |
| `principle-never-block-on-the-human` | [`w-mode`](../skills/w-mode/SKILL.md), authority and gate routing |
| `principle-outcome-oriented-execution` | [`w-mode`](../skills/w-mode/SKILL.md), lifecycle and exit predicate |
| `principle-prove-it-works` | [`verify-review`](../skills/verify-review/SKILL.md) |
| `principle-redesign-from-first-principles` | [`grill`](../skills/grill/SKILL.md) + [`prototype`](../skills/prototype/SKILL.md) |
| `principle-separate-before-serializing-shared-state` | `refactor-migration` workflow in [`w-mode`](../skills/w-mode/SKILL.md) |
| `principle-sequence-verifiable-units` | [`plan-tasks`](../skills/plan-tasks/SKILL.md) + [`implement-run`](../skills/implement-run/SKILL.md) |
| `principle-subtract-before-you-add` | [`w-mode`](../skills/w-mode/SKILL.md), loaded principle reference |
| `principle-type-system-discipline` | [`w-mode`](../skills/w-mode/SKILL.md), loaded principle reference |
| `product-evaluation` | [`w-mode`](../skills/w-mode/SKILL.md), `product-evaluation` workflow |
| `qualify-change` | [`w-mode`](../skills/w-mode/SKILL.md), `product-evaluation` workflow |
| `red-team` | [`verify-review`](../skills/verify-review/SKILL.md) risk lens or the evaluation graph in [`w-mode`](../skills/w-mode/SKILL.md) |
| `refactor-migration` | [`w-mode`](../skills/w-mode/SKILL.md), `refactor-migration` workflow |
| `reflect` | [`learn`](../skills/learn/SKILL.md) |
| `report` | [`verify-review`](../skills/verify-review/SKILL.md) and generated runtime views |
| `retro` | [`learn`](../skills/learn/SKILL.md) |
| `review` | [`verify-review`](../skills/verify-review/SKILL.md) |
| `session-pickup` | [`continue-work`](../skills/continue-work/SKILL.md) |
| `unslop` | [`verify-review`](../skills/verify-review/SKILL.md), repository-standards review axis, and `Writing Discipline` in the loaded principles |
| `validate-evaluator` | [`w-mode`](../skills/w-mode/SKILL.md), `product-evaluation` workflow |
| `verification-skill` | [`verify-review`](../skills/verify-review/SKILL.md), verifier creation route |
| `why-this-way` | [`understand`](../skills/understand/SKILL.md), rationale mode |

The retained public skills are `setup-wstack`, `w-mode`, `grill`, `specify`,
`plan-tasks`, `implement-run`, `verify-review`, `continue-work`, `learn`, and
the standalone specialists `understand`, `prototype`, `tdd`, and `open-pr`.
Workflow names in the table are references selected by `w-mode`, not retired
skills that should be re-created.

## Durable-state migration

The old layout was type-centric (for example, separate global `specs/`,
`tasks/`, and `reviews/` trees). V2 is run-centric:

- Shared project context, decisions, policies, and versioned verifiers move
  once to `.wstack/context/`, `.wstack/decisions/`, `.wstack/config.json`, and
  `.wstack/verifiers/`.
- Each run receives a stable ID under `.wstack/runs/<run-id>/`; its append-only
  `events.ndjson`, immutable artifact revisions, typed receipts, and generated
  `views/` move together.
- Evidence payloads move to the content-addressed evidence store when policy
  permits. Committed manifests retain digest, media type, redaction,
  provenance, and availability; missing private payloads remain explicitly
  unavailable rather than being fabricated.
- Migration metadata and source digests go under `.wstack/migrations/`.
  Preserve source IDs and timestamps in imported event data so history remains
  auditable. Do not rewrite an accepted artifact in place: import it as an
  immutable revision and create successor revisions for amendments.

## Safe migration sequence

1. Freeze the old checkout and record its commit, state paths, and source
   digests. Do not delete legacy records yet.
2. Invoke [setup-wstack](../skills/setup-wstack/SKILL.md) to install or
   upgrade the pinned runtime and establish the v2 policy. Preserve existing
   instruction files and remote credentials.
3. Confirm the source config is v2.0 (or already v2.1). Unsupported protocol
   versions stop before mutation; do not coerce them into the current version.
4. Classify each old record as shared project knowledge, a decision, a
   verifier, or run-owned work. Assign or preserve a stable run ID; do not
   duplicate shared context into every run.
5. Import accepted specifications, task graphs, artifacts, reviews, and
   evidence as immutable records with source provenance. Convert old summaries
   into generated views or handoff notes, never canonical state.
6. Rebind receipts to the v2 specification revision, comparison point,
   verifier/procedure digest, environment, and evidence manifest. Mark any
   unprovable or unavailable receipt stale; terminal eligibility must be
   re-established with fresh evidence.
7. Write a migration record containing source version, target protocol,
   mappings, imported digests, unresolved records, rollback point, and the
   responsible authority. Regenerate status and handoff views from replayed
   events.
8. Validate one representative run through `status`, `handoff`, and its
   required verification path. Only then remove obsolete files in a separate,
   authorized cleanup change.

The installed runtime command list is discoverable with
`node .wstack/bin/wstack.mjs help`; migration is a state-preserving procedure,
not an invented one-off command. Reconcile GitHub only after canonical state
is valid. Existing issues, pull requests, CI observations, and URLs are remote
projections: import their observations with idempotency keys, and never let a
remote projection overwrite `.wstack/` history.

## Rollback and continuity

Rollback means returning to the frozen source checkout and retaining the v2
migration record; it does not mean deleting append-only events. If migration
pauses, [continue-work](../skills/continue-work/SKILL.md) can render a handoff
from replayed state. A new coordinator or cloud worker must recover through
the lease and completion-bundle protocol. Any code-head, specification,
verifier, procedure, environment, or evidence change stales affected receipts
and requires re-verification before delivery.
