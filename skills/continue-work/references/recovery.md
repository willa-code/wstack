# Coordinator and Recovery Protocol

One coordinator owns canonical event ingestion. Its location is irrelevant: it
may run on a laptop, a hosted checkout, or a cloud agent. Authority is a
renewable lease over a run, not an identity inferred from the conversation.

## Takeover

1. Confirm the prior lease was explicitly released or has expired. Never steal
   an unexpired lease based only on silence.
2. Replay committed events and validate the event chain before trusting derived
   status.
3. Reconcile active unit claims against branches/checkouts, accepted completion
   bundles, evidence manifests, and provider observations.
4. Expire abandoned claims according to policy; record a takeover event with
   prior and new coordinator IDs, environments, lease facts, and reconciliation
   results.
5. Regenerate frontier, status, handoff, and review views before assigning more
   work.

## Recovery rules

- Import completion bundles by stable event and bundle IDs; duplicate delivery
  is a no-op after digest validation.
- A late worker return is not current by default. Compare its contract, base,
  ownership, and spec digests with the current run before accepting or
  quarantining it.
- Revalidate load-bearing evidence after environment or verifier changes.
- Classify failures before retrying. Retry at most the policy budget (two by
  default) with a strategy suited to the failure, then emit `needs-replan`.
  Never weaken the exit predicate to make a retry pass.
- Infrastructure-wide failure triggers a run stop-line rather than exhausting
  each unit independently.
- Missing payloads, branches, or provider access remain explicit unavailable
  observations, never inferred successes.

## Cloud transfer

Transfer committed run state, the pinned project runtime, accepted artifacts,
and content-addressed evidence manifests. Do not transfer process IDs, local
locks, credentials, or assumptions that a live instance survived. The receiving
coordinator establishes a new environment identity and reruns the minimum
Doctor checks before advancing.
