# Durable results

Record outcomes, not skill invocations.

Inside an active run, a skill must record its result through the matching
runtime command before reporting that the work is complete. Meaningful results
include decisions, accepted artifacts, task graphs, claims, code checkpoints,
evidence, reviews, evaluations, gates, retries, delivery, pauses, and takeovers.
A blocked or inconclusive result is still meaningful and must be recorded.

Do not add an event merely because a skill was opened. Read-only exploration,
status checks, regenerated views, and true no-ops need no new event.

Outside a run, a casual read-only specialist call may remain ephemeral. If its
result must be resumed, audited, or used by later work, start a lightweight run
and record it there. Setup is the exception: configuration, runtime version,
and migration state live in shared `.wstack/` records before any run exists.

Use the narrowest typed record:

| Result | Durable record |
|---|---|
| facts, assumptions, decisions, prototype verdict | accepted grounding artifact |
| acceptance contract | accepted and approved specification or evaluation contract |
| work breakdown | accepted task graph |
| implementation | claim, completion bundle, retry, task completion, and comparison binding |
| proof | receipt |
| review | review verdict |
| AI product or agent judgment | evaluation record plus referenced artifacts |
| decision research | research contract, accepted grounding revisions, research receipts and reviews, then research outcome |
| delivery or PR | delivery record and optional remote projection |
| interruption or recovery | pause, resume, gate, handoff view, or takeover |

Never edit `events.ndjson` or generated views directly.

`status.*`, `handoff.*`, `review.md`, and `explorer.html` are replaceable
projections. Regenerate them with the runtime; the readable decision brief is
derived from accepted research grounding and is never a second verdict store.
