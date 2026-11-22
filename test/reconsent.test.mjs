// Re-consent: a new grant after a revocation, on the record. Contract: docs/contracts/consent.md

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ConsentError,
  consentGrant,
  revokeConsent,
  consentState,
  openStore,
  admitMemory,
} from '../src/index.mjs';

const grantAt = (sequence) => consentGrant({ subject: 'ada', scope: 'ada-space', grantedBy: 'ada', sequence });
const revokeAt = (sequence) => revokeConsent({ subject: 'ada', scope: 'ada-space', sequence });

test('consent records carry their sequence, or null when none is given', () => {
  assert.equal(grantAt(3).sequence, 3);
  assert.equal(revokeAt(4).sequence, 4);
  assert.equal(consentGrant({ subject: 'ada', scope: 'ada-space', grantedBy: 'ada' }).sequence, null);
  assert.equal(revokeConsent({ subject: 'ada', scope: 'ada-space' }).sequence, null);
});

test('a sequence is a non-negative integer', () => {
  for (const bad of [-1, 1.5, '2', Number.NaN]) {
    assert.throws(() => grantAt(bad), ConsentError);
    assert.throws(() => revokeAt(bad), ConsentError);
  }
});

test('a grant after the revocation is re-consent', () => {
  const state = consentState({ grants: [grantAt(1), grantAt(3)], revocations: [revokeAt(2)] });
  assert.equal(state.hasConsentFor('ada-space'), true);
  assert.deepEqual(state.activeGrants.map((g) => g.sequence), [3]);   // the revoked grant stays dead
});

test('a revocation after the re-consent kills it again', () => {
  const state = consentState({ grants: [grantAt(1), grantAt(3)], revocations: [revokeAt(2), revokeAt(4)] });
  assert.equal(state.hasConsentFor('ada-space'), false);
});

test('a tie goes to the revocation', () => {
  const state = consentState({ grants: [grantAt(2)], revocations: [revokeAt(2)] });
  assert.equal(state.hasConsentFor('ada-space'), false);
});

test('without a sequence on both sides, the revocation wins', () => {
  const unsequencedGrant = consentGrant({ subject: 'ada', scope: 'ada-space', grantedBy: 'ada' });
  const unsequencedRevoke = revokeConsent({ subject: 'ada', scope: 'ada-space' });
  assert.equal(consentState({ grants: [grantAt(9)], revocations: [unsequencedRevoke] }).hasConsentFor('ada-space'), false);
  assert.equal(consentState({ grants: [unsequencedGrant], revocations: [revokeAt(0)] }).hasConsentFor('ada-space'), false);
});

test('revocation stays scoped to its own subject and scope', () => {
  const other = consentGrant({ subject: 'bo', scope: 'bo-space', grantedBy: 'bo', sequence: 1 });
  const state = consentState({ grants: [grantAt(1), other], revocations: [revokeAt(5)] });
  assert.equal(state.hasConsentFor('ada-space'), false);
  assert.equal(state.hasConsentFor('bo-space'), true);
});

test('personal memory is admitted again only after re-consent', () => {
  const record = { id: 'p-1', text: 'Ada prefers morning meetings.', kind: 'personal-consented', scope: 'ada-space' };
  const revoked = admitMemory(openStore(), consentState({ grants: [grantAt(1)], revocations: [revokeAt(2)] }), record);
  assert.equal(revoked.admitted, false);
  const reconsented = admitMemory(
    openStore(),
    consentState({ grants: [grantAt(1), grantAt(3)], revocations: [revokeAt(2)] }),
    record,
  );
  assert.equal(reconsented.admitted, true);
});
