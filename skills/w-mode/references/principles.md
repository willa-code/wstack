# Named principles by trigger

Load a principle when its trigger appears. State the choice it changed; a name
without a changed decision is not application. Mechanical invariants belong
to the engine and shared references, not repeated principle prose.

| Trigger | Principle | Required move |
|---|---|---|
| Proposed abstraction or broad diff | Laziness Protocol | Choose the smallest evidence-justified change. |
| Draft prose, prompts, or generated instructions | Writing Discipline | Remove filler, vague claims, duplicate advice, and untestable language; every instruction earns its context. |
| New logic or shared state | Foundational Thinking | Name data shapes, sequencing, and ownership first. |
| Requirement conflicts with current shape | Redesign From First Principles | Derive the target design from constraints, then migrate. |
| Addition increases surface | Subtract Before You Add | Remove obsolete paths before adding replacements. |
| Reader must trace layers or distant state | Minimize Reader Load | Collapse indirection and shrink state scope. |
| Module boundary or growing dependency surface | Deep Modules and Honest Seams | Put complexity behind a small stable interface; expose seams where behavior can be observed and replaced. |
| Multi-phase rewrite | Outcome-Oriented Execution | Make each phase converge on the declared target. |
| UX or product tradeoff | Experience First | Optimize the user journey over implementation convenience. |
| Novel consequential design | Exhaust the Design Space | Compare materially different candidates before choosing. |
| Repeated manual work or unverifiable claim | Build the Lever | Build the smallest tool that performs or proves it. |
| Stateful conditional logic | Model the Domain | Encode legal states and transitions in structure. |
| Input, output, or provider boundary | Boundary Discipline | Validate once at the boundary; keep the core clean. |
| Typed implementation | Type System Discipline | Make illegal states unrepresentable where practical. |
| Retry, reconciliation, or remote mutation | Make Operations Idempotent | Give operations stable identities and repeat-safe effects. |
| Replacing an internal interface | Migrate Callers Then Delete Legacy APIs | Expand only if needed, migrate one wave, remove legacy. |
| Concurrent mutable target | Separate Before Serializing Shared State | Split ownership before introducing locks or queues. |
| Safety or completion claim | Prove It Works | Exercise the matching real surface and retain evidence. |
| Symptom or regression | Fix Root Causes | Confirm the causal mechanism before designing the fix. |
| Multi-step change | Sequence Verifiable Units | End each unit green and independently reviewable. |
| Large payload or many workers | Guard the Context Window | Keep raw detail in artifacts; pass bounded summaries. |
| Reversible uncertainty | Never Block on the Human | Discover facts and proceed; ask only for decisions or authority. |
| Recurring instruction or failure | Encode Lessons in Structure | Promote it to a mechanism only after evaluated evidence. |

Principles refine decisions inside the lifecycle in [lifecycle.md](lifecycle.md).
They cannot override [authority.md](authority.md) or lower the proof threshold
in [evidence.md](evidence.md).
