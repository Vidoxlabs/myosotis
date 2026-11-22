// Myosotis forget: the memory store state machine. The epoch is the whole
// trick: it only moves on a real forget, so a projection whose stamp no
// longer matches is stale, stale means refused, and refused means the
// consumer rebuilds from the store. Bypass and rebuild, never resurrect.

import { requiresConsent } from './consent.mjs';
import { memoryRecord } from './records.mjs';

export function openStore() {
  return Object.freeze({ epoch: 0, records: [] });
}

export function admitMemory(store, state, recordInput) {
  let record;
  try {
    record = memoryRecord(recordInput);
  } catch (error) {
    return { store, admitted: false, reason: error.message };
  }
  if (requiresConsent(record.kind) && !state.hasConsentFor(record.scope)) {
    return {
      store,
      admitted: false,
      reason: `consent required for personal-consented memory in scope ${JSON.stringify(record.scope)}`,
    };
  }
  const stamped = Object.freeze({ ...record, admittedEpoch: store.epoch });
  return {
    store: Object.freeze({
      epoch: store.epoch,
      records: [...store.records, stamped],
    }),
    admitted: true,
    record: stamped,
  };
}

export function forgetMemory(store, id) {
  const hit = store.records.find((r) => r.id === id);
  if (!hit) {
    // A miss is declared unknown. No state change, no epoch bump: a bump for
    // a miss would invalidate every projection for nothing.
    return { store, status: 'unknown', forgotten: null };
  }
  return {
    store: Object.freeze({
      epoch: store.epoch + 1,
      records: store.records.filter((r) => r.id !== id),
    }),
    status: 'forgotten',
    forgotten: hit,
  };
}

export function recallAll(store) {
  return Object.freeze(store.records.map((r) => Object.freeze({ ...r })));
}

export function projectionStamp(store) {
  return store.epoch;
}

export function projectionIsValid(store, stamp) {
  // Fail closed: only a stamp that equals the current epoch is current.
  return stamp === store.epoch;
}
