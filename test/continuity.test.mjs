// Continuity: one active thread of memory per subject, held in the process.
// Contract: docs/contracts/continuity.md. Ported from the predecessor's attach,
// isolate, and active lookup rules, without its query or its scope columns.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  openContinuity, lookupContinuity, attachContinuity, isolateContinuity, ContinuityError, openStore,
} from '../src/index.mjs';

const attached = (ledger, subject) => attachContinuity(ledger, { subject });

function refusal(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail('expected a refusal');
}

test('lookup reports that none is attached and does not create one', () => {
  const ledger = openContinuity();
  const first = lookupContinuity(ledger, { subject: 'ada' });
  assert.deepEqual(first, { attached: false, continuityId: null });
  assert.ok(Object.isFrozen(first));
  assert.deepEqual(lookupContinuity(ledger, { subject: 'ada' }), first);    // asking again changes nothing
  assert.deepEqual(ledger, openContinuity());
  assert.equal(attached(ledger, 'ada').created, true);                       // nothing was created by the lookups
});

test('attach with no id creates a continuity only when the subject has none', () => {
  const first = attached(openContinuity(), 'ada');
  assert.equal(first.created, true);
  assert.equal(typeof first.continuityId, 'string');
  assert.ok(first.continuityId.length > 0);
  const again = attached(first.ledger, 'ada');
  assert.equal(again.created, false);
  assert.equal(again.continuityId, first.continuityId);
  assert.equal(again.ledger, first.ledger);                                  // resuming writes nothing
  assert.deepEqual(lookupContinuity(again.ledger, { subject: 'ada' }), { attached: true, continuityId: first.continuityId });
  assert.equal(attachContinuity(first.ledger, { subject: 'ada', continuityId: null }).continuityId, first.continuityId); // null is no id
  const other = attached(first.ledger, 'bea');
  assert.notEqual(other.continuityId, first.continuityId);
  assert.equal(lookupContinuity(other.ledger, { subject: 'ada' }).continuityId, first.continuityId);
});

test('attach with an id succeeds when that id is active for this subject', () => {
  const { ledger, continuityId } = attached(openContinuity(), 'ada');
  const resumed = attachContinuity(ledger, { subject: 'ada', continuityId });
  assert.deepEqual({ ...resumed }, { ledger, continuityId, created: false });
  assert.equal(resumed.ledger, ledger);
});

test('an unknown id, an isolated id, and another subject\'s id are one refusal that does not say which', () => {
  let ledger = openContinuity();
  let adaFirst;
  ({ ledger, continuityId: adaFirst } = attached(ledger, 'ada'));
  ({ ledger } = isolateContinuity(ledger, { subject: 'ada' }));
  let beaId;
  ({ ledger, continuityId: beaId } = attached(ledger, 'bea'));
  const elsewhere = attached(openContinuity(), 'ada').continuityId;          // an id from another ledger, as after a restart

  const cases = {
    unknown: 'continuity-never-opened',
    isolated: adaFirst,
    'another subject': beaId,
    'another ledger': elsewhere,
  };
  const errors = Object.entries(cases).map(([label, continuityId]) => {
    const error = refusal(() => attachContinuity(ledger, { subject: 'ada', continuityId }));
    assert.ok(error instanceof ContinuityError, label);
    return error;
  });
  for (const error of errors) {
    assert.equal(error.code, 'continuity-not-attachable');
    assert.equal(error.message, errors[0].message);
    assert.deepEqual(Object.keys(error), Object.keys(errors[0]));
  }
  const message = errors[0].message;
  for (const word of [adaFirst, beaId, elsewhere, 'bea', 'ada', 'isolated', 'unknown', 'another', 'subject\'s']) {
    assert.equal(message.includes(word), false, `the refusal names "${word}"`);
  }
});

