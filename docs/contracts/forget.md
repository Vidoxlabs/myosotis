# Contract: forget

Label: `specified` (rules), `implemented` (state machine in `src/forget.mjs`).

This is the contract the whole fabric is named for. A forget that cannot be trusted is worse than no memory at all.

## Shape

```
store { epoch: number, records: [...] }   — epoch is monotonic, starts at 0
store { epoch, records, tombstones, receipts }
admitMemory(store, consentState, record)   → { store, admitted, reason? }   record may name `supersedes`
forgetMemory(store, { id, confirmed, key }) → { store, status, reason?, forgotten, erased?, receipt?, tombstones? }
projectionStamp(store)                     → store.epoch
projectionIsValid(store, stamp)            → stamp === store.epoch
buildProjection(store)                     → frozen { stamp, records }
readProjection(store, projection)          → { status: 'current' | 'refused', reason?, records, stamp, epoch }
recallCurrent(store, projection?)          → { projection, records, rebuilt }
```

## The structural forget

1. **A hit removes and bumps.** Forgetting a record that exists removes it from the store and increments the epoch. Both, always, atomically. A remove without a bump is a cosmetic forget, and this fabric does not do cosmetic.
2. **A miss is declared unknown.** Forgetting an id that is not in the store changes nothing and reports `status: 'unknown'`. No epoch bump for a miss — a bump would invalidate every projection for no reason. The answer to a forget of a miss is honest: unknown, not success.
3. **A forget is confirmed and keyed.** Without `confirmed: true` nothing changes, and the result is `refused` with reason `confirmation-required`. A bare id is not a confirmation. A forget without a `key` is refused with `key-required`.
4. **A repeated key is a replay.** The same key for the same id returns `replayed` with the first receipt and the store unchanged: no second epoch bump. The same key for another id is refused with `key-conflict`.
5. **A forget erases the supersede chain.** A record admitted with `supersedes` marks the record it corrects `superseded`: withheld from recall, kept in the store, epoch unchanged. Forgetting a record erases it and every record reachable through `supersedes`, and leaves one tombstone per erased id: `{ id, namedId, digest, epoch }`. `namedId` is the id the forget was asked for. A tombstone holds no text.
6. **A tombstone is not a miss.** A forget of an id that is only a tombstone is `already-forgotten` and names its tombstones. Neither it nor a miss bumps the epoch.
7. **Stale projections fail closed.** A projection whose stamp no longer equals the store's epoch is refused. It is not served partially, it is not served with a warning; it is refused until rebuilt from the store. Serving from a stale projection is resurrection and it is prohibited.

## Serving a projection

`implemented` in `src/forget.mjs`. The read path enforces rule 7 instead of leaving it to
each consumer:

1. **`buildProjection` stamps and freezes an index.** A projection holds, per current
   record, `{ id, kind, scope, digest, admittedEpoch }`, plus the epoch it was built at.
   It is not a second copy of the text. Neither part can be edited afterwards.
2. **`readProjection` serves only a current projection.** A stamp that differs from the
   store's epoch, in either direction, is refused with reason `stale`. A projection whose
   stamp is not a non-negative integer, or that carries no record list, is refused with
   reason `unverifiable`. A refusal carries `records: null`: nothing is served partially
   or with a warning.
3. **`recallCurrent` rebuilds before it serves.** Given a current projection it returns
   that projection unchanged. Given a stale, unverifiable, or missing one, it rebuilds
   from the store and serves the rebuild, with `rebuilt: true`. Forgotten content cannot
   come back through it. Text is always read from the store: each entry must resolve to an
   active record with the same digest, and an entry that does not resolve (a supersede
   happened, or the digest differs) means a rebuild, even at the same epoch.

## Why the epoch exists

Every projection of memory — a recall cache, an index, a summary built for a prompt — carries the stamp of the epoch it was built at. The store's epoch only moves on a real forget. So a stamp mismatch has exactly one meaning: memory changed by forgetting, and anything remembered before it is suspect. This makes forget-correctness structural. A consumer cannot accidentally serve forgotten content from a cache without first choosing to ignore the stamp, and ignoring the stamp is an explicit, visible act.

## Prohibitions

- Never un-forget. The epoch never moves backward; records never return.
- Never serve from a stale projection while rebuilding; rebuild first, then serve.
- Never treat "forgotten" as "hidden but keepable." The record is gone from the store; a projection of it is not a copy that was set aside, it is an artifact whose source died.

## Bounded recall

`recallBounded({ records, maxChars = 6000, counts? })` selects from the records the
caller supplies. When reading from a store, pass the current records resolved by
`recallCurrent` or `recallAll`. A digest-only projection entry carries no text to select.

`candidateCount` counts the supplied records. `policyEligibleCount` counts entries
with a nonempty id and text, an allowed sensitivity (`public`, `internal`, or
`restricted`), and an active state when a state is supplied. The function keeps
whole eligible records in input order, skipping entries that exceed the remaining
budget. `selectedCount` and `usedChars` describe the returned `records`.

`maxChars` must be a positive integer. The returned `maxChars` is the smaller of the
requested limit and the library ceiling of 6000, measured by JavaScript string length.
If the caller provides `counts`, all three counts must be nonnegative integers with
`selectedCount <= policyEligibleCount <= candidateCount`. They must also match the
actual selection. A count or budget refusal throws `RecallError`.

## Changes

- `1.1.0` — adds bounded recall over caller-held records, with sensitivity filtering,
  a character limit, and checked count reporting.

- `0.4.0` — breaking. `forgetMemory` takes `{ id, confirmed, key }`; a bare id is
  refused and changes nothing. Forget erases the supersede chain with digest-only
  tombstones, and a repeated key replays without a second bump. `admitMemory` accepts
  `supersedes` and refuses a reused id. Projections hold ids and digests, not text, and
  `recallCurrent` resolves text from the store. Released as a minor bump because myosotis
  is pre-1.0. A caller that passed a bare id must confirm and key its forget.

- `0.2.0` — `buildProjection`, `readProjection`, and `recallCurrent` are new. Before
  `0.2.0` the stale-projection rule existed only as the `projectionIsValid` boolean, and nothing in `src/`
  refused to serve a stale projection. The change is additive; existing exports behave
  as before.

## What this contract does not claim

That a store backend, a projection implementation, or a network service implements any of this. It specifies the rules; `src/` is the tested reference state machine; wiring it to durability is future editions' work.
