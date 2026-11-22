// Myosotis reference library tests. Every rule that matters is visible here.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MEMORY_KINDS,
  MemoryRecordError,
  memoryRecord,
  requiresConsent,
  consentGrant,
  revokeConsent,
  consentState,
  openStore,
  admitMemory,
  buildProjection,
  forgetMemory,
  recallAll,
  projectionStamp,
  projectionIsValid,
} from '../src/index.mjs';

const personalMetadata = { sensitivity: 'internal', provenance: { source: 'explicit-user' } };

test('the set of memory kinds is exactly the four distinguishable classes', () => {
  assert.deepEqual([...MEMORY_KINDS].sort(), [
    'active-thread',
    'organizational',
    'personal-consented',
    'unconfirmed',
  ]);
});

test('a valid record freezes the claimed shape', () => {
  const record = memoryRecord({
    id: 'n-1',
    text: 'The design review is on Thursday.',
    kind: 'organizational',
    scope: 'design-team',
  });
  assert.equal(record.id, 'n-1');
  assert.equal(record.kind, 'organizational');
  assert.equal(record.scope, 'design-team');
  assert.throws(() => { record.id = 'changed'; }, TypeError);
});

test('records without scope, id, or text are invalid', () => {
  assert.throws(() => memoryRecord({ id: '', text: 'x', kind: 'organizational', scope: 's' }));
  assert.throws(() => memoryRecord({ id: 'n', text: '', kind: 'organizational', scope: 's' }));
  assert.throws(() => memoryRecord({ id: 'n', text: 'x', kind: 'organizational', scope: '' }));
});

test('the kind set is closed: unknown kinds are rejected, not defaulted', () => {
  assert.throws(() => memoryRecord({ id: 'n', text: 'x', kind: 'durable', scope: 's' }));
  assert.throws(() => memoryRecord({ id: 'n', text: 'x', kind: 'fact', scope: 's' }));
});

test('only personal-consented memory requires consent', () => {
  assert.equal(requiresConsent('personal-consented'), true);
  assert.equal(requiresConsent('organizational'), false);
  assert.equal(requiresConsent('active-thread'), false);
  assert.equal(requiresConsent('unconfirmed'), false);
});

test('consent is granted by the subject: delegation is a named, refused non-goal', () => {
  assert.throws(() => consentGrant({ subject: 'ada', scope: 'ada-space', grantedBy: 'someone-else' }));
  const grant = consentGrant({ subject: 'ada', scope: 'ada-space', grantedBy: 'ada' });
  assert.equal(grant.scope, 'ada-space');
});

test('a consent state answers for its scopes and revocation kills the grant', () => {
  const grant = consentGrant({ subject: 'ada', scope: 'ada-space', grantedBy: 'ada' });
  const open = consentState({ grants: [grant] });
  assert.equal(open.hasConsentFor('ada-space'), true);
  assert.equal(open.hasConsentFor('other-space'), false);

  const revocation = revokeConsent({ subject: 'ada', scope: 'ada-space' });
  const closed = consentState({ grants: [grant], revocations: [revocation] });
  assert.equal(closed.hasConsentFor('ada-space'), false);
});

test('personal memory is refused admission without a live grant', () => {
  const store0 = openStore();
  const denied = admitMemory(store0, consentState({}), {
    id: 'p-1',
    text: 'Ada prefers morning meetings.',
    kind: 'personal-consented',
    scope: 'ada-space',
    ...personalMetadata,
  });
  assert.equal(denied.admitted, false);
  assert.match(denied.reason, /consent required/);
  assert.equal(denied.store.epoch, 0);
  assert.equal(denied.store.records.length, 0);
});

test('personal memory is admitted with a live grant, and organizational without one', () => {
  const grant = consentGrant({ subject: 'ada', scope: 'ada-space', grantedBy: 'ada' });
  const store0 = openStore();
  const personal = admitMemory(store0, consentState({ grants: [grant] }), {
    id: 'p-1',
    text: 'Ada prefers morning meetings.',
    kind: 'personal-consented',
    scope: 'ada-space',
    ...personalMetadata,
  });
  assert.equal(personal.admitted, true);
  assert.equal(personal.record.admittedEpoch, 0);

  const organizational = admitMemory(personal.store, consentState({}), {
    id: 'o-1',
    text: 'The review checklist lives in the pinned note.',
    kind: 'organizational',
    scope: 'design-team',
  });
  assert.equal(organizational.admitted, true);
  assert.deepEqual(
    recallAll(organizational.store).map((r) => r.id),
    ['p-1', 'o-1']
  );
});

test('an invalid record is refused admission, not thrown into the store', () => {
  const store0 = openStore();
  const refused = admitMemory(store0, consentState({}), { id: '', text: '', kind: 'nope', scope: '' });
  assert.equal(refused.admitted, false);
  assert.match(refused.reason, /invalid memory record/);
  assert.equal(refused.store, store0);
});