test('isolate marks the active continuity isolated and opens a new active id', () => {
  const start = attached(openContinuity(), 'ada');
  const isolated = isolateContinuity(start.ledger, { subject: 'ada' });
  assert.equal(isolated.isolatedId, start.continuityId);
  assert.notEqual(isolated.continuityId, start.continuityId);
  assert.deepEqual(lookupContinuity(isolated.ledger, { subject: 'ada' }), { attached: true, continuityId: isolated.continuityId });
  assert.equal(attachContinuity(isolated.ledger, { subject: 'ada', continuityId: isolated.continuityId }).continuityId, isolated.continuityId);
  assert.throws(() => attachContinuity(isolated.ledger, { subject: 'ada', continuityId: start.continuityId }), ContinuityError);
  const resumed = attached(isolated.ledger, 'ada');
  assert.equal(resumed.created, false);                                      // attach resumes the new id, it does not open a third
  assert.equal(resumed.continuityId, isolated.continuityId);
  assert.equal(lookupContinuity(start.ledger, { subject: 'ada' }).continuityId, start.continuityId); // the given ledger is unchanged

  const twice = isolateContinuity(isolated.ledger, { subject: 'ada' });
  assert.equal(twice.isolatedId, isolated.continuityId);
  for (const old of [start.continuityId, isolated.continuityId]) {
    assert.throws(() => attachContinuity(twice.ledger, { subject: 'ada', continuityId: old }), ContinuityError);
  }
});

test('isolate leaves another subject\'s continuity active', () => {
  let ledger = openContinuity();
  let beaId;
  ({ ledger } = attached(ledger, 'ada'));
  ({ ledger, continuityId: beaId } = attached(ledger, 'bea'));
  ({ ledger } = isolateContinuity(ledger, { subject: 'ada' }));
  assert.equal(attachContinuity(ledger, { subject: 'bea', continuityId: beaId }).continuityId, beaId);
});

test('isolate with nothing attached opens an active id and isolates nothing', () => {
  const opened = isolateContinuity(openContinuity(), { subject: 'ada' });
  assert.equal(opened.isolatedId, null);
  assert.deepEqual(lookupContinuity(opened.ledger, { subject: 'ada' }), { attached: true, continuityId: opened.continuityId });
});

test('malformed input is refused apart from the attach refusal', () => {
  const { ledger, continuityId } = attached(openContinuity(), 'ada');
  const bad = [
    () => lookupContinuity(ledger, { subject: '' }),
    () => lookupContinuity(ledger, {}),
    () => attachContinuity(ledger, { subject: 42 }),
    () => attachContinuity(ledger, { subject: 'ada', continuityId: '' }),
    () => attachContinuity(ledger, { subject: 'ada', continuityId: 7 }),
    () => isolateContinuity(ledger, undefined),
    () => lookupContinuity({}, { subject: 'ada' }),
    () => attachContinuity(null, { subject: 'ada', continuityId }),
  ];
  for (const fn of bad) {
    const error = refusal(fn);
    assert.ok(error instanceof ContinuityError);
    assert.equal(error.code, 'continuity-invalid');
  }
});

test('a ledger holding two active continuities for one subject, or one id twice, is refused', () => {
  const twoActive = { continuities: [
    { id: 'c-1', subject: 'ada', state: 'active' },
    { id: 'c-2', subject: 'ada', state: 'active' },
  ] };
  const repeated = { continuities: [
    { id: 'c-1', subject: 'ada', state: 'isolated' },
    { id: 'c-1', subject: 'bea', state: 'active' },
  ] };
  const unknownState = { continuities: [{ id: 'c-1', subject: 'ada', state: 'paused' }] };
  for (const ledger of [twoActive, repeated, unknownState]) {
    assert.equal(refusal(() => lookupContinuity(ledger, { subject: 'ada' })).code, 'continuity-invalid');
  }
});

test('ledgers are frozen values, and the memory store does not change shape', () => {
  const { ledger } = isolateContinuity(attached(openContinuity(), 'ada').ledger, { subject: 'ada' });
  assert.ok(Object.isFrozen(ledger));
  assert.ok(Object.isFrozen(ledger.continuities));
  assert.ok(ledger.continuities.every((entry) => Object.isFrozen(entry)));
  assert.deepEqual(ledger.continuities.map((entry) => [entry.subject, entry.state]), [['ada', 'isolated'], ['ada', 'active']]);
  assert.deepEqual(Object.keys(openStore()).sort(), ['epoch', 'receipts', 'records', 'tombstones']);
});

test('the continuity module keeps nothing outside the process', () => {
  const source = readFileSync(new URL('../src/continuity.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^\s*import\b[^;]*from\s+'([^']+)'/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ['node:crypto']);
  assert.doesNotMatch(source, /process\.env|fetch\(|node:fs|node:http|node:net|readFile|writeFile/);
});
