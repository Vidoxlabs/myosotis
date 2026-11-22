# Contract: forget

Label: `specified` (rules), `implemented` (state machine in `src/forget.mjs`).

This is the contract the whole fabric is named for. A forget that cannot be trusted is worse than no memory at all.

## Shape

```
store { epoch: number, records: [...] }   — epoch is monotonic, starts at 0
admitMemory(store, consentState, record)   → { store, admitted, reason? }
forgetMemory(store, id)                    → { store, status, forgotten }
projectionStamp(store)                     → store.epoch
projectionIsValid(store, stamp)            → stamp === store.epoch
buildProjection(store)                     → frozen { stamp, records }
readProjection(store, projection)          → { status: 'current' | 'refused', reason?, records, stamp, epoch }
recallCurrent(store, projection?)          → { projection, records, rebuilt }
```

## The structural forget

1. **A hit removes and bumps.** Forgetting a record that exists removes it from the store and increments the epoch. Both, always, atomically. A remove without a bump is a cosmetic forget, and this fabric does not do cosmetic.
2. **A miss is declared unknown.** Forgetting an id that is not in the store changes nothing and reports `status: 'unknown'`. No epoch bump for a miss — a bump would invalidate every projection for no reason. The answer to a forget of a miss is honest: unknown, not success.
3. **Stale projections fail closed.** A projection whose stamp no longer equals the store's epoch is refused. It is not served partially, it is not served with a warning; it is refused until rebuilt from the store. Serving from a stale projection is resurrection and it is prohibited.

## Serving a projection

`implemented` in `src/forget.mjs`. The read path enforces rule 3 instead of leaving it to
each consumer:

1. **`buildProjection` stamps and freezes.** A projection is the current recall list plus
   the epoch it was built at. Neither can be edited afterwards.
2. **`readProjection` serves only a current projection.** A stamp that differs from the
   store's epoch, in either direction, is refused with reason `stale`. A projection whose
   stamp is not a non-negative integer, or that carries no record list, is refused with
   reason `unverifiable`. A refusal carries `records: null`: nothing is served partially
   or with a warning.
3. **`recallCurrent` rebuilds before it serves.** Given a current projection it returns
   that projection unchanged. Given a stale, unverifiable, or missing one, it rebuilds
   from the store and serves the rebuild, with `rebuilt: true`. Forgotten content cannot
   come back through it.

## Why the epoch exists

Every projection of memory — a recall cache, an index, a summary built for a prompt — carries the stamp of the epoch it was built at. The store's epoch only moves on a real forget. So a stamp mismatch has exactly one meaning: memory changed by forgetting, and anything remembered before it is suspect. This makes forget-correctness structural. A consumer cannot accidentally serve forgotten content from a cache without first choosing to ignore the stamp, and ignoring the stamp is an explicit, visible act.

## Prohibitions

- Never un-forget. The epoch never moves backward; records never return.
- Never serve from a stale projection while rebuilding; rebuild first, then serve.
- Never treat "forgotten" as "hidden but keepable." The record is gone from the store; a projection of it is not a copy that was set aside, it is an artifact whose source died.

## Changes

- `0.2.0` — `buildProjection`, `readProjection`, and `recallCurrent` are new. Before
  `0.2.0` rule 3 existed only as the `projectionIsValid` boolean, and nothing in `src/`
  refused to serve a stale projection. The change is additive; existing exports behave
  as before.

## What this contract does not claim

That a store backend, a projection implementation, or a network service implements any of this. It specifies the rules; `src/` is the tested reference state machine; wiring it to durability is future editions' work.
