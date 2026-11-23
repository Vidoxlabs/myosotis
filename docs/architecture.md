# Myosotis architecture

Four parts, one hard rule each.

```
memory record ──► consent check ──► store (epoch N) ──► projections (cache, index, summary)
                        │                  │                    │
                   refusal on          forget(id)          stamp = epoch at build
                   missing grant            │                    │
                                           ▼                    ▼
                                    epoch N+1          stale stamp fails closed
```

## The memory record

Every record has `{ id, text, kind, scope }`. The `kind` is one of `organizational`, `personal-consented`, `active-thread`, or `unconfirmed`. The `scope` names who the memory belongs to, such as a team, a channel, or a person's space. A personal record also carries its sensitivity and explicit confirmation provenance.

## The consent registry

Grants and revocations over scopes. In this edition, consent is personal: the subject of the memory grants it. A grant says "personal memory in this scope is permitted." A revocation kills the grant. A later grant, ordered on the record by its sequence, is re-consent. The check is plain: a `personal-consented` record is admissible only while a live grant for its scope exists. Every other class is admitted without personal consent because none of them are personal memory — but scope is still required.

## The store and the epoch

The store is the ordered pair `{ epoch, records }`. The epoch is a monotonic counter that only moves when memory is forgotten.

- **Admission** validates the record, checks consent when the class is personal, stamps the record with the epoch it entered at, and appends. Refusals carry the reason.
- **Forget** is confirmed and keyed. It removes the record with that id and every record it superseded, leaves a digest-only tombstone for each, and bumps the epoch once. A repeated key replays without a second bump. Otherwise it or reports `unknown` with no state change. That asymmetry is deliberate: forgotten-with-bump on a hit, declared-unknown on a miss. A miss that bumped the epoch would poison every projection for nothing, and a hit that did not bump would leave stale projections serving dead content.

## Projections

Anything derived from the store — a cache, an index, a recall list, a summary — is a projection carrying the stamp of the epoch it was built at. A projection is current only while its stamp equals the store's epoch. The moment the epoch moves, every prior projection is stale, and stale means refused: rebuild from the store, never serve from the stale copy. This is the discipline that makes forget-correctness structural rather than a matter of hoping every consumer cleaned up its cache. In `src/`, `readProjection` refuses a stale or unverifiable projection and serves no records with the refusal, and `recallCurrent` rebuilds from the store before serving, so a consumer that reads through them cannot serve forgotten content. A projection holds identifiers and digests, not text; `recallCurrent` resolves text from the store and rebuilds when an entry no longer resolves.

## Continuity

A continuity is the one thread of memory a subject is working in. The ledger is a frozen value the caller holds in the process, keyed by the same subject string consent uses. Lookup only reads. Attach resumes the active continuity, or opens one when the subject has none, and refuses any id that is not that subject's active id with one answer that does not say why. Isolate retires the active id and opens a new one. The ledger touches neither the store nor its epoch.

## What this edition is

`src/` implements these four parts as pure state machines over explicit state objects: validation, consent state, admission, forget, and the epoch stamping, with continuity kept apart in its own ledger. No I/O, no store backend, no concurrency. A durable store behind this state machine is `specified` in the contracts; the mapping onto any particular database is deliberately out of scope here.
