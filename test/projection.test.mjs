// Projections that refuse to serve once stale. Contract: docs/contracts/forget.md

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  VERSION,
  openStore,
  admitMemory,
  forgetMemory,
  consentState,
  buildProjection,
  readProjection,
  recallCurrent,
} from '../src/index.mjs';

function storeWith(...ids) {
  let store = openStore();
  for (const id of ids) {
    ({ store } = admitMemory(store, consentState({}), {
      id, text: `note ${id}`, kind: 'organizational', scope: 'design-team',
    }));
  }
  return store;
}

test('a projection carries the stamp of the epoch it was built at, and is frozen', () => {
  const store = storeWith('o-1', 'o-2');
  const projection = buildProjection(store);
  assert.equal(projection.stamp, store.epoch);
  assert.deepEqual(projection.records.map((r) => r.id), ['o-1', 'o-2']);
  assert.throws(() => { projection.stamp = 99; }, TypeError);
  assert.throws(() => { projection.records.push({}); }, TypeError);
});

test('a current projection is served', () => {
  const store = storeWith('o-1');
  const read = readProjection(store, buildProjection(store));
  assert.equal(read.status, 'current');
  assert.deepEqual(read.records.map((r) => r.id), ['o-1']);
});

test('a projection built before a forget is refused, and serves nothing', () => {
  const store = storeWith('secret-1', 'o-2');
  const before = buildProjection(store);
  const { store: after } = forgetMemory(store, 'secret-1');
  const read = readProjection(after, before);
  assert.equal(read.status, 'refused');
  assert.equal(read.reason, 'stale');
  assert.equal(read.records, null);
  assert.equal(read.stamp, 0);
  assert.equal(read.epoch, 1);
});

test('a projection whose stamp cannot be verified is refused', () => {
  const store = storeWith('o-1');
  for (const bad of [null, {}, { stamp: '0', records: [] }, { stamp: 0.5, records: [] }, { stamp: 0 }]) {
    const read = readProjection(store, bad);
    assert.equal(read.status, 'refused');
    assert.equal(read.reason, 'unverifiable');
    assert.equal(read.records, null);
  }
});

test('a stamp from the future is refused, never trusted', () => {
  const store = storeWith('o-1');
  const read = readProjection(store, { stamp: 5, records: [] });
  assert.equal(read.status, 'refused');
  assert.equal(read.reason, 'stale');
});

test('recallCurrent serves a current projection unchanged', () => {
  const store = storeWith('o-1');
  const projection = buildProjection(store);
  const recall = recallCurrent(store, projection);
  assert.equal(recall.rebuilt, false);
  assert.equal(recall.projection, projection);
  assert.deepEqual(recall.records.map((r) => r.id), ['o-1']);
});

test('recallCurrent rebuilds from the store instead of serving a stale projection', () => {
  const store = storeWith('secret-1', 'o-2');
  const before = buildProjection(store);
  const { store: after } = forgetMemory(store, 'secret-1');
  const recall = recallCurrent(after, before);
  assert.equal(recall.rebuilt, true);
  assert.equal(recall.projection.stamp, after.epoch);
  assert.deepEqual(recall.records.map((r) => r.id), ['o-2']);
  assert.equal(recall.records.some((r) => r.id === 'secret-1'), false);
});

test('recallCurrent rebuilds when no projection or an unverifiable one is given', () => {
  const store = storeWith('o-1');
  for (const given of [undefined, null, { stamp: 'x' }]) {
    const recall = recallCurrent(store, given);
    assert.equal(recall.rebuilt, true);
    assert.equal(recall.projection.stamp, store.epoch);
  }
});

test('the exported version matches the package', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
});
