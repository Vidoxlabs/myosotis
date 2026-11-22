import test from 'node:test';
import assert from 'node:assert/strict';

import * as myosotis from '../src/index.mjs';

const record = (id, text, sensitivity = 'internal') => ({ id, text, sensitivity });

test('bounded recall reports candidates, eligible records, and selections within the caller limit', () => {
  const records = [
    record('excluded', 'withhold', 'outside-policy'),
    record('first', 'abcd', 'public'),
    record('too-long', 'a longer note'),
    record('last', 'ef', 'restricted'),
    { id: 'projection-entry', digest: 'a'.repeat(64), sensitivity: 'internal' },
    { ...record('superseded', 'old note'), state: 'superseded' },
  ];
  const result = myosotis.recallBounded({ records, maxChars: 6 });
  assert.deepEqual([result.candidateCount, result.policyEligibleCount, result.selectedCount], [6, 3, 2]);
  assert.equal(result.maxChars, 6);
  assert.equal(result.usedChars, 6);
  assert.deepEqual(result.records.map(({ id, text }) => [id, text]), [['first', 'abcd'], ['last', 'ef']]);
  records[1].text += ' changed later';
  assert.equal(result.records[0].text, 'abcd');
});

test('bounded recall caps the caller limit at the library ceiling', () => {
  const records = [record('at-limit', 'a'.repeat(6000)), record('extra', 'b')];
  const result = myosotis.recallBounded({ records, maxChars: 10000 });
  assert.equal(result.maxChars, 6000);
  assert.equal(result.usedChars, 6000);
  assert.equal(result.policyEligibleCount, 2);
  assert.equal(result.selectedCount, 1);
  assert.throws(() => myosotis.recallBounded({ records, maxChars: -1 }), /maxChars/);
});

test('bounded recall refuses invalid or inconsistent reported counts', () => {
  const records = [record('note', 'text')];
  for (const counts of [
    { candidateCount: 1, policyEligibleCount: 1, selectedCount: 2 },
    { candidateCount: 1, policyEligibleCount: 2, selectedCount: 1 },
    { candidateCount: 1, policyEligibleCount: 1, selectedCount: -1 },
    { candidateCount: 2, policyEligibleCount: 1, selectedCount: 1 },
  ]) {
    assert.throws(() => myosotis.recallBounded({ records, maxChars: 4, counts }), /recall counts/i);
  }
  const counts = { candidateCount: 1, policyEligibleCount: 1, selectedCount: 1 };
  assert.equal(myosotis.recallBounded({ records, maxChars: 4, counts }).selectedCount, 1);
});
