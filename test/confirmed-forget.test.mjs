// Confirmed, keyed forget; tombstones across a supersede chain; digest-only projections.
// Contract: docs/contracts/forget.md

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  openStore,
  admitMemory,
  forgetMemory,
  recallAll,
  consentState,
  buildProjection,
  readProjection,
  recallCurrent,
} from '../src/index.mjs';

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const none = consentState({});

function admit(store, id, text, extra = {}) {
  const result = admitMemory(store, none, { id, text, kind: 'organizational', scope: 'design-team', ...extra });
  assert.equal(result.admitted, true, result.reason);
  return result.store;
}

test('a forget without confirmation changes nothing', () => {
  const store = admit(openStore(), 'o-1', 'Pinned note.');
  for (const request of ['o-1', { id: 'o-1', key: 'k-1' }, { id: 'o-1', key: 'k-1', confirmed: 'yes' }, null]) {
    const result = forgetMemory(store, request);
    assert.equal(result.status, 'refused');
    assert.equal(result.reason, 'confirmation-required');
    assert.equal(result.store, store);
  }
  assert.equal(forgetMemory(store, { id: 'o-1', confirmed: true }).reason, 'key-required');
  assert.equal(forgetMemory(store, { confirmed: true, key: 'k-1' }).reason, 'id-required');
  assert.deepEqual(recallAll(store).map((r) => r.id), ['o-1']);
  assert.equal(store.epoch, 0);
});

test('a supersede withholds the old record without moving the epoch', () => {
  let store = admit(openStore(), 'v1', 'The window is Tuesday.');
  store = admit(store, 'v2', 'The window is Thursday.', { supersedes: 'v1' });
  assert.equal(store.epoch, 0);
  assert.deepEqual(recallAll(store).map((r) => r.id), ['v2']);
  const old = store.records.find((r) => r.id === 'v1');
  assert.equal(old.state, 'superseded');
  assert.equal(old.supersededBy, 'v2');
  assert.equal(admitMemory(store, none, {
    id: 'v3', text: 'x', kind: 'organizational', scope: 'design-team', supersedes: 'v1',
  }).admitted, false);                                                    // only a current record is superseded
  assert.equal(admitMemory(store, none, {
    id: 'v2', text: 'again', kind: 'organizational', scope: 'design-team',
  }).admitted, false);                                                    // an id is used once
});

test('forgetting a record tombstones the records it superseded, under the named id', () => {
  let store = admit(openStore(), 'v1', 'The window is Tuesday.');
  store = admit(store, 'v2', 'The window is Thursday.', { supersedes: 'v1' });
  store = admit(store, 'v3', 'The window is Friday.', { supersedes: 'v2' });
  store = admit(store, 'other', 'Unrelated note.');

  const result = forgetMemory(store, { id: 'v3', confirmed: true, key: 'forget-window' });
  assert.equal(result.status, 'forgotten');
  assert.deepEqual(result.erased, ['v3', 'v2', 'v1']);
  assert.equal(result.store.epoch, 1);                                    // one bump for the whole chain
  assert.deepEqual(result.store.records.map((r) => r.id), ['other']);
  assert.deepEqual(result.store.tombstones, [
    { id: 'v3', namedId: 'v3', digest: sha('The window is Friday.'), epoch: 1 },
    { id: 'v2', namedId: 'v3', digest: sha('The window is Thursday.'), epoch: 1 },
    { id: 'v1', namedId: 'v3', digest: sha('The window is Tuesday.'), epoch: 1 },
  ]);
  for (const tombstone of result.store.tombstones) {
    assert.deepEqual(Object.keys(tombstone).sort(), ['digest', 'epoch', 'id', 'namedId']); // no text survives
  }
  const later = forgetMemory(result.store, { id: 'v1', confirmed: true, key: 'forget-v1' });
  assert.equal(later.status, 'already-forgotten');
  assert.equal(later.store.epoch, 1);
  assert.equal(later.tombstones[0].namedId, 'v3');
});

test('repeating the same forget key does not bump the epoch again', () => {
  let store = admit(openStore(), 'o-1', 'Pinned note.');
  store = admit(store, 'o-2', 'Second note.');
  const first = forgetMemory(store, { id: 'o-1', confirmed: true, key: 'k-1' });
  assert.equal(first.store.epoch, 1);

  const again = forgetMemory(first.store, { id: 'o-1', confirmed: true, key: 'k-1' });
  assert.equal(again.status, 'replayed');
  assert.equal(again.store, first.store);                                 // no state change at all
  assert.equal(again.store.epoch, 1);
  assert.deepEqual(again.receipt, first.receipt);

  const conflict = forgetMemory(first.store, { id: 'o-2', confirmed: true, key: 'k-1' });
  assert.equal(conflict.status, 'refused');
  assert.equal(conflict.reason, 'key-conflict');
  assert.equal(conflict.store.epoch, 1);
  assert.deepEqual(recallAll(conflict.store).map((r) => r.id), ['o-2']);  // o-2 is untouched
});

test('a projection stores identifiers and digests, not a second copy of the text', () => {
  const store = admit(admit(openStore(), 'o-1', 'Pinned note.'), 'o-2', 'Second note.');
  const projection = buildProjection(store);
  assert.deepEqual(projection.records, [
    { id: 'o-1', kind: 'organizational', scope: 'design-team', digest: sha('Pinned note.'), admittedEpoch: 0 },
    { id: 'o-2', kind: 'organizational', scope: 'design-team', digest: sha('Second note.'), admittedEpoch: 0 },
  ]);
  assert.equal(JSON.stringify(projection).includes('Pinned note.'), false);
  assert.equal(readProjection(store, projection).records.some((entry) => 'text' in entry), false);

  // Recall resolves the text from the store, not from the projection.
  const recall = recallCurrent(store, projection);
  assert.equal(recall.rebuilt, false);
  assert.deepEqual(recall.records.map((r) => r.text), ['Pinned note.', 'Second note.']);
});

test('a projection that no longer resolves is rebuilt, even at the same epoch', () => {
  let store = admit(openStore(), 'v1', 'The window is Tuesday.');
  const projection = buildProjection(store);
  store = admit(store, 'v2', 'The window is Thursday.', { supersedes: 'v1' });
  assert.equal(readProjection(store, projection).status, 'current');     // the stamp alone still matches
  const recall = recallCurrent(store, projection);
  assert.equal(recall.rebuilt, true);
  assert.deepEqual(recall.records.map((r) => r.id), ['v2']);

  const forged = { stamp: store.epoch, records: [{ id: 'v2', digest: sha('something else') }] };
  assert.equal(recallCurrent(store, forged).rebuilt, true);               // a digest mismatch is not served
});
