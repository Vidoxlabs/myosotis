# CAP-11: Memory integration

- ID: `CAP-11`
- Title: Memory integration
- Lead: `myosotis`
- Touches: `bloom`, `capillary`
- Horizon: `next`
- Milestone: `M3`
- CLI phase: `P3`
- Status: `proposed`
- Claim: `planned`
- Depends on: `CAP-05`

## Why

Context retrieval and agent execution must integrate with governed memory without collapsing retrieval into durable memory, serving stale projections after a forget, leaking personal records without consent, or letting agent-written artifacts impersonate owner decisions.

## What it does

- **Typed memory kinds with provenance in context packets**: recalled memory enters the context packet built by `capillary` (`CAP-05`) carrying its closed `myosotis` kind (`organizational`, `personal-consented`, `active-thread`, `unconfirmed`) and explicit provenance metadata through `capillary`'s epoch-guarded packet builder (`buildEpochGuardedPacket`).
- **Consent before admission**: `personal-consented` records enter only when a live subject-granted consent grant covers the scope, sensitivity is in `{ public, internal, restricted }`, and provenance is `explicit-user`. Ambient conversation text never creates personal memory.
- **Structural forget across projections**: confirmed and keyed `forgetMemory` removes the record and its supersede chain, records digest-only tombstones, and bumps the store epoch once. Stale projections fail closed (`readProjection` refuses prior stamps; `recallCurrent` rebuilds before serving; `recallBounded` enforces character budgets).
- **Per-thread continuity**: `openContinuity`, `lookupContinuity`, `attachContinuity`, and `isolateContinuity` maintain at most one active continuity per thread/subject. Lookup never opens a continuity, and attach refuses unknown, isolated, or other-subject IDs with a single uniform error that reveals nothing.
- **Experience receipts (`CAP-11.1`, `D11`)**: agents may write experience receipts recording what ran, on which content digest, and with what result. Record validation enforces that experience receipts never carry owner-decision fields, consent grants, or ratified policy claims, and cannot read as an owner decision.
- **Fail-closed strict recall policy**: under strict recall policy, a failed memory read, unavailable epoch, or epoch change during packet assembly (`deletion-epoch-changed`, `deletion-epoch-unavailable`) stops the turn rather than proceeding silently without memory or serving stale state.
- **Digest-only trace logging**: run trace records (`CAP-10`) record recalled or forgotten memory identity strictly as 64-hex SHA-256 digests and counts, never raw memory text.

## Contract touchpoints

- `myosotis/docs/contracts/records.md`: closed four memory kinds, personal sensitivity and `explicit-user` provenance, plus experience receipt record shape and non-authority constraints (`CAP-11.1`).
- `myosotis/docs/contracts/consent.md`: subject-granted scope consent preceding personal admission and sequence-ordered revocation/re-consent.
- `myosotis/docs/contracts/forget.md`: confirmed and keyed forget, supersede chain tombstones, monotonic epoch bump, fail-closed stale projections, and bounded recall.
- `myosotis/docs/contracts/continuity.md`: one active continuity per subject/thread and uniform attach refusal.
- `capillary/docs/contracts/retrieval.md`: `buildEpochGuardedPacket`, typed memory provenance in context packets, and `deletion-epoch-changed` / `deletion-epoch-unavailable` refusals (`CAP-11.2`).
- `bloom/docs/architecture.md`: per-thread continuity wiring, consent enforcement on writes, strict fail-closed turn stop on memory read failure, and digest-only trace logging (`CAP-11.3`).

## Tool IDs and events

### Tool IDs

No new tool IDs are introduced by `CAP-11` (existing memory domain faces are documented in `docs/interop.md`).

| Tool ID | Effect class | Description |
| :--- | :--- | :--- |

### Events

No standalone events are introduced by `CAP-11`; context packet assembly emits `context.packet` (`CAP-05`), and trace records (`CAP-10`) log memory identity as digests only.

| Event | Source | Payload summary |
| :--- | :--- | :--- |

## Acceptance tests

- `experience-receipt-distinct-from-owner-decision`: an agent-written experience receipt records what ran, on which digest, and with what result, and is refused if shaped as or promoted to an owner decision, consent grant, or ratified rule (`D11`).
- `consent-precedes-personal-keep`: admitting a `personal-consented` record without a live subject-granted consent grant for the scope or without `explicit-user` provenance is refused.
- `forget-bumps-epoch-and-fails-stale-projection`: a confirmed keyed forget bumps the epoch, refuses projections carrying an earlier stamp, and rebuilds current recall without forgotten content.
- `epoch-guard-refuses-mid-read-forget`: `capillary` `buildEpochGuardedPacket` refuses packet assembly with `deletion-epoch-changed` when the epoch moves during a read, or `deletion-epoch-unavailable` when unreadable.
- `strict-recall-failure-stops-turn`: a failed memory read or epoch refusal under strict recall policy stops the turn rather than continuing with empty or stale memory.
- `trace-records-memory-digest-not-text`: trace entries emitted for recall and forget record memory identity as a SHA-256 digest and never emit raw memory text.
- `continuity-isolated-per-thread`: continuity lookup, attach, and isolate keep one active continuity per thread/subject and refuse unknown, isolated, or cross-subject IDs uniformly.

## Slices

- `CAP-11.1` (`myosotis`, `M3`, `proposed`): Experience receipt record rules and fail-closed strict recall policy.
- `CAP-11.2` (`capillary`, `M3`, `proposed`): Epoch-guarded packet integration with typed memory kinds and provenance.
- `CAP-11.3` (`bloom`, `M3`, `proposed`): Thread continuity, consent enforcement, and digest-only trace logging.

## Non-goals

- Implicit or ambient memory creation from conversation messages, tool outputs, or evidence reads without an explicit keep or receipt act.
- Silent promotion of `unconfirmed` or `active-thread` records or experience receipts into `personal-consented` memory or owner decisions.
- Semantic embedding indexes or external database services inside `myosotis`.
- Allowing any projection or trace output to expose forgotten memory text.

## Family rules and conflicts

- Retrieval informs and memory keeps (`docs/interop.md`): `capillary` retrieves bounded context with provenance (`CAP-05`), while `myosotis` governs consent, structural forget, and continuity. Neither impersonates the other.
- `myosotis` stays a zero-dependency pure reference library with no I/O, no model calls, and no sibling imports; `bloom` composes `myosotis` and `capillary`.
- Under `CAP-09` context compaction, any summary derived from recalled records links back to its replaced records so a structural forget invalidates derived summaries via epoch mismatch.
- Aligns with `CAP-06` and `CAP-07`: experience receipts and memory records never satisfy an owner gate.

## Open owner decisions

- `D11` (pending owner decision): Experience-only memory receipts. Confirm that agents may write experience receipts recording what ran, on which digest, and with what result, while prohibiting any agent-written record from reading as an owner decision, consent grant, or ratified rule.
- Strict recall failure scope (pending owner decision): Confirm whether strict turn-stop on memory read failure applies unconditionally to every run or allows an explicit opt-out when an objective declares no memory access.

## Evidence

- Status `planned`: Phase 0 specification created. Base record, consent, forget, bounded recall, and continuity state machines are implemented and verified by `npm test` in `myosotis` (`1.2.0`); `CAP-11.1` experience receipt rules and strict recall policy integration remain to be implemented.

## Changes

- `2026-11-23`: Initial Phase 0 specification (`CAP-01`).
- `2026-11-23`: Added `M3` slice milestones (`CAP-01`, review fixes).
