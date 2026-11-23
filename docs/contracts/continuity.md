# Contract: continuity

Label: `specified` (rules), `implemented` (the in-process ledger in `src/continuity.mjs`).

A continuity is the one thread of memory a subject is working in. The ledger answers
which continuity a caller is attached to. It holds no memory, grants no consent, and
forgets nothing. The rules are ported from the predecessor's attach, isolate, and
active-lookup rules. Its query and its scope columns are not ported.

## Shape

```
openContinuity()                                     → frozen { continuities: [] }
lookupContinuity(ledger, { subject })                → frozen { attached, continuityId }
attachContinuity(ledger, { subject, continuityId? }) → frozen { ledger, continuityId, created }
isolateContinuity(ledger, { subject })               → frozen { ledger, continuityId, isolatedId }

continuity   frozen { id, subject, state }   state: active | isolated
```

`subject` is the non-empty string consent already uses for the subject of memory. A
continuity id is an opaque string, opened at random. Callers keep it and pass it back;
they do not build one.

## Rules

1. **One active continuity per subject.** A subject has at most one active
   continuity. Other subjects' continuities are never read or changed on its behalf.
2. **Lookup only reads.** `lookupContinuity` returns `{ attached: true, continuityId }`
   for the subject's active continuity, or `{ attached: false, continuityId: null }`
   when none is attached. It never opens a continuity, and it returns no ledger.
3. **Attach with no id resumes or opens.** With `continuityId` absent or `null`,
   `attachContinuity` returns the active continuity with `created: false` and the
   ledger unchanged. Only when the subject has none does it open one, with
   `created: true` and a new ledger.
4. **Attach with an id succeeds only for that subject's active id.** The ledger is
   returned as given, with `created: false`. An unknown id, an isolated id, and another
   subject's id are one refusal: `ContinuityError` with code
   `continuity-not-attachable` and the same message every time. The refusal names no
   id, no subject, and no state, so it does not say which of the three it was. An id
   from another ledger is unknown to this one and gets the same refusal.
5. **Isolate opens a new active id.** `isolateContinuity` marks the subject's active
   continuity `isolated`, opens a new active one, and returns both ids as
   `continuityId` and `isolatedId`. An isolated id never attaches again, and no call
   makes it active. With nothing attached, isolate opens a continuity and
   `isolatedId` is `null`, as the predecessor's isolate did.
6. **Malformed input is a different refusal.** A missing or empty `subject`, a
   `continuityId` that is present but not a non-empty string, and a value that is not a
   continuity ledger are refused with code `continuity-invalid`, before the ledger is
   searched. A continuity ledger holds continuities that each have an id, a subject,
   and the state `active` or `isolated`. No id appears twice, and no subject holds two
   active continuities.
7. **Values, not mutation.** Every result and every ledger is frozen. A call never
   changes the ledger it was given.

## In the process

A ledger is a value the caller holds in the process. Nothing is written to a file, a
database, or the network. A new process opens an empty ledger. Its lookup reports none
attached, and an id the earlier process opened is refused like any unknown id. A
durable continuity store is not part of this edition.

## What continuity does not touch

- Forget, consent, sensitivity, and provenance are unchanged. `openStore`,
  `admitMemory`, `forgetMemory`, `buildProjection`, `readProjection`, `recallCurrent`,
  and `recallBounded` neither take nor check a continuity. A continuity carries no
  epoch. The forget epoch stays on the store.
- A subject is the string the caller supplies. The ledger does not authenticate it.
  Whatever composes myosotis decides who a caller is before it names a subject.

## Not ported

The predecessor keeps continuity as rows in a database table, scoped by several
columns, with a consent epoch, a deletion epoch, a version counter, timestamps, a
privacy mode, and row locks on each continuity. It also refuses memory reads and writes
outside an active continuity. None of that is in this repository.

## Changes

- `1.2.0` — additive `openContinuity`, `lookupContinuity`, `attachContinuity`,
  `isolateContinuity`, and `ContinuityError` exports. No record, consent, forget,
  projection, or recall call changes, and every call valid under `1.1.0` stays valid.