test('personal memory needs an admissible sensitivity and explicit user provenance even with a live grant', () => {
  const scope = 'personal-space';
  const subject = 'principal-1';
  const state = consentState({ grants: [consentGrant({ subject, scope, grantedBy: subject })] });
  const store = openStore();
  const personal = { id: 'p-1', text: 'Prefers a written agenda.', kind: 'personal-consented', scope };
  for (const [metadata, issue] of [
    [{ provenance: personalMetadata.provenance }, /sensitivity/],
    [{ sensitivity: 'internal' }, /provenance/],
    [{ ...personalMetadata, sensitivity: 'unknown' }, /sensitivity/],
    [{ ...personalMetadata, provenance: { source: 'model-inferred' } }, /provenance/],
  ]) {
    const input = { ...personal, ...metadata };
    assert.throws(() => memoryRecord(input), MemoryRecordError);
    const result = admitMemory(store, state, input);
    assert.equal(result.admitted, false);
    assert.equal(result.store, store);
    assert.match(result.reason, issue);
  }
  for (const sensitivity of ['public', 'internal', 'restricted']) {
    const provenance = { source: 'explicit-user' };
    const result = admitMemory(store, state, { ...personal, sensitivity, provenance });
    assert.equal(result.admitted, true);
    assert.equal(result.record.sensitivity, sensitivity);
    provenance.source = 'model-inferred';
    assert.deepEqual(result.record.provenance, { source: 'explicit-user' });
    assert.ok(Object.isFrozen(result.record.provenance));
    const [entry] = buildProjection(result.store).records;
    assert.deepEqual(entry, { id: personal.id, kind: personal.kind, scope, digest: result.record.digest, admittedEpoch: 0 });
  }
});

test('nonpersonal memory kinds still admit without personal classification', () => {
  for (const kind of ['organizational', 'active-thread', 'unconfirmed']) {
    const result = admitMemory(openStore(), consentState({}), { id: 'm-1', text: 'Draft outline.', kind, scope: 'team' });
    assert.equal(result.admitted, true);
    assert.equal(Object.hasOwn(result.record, 'sensitivity'), false);
    assert.equal(Object.hasOwn(result.record, 'provenance'), false);
  }
});

test('a forget hit removes the record and bumps the epoch', () => {
  const grant = consentGrant({ subject: 'ada', scope: 'ada-space', grantedBy: 'ada' });
  const store0 = openStore();
  const { store: store1 } = admitMemory(store0, consentState({ grants: [grant] }), {
    id: 'p-1',
    text: 'Ada prefers morning meetings.',
    kind: 'personal-consented',
    scope: 'ada-space',
    ...personalMetadata,
  });
  const { store: store2 } = admitMemory(store1, consentState({}), {
    id: 'o-1',
    text: 'The checklist is pinned.',
    kind: 'organizational',
    scope: 'design-team',
  });
  assert.equal(store2.epoch, 0);

  const forgotten = forgetMemory(store2, { id: 'p-1', confirmed: true, key: 'forget-p-1' });
  assert.equal(forgotten.status, 'forgotten');
  assert.equal(forgotten.forgotten.id, 'p-1');
  assert.equal(forgotten.store.epoch, 1);
  assert.deepEqual(
    recallAll(forgotten.store).map((r) => r.id),
    ['o-1']
  );
});

test('a forget miss is declared unknown with no state change and no epoch bump', () => {
  const store0 = openStore();
  const { store: store1 } = admitMemory(store0, consentState({}), {
    id: 'o-1',
    text: 'Pinned note.',
    kind: 'organizational',
    scope: 'design-team',
  });
  const missed = forgetMemory(store1, { id: 'not-there', confirmed: true, key: 'forget-not-there' });
  assert.equal(missed.status, 'unknown');
  assert.equal(missed.forgotten, null);
  assert.equal(missed.store.epoch, 0);
  assert.equal(missed.store.records.length, 1);
});

test('a projection is current only while its stamp matches; after a forget it is stale', () => {
  const store0 = openStore();
  const { store: store1 } = admitMemory(store0, consentState({}), {
    id: 'o-1',
    text: 'Pinned note.',
    kind: 'organizational',
    scope: 'design-team',
  });
  const stampBefore = projectionStamp(store1);
  assert.equal(projectionIsValid(store1, stampBefore), true);

  const { store: afterForget } = forgetMemory(store1, { id: 'o-1', confirmed: true, key: 'forget-o-1' });
  assert.equal(projectionIsValid(afterForget, stampBefore), false);

  // The stale projection refuses: rebuilding at the current stamp is valid again.
  const rebuilt = recallAll(afterForget);
  const stampAfter = projectionStamp(afterForget);
  assert.equal(stampAfter > stampBefore, true);
  assert.equal(projectionIsValid(afterForget, stampAfter), true);
  assert.equal(rebuilt.some((r) => r.id === 'o-1'), false);
});

test('resurrection is structural: an old projection cannot serve past a forget', () => {
  const store0 = openStore();
  const { store: store1 } = admitMemory(store0, consentState({}), {
    id: 'secret-1',
    text: 'Sensitive note.',
    kind: 'organizational',
    scope: 'design-team',
  });
  const staleProjection = recallAll(store1);
  const staleStamp = projectionStamp(store1);

  const { store: afterForget } = forgetMemory(store1, { id: 'secret-1', confirmed: true, key: 'forget-secret-1' });
  // The old projection still holds the content in memory. The stamp is what
  // says it may not be served. A consumer honoring the contract refuses it.
  assert.equal(projectionIsValid(afterForget, staleStamp), false);
  assert.equal(staleProjection.length, 1);
  assert.equal(recallAll(afterForget).some((r) => r.id === 'secret-1'), false);
});

test('unconfirmed observations are admitted as unconfirmed and stay marked', () => {
  const store0 = openStore();
  const { store: store1, admitted } = admitMemory(store0, consentState({}), {
    id: 'u-1',
    text: 'Maybe the deploy window moved.',
    kind: 'unconfirmed',
    scope: 'design-team',
  });
  assert.equal(admitted, true);
  const [observed] = recallAll(store1);
  assert.equal(observed.kind, 'unconfirmed');
});
