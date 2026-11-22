// Myosotis forget: the memory store state machine. The epoch is the whole
// trick: it only moves on a real forget, so a projection whose stamp no
// longer matches is stale, stale means refused, and refused means the
// consumer rebuilds from the store. Bypass and rebuild, never resurrect.
//
// A forget is confirmed and keyed. It erases the named record and every record
// that record superseded, leaves a digest-only tombstone for each, and bumps the
// epoch once. The same key repeated is a replay, never a second bump.

import { createHash } from 'node:crypto';

import { requiresConsent } from './consent.mjs';
import { memoryRecord } from './records.mjs';

const digestOf = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

export function openStore() {
  return Object.freeze({ epoch: 0, records: [], tombstones: [], receipts: [] });
}

function nextStore(store, changes) {
  return Object.freeze({
    epoch: store.epoch,
    records: store.records,
    tombstones: store.tombstones ?? [],
    receipts: store.receipts ?? [],
    ...changes,
  });
}

const isActive = (record) => record.state === 'active';
const nonEmpty = (value) => typeof value === 'string' && value.length > 0;

export function admitMemory(store, state, recordInput) {
  let record;
  try {
    record = memoryRecord(recordInput);
  } catch (error) {
    return { store, admitted: false, reason: error.message };
  }
  const supersedes = recordInput.supersedes ?? null;
  if (supersedes !== null && !nonEmpty(supersedes)) {
    return { store, admitted: false, reason: 'supersedes must name a memory id' };
  }
  if (requiresConsent(record.kind) && !state.hasConsentFor(record.scope)) {
    return {
      store,
      admitted: false,
      reason: `consent required for personal-consented memory in scope ${JSON.stringify(record.scope)}`,
    };
  }
  if (store.records.some((r) => r.id === record.id) || (store.tombstones ?? []).some((t) => t.id === record.id)) {
    return { store, admitted: false, reason: `memory id ${JSON.stringify(record.id)} is already used; a correction takes a new id` };
  }
  let records = store.records;
  if (supersedes !== null) {
    const target = records.find((r) => r.id === supersedes);
    if (!target || !isActive(target) || target.scope !== record.scope) {
      return { store, admitted: false, reason: `the memory to supersede, ${JSON.stringify(supersedes)}, is not current in this scope` };
    }
    // The old record stays in the store, withheld from recall, so a later forget can
    // find it through the chain. Superseding is not forgetting: the epoch does not move.
    records = records.map((r) => (r.id === supersedes
      ? Object.freeze({ ...r, state: 'superseded', supersededBy: record.id })
      : r));
  }
  const stamped = Object.freeze({
    ...record,
    digest: digestOf(record.text),
    supersedes,
    state: 'active',
    admittedEpoch: store.epoch,
  });
  return {
    store: nextStore(store, { records: [...records, stamped] }),
    admitted: true,
    record: stamped,
  };
}

const refused = (store, reason) => ({ store, status: 'refused', reason, forgotten: null });

/**
 * Forget a memory. `request` is `{ id, confirmed: true, key }`.
 *
 * - Without `confirmed: true` (including a bare id string) nothing changes: `refused`
 *   with reason `confirmation-required`.
 * - A key already used for this id is a `replayed` forget: same receipt, no epoch bump.
 *   A key already used for another id is refused with reason `key-conflict`.
 * - A hit erases the named record and every record it superseded, writes one tombstone
 *   per erased id naming the id the forget was asked for, and bumps the epoch once.
 * - An id that is only a tombstone is `already-forgotten`; one never seen is `unknown`.
 *   Neither bumps the epoch.
 */
export function forgetMemory(store, request) {
  if (request === null || typeof request !== 'object') return refused(store, 'confirmation-required');
  const { id, confirmed, key } = request;
  if (confirmed !== true) return refused(store, 'confirmation-required');
  if (!nonEmpty(key)) return refused(store, 'key-required');
  if (!nonEmpty(id)) return refused(store, 'id-required');

  const receipts = store.receipts ?? [];
  const prior = receipts.find((r) => r.key === key);
  if (prior) {
    if (prior.id !== id) return refused(store, 'key-conflict');
    return { store, status: 'replayed', forgotten: null, receipt: prior };
  }

  const hit = store.records.find((r) => r.id === id);
  if (!hit) {
    const tombstones = (store.tombstones ?? []).filter((t) => t.id === id);
    if (tombstones.length > 0) return { store, status: 'already-forgotten', forgotten: null, tombstones };
    // A miss is declared unknown. No state change, no epoch bump: a bump for
    // a miss would invalidate every projection for nothing.
    return { store, status: 'unknown', forgotten: null };
  }

  const chain = [];
  const seen = new Set();
  for (let at = hit; at && !seen.has(at.id); at = store.records.find((r) => r.id === at.supersedes)) {
    seen.add(at.id);
    chain.push(at);
  }
  const epoch = store.epoch + 1;
  const erased = chain.map((r) => r.id);
  const receipt = Object.freeze({ key, id, epoch, erased: Object.freeze([...erased]) });
  const newTombstones = chain.map((r) => Object.freeze({ id: r.id, namedId: id, digest: r.digest, epoch }));
  return {
    store: nextStore(store, {
      epoch,
      records: store.records.filter((r) => !seen.has(r.id)),
      tombstones: [...(store.tombstones ?? []), ...newTombstones],
      receipts: [...receipts, receipt],
    }),
    status: 'forgotten',
    forgotten: hit,
    erased,
    receipt,
  };
}

/** The current memories: active records only. Superseded records are withheld. */
export function recallAll(store) {
  return Object.freeze(store.records.filter(isActive).map((r) => Object.freeze({ ...r })));
}

export function projectionStamp(store) {
  return store.epoch;
}

export function projectionIsValid(store, stamp) {
  // Fail closed: only a stamp that equals the current epoch is current.
  return stamp === store.epoch;
}

// A projection is an index, not a second copy: identifiers, class, scope, and
// the content digest of each current record, stamped with the epoch it was built
// at. The text stays in the store.
export function buildProjection(store) {
  const entries = store.records.filter(isActive).map((r) => Object.freeze({
    id: r.id, kind: r.kind, scope: r.scope, digest: r.digest, admittedEpoch: r.admittedEpoch,
  }));
  return Object.freeze({ stamp: projectionStamp(store), records: Object.freeze(entries) });
}

function verifiable(projection) {
  return projection !== null
    && typeof projection === 'object'
    && Number.isSafeInteger(projection.stamp)
    && projection.stamp >= 0
    && Array.isArray(projection.records);
}

// Serve a projection only while it is current. A stale stamp, a stamp from the
// future, or a projection whose stamp cannot be verified is refused, and a
// refusal carries no records: there is no partial or warned serve.
export function readProjection(store, projection) {
  if (!verifiable(projection)) {
    return { status: 'refused', reason: 'unverifiable', records: null, stamp: null, epoch: store.epoch };
  }
  if (!projectionIsValid(store, projection.stamp)) {
    return { status: 'refused', reason: 'stale', records: null, stamp: projection.stamp, epoch: store.epoch };
  }
  return { status: 'current', records: projection.records, stamp: projection.stamp, epoch: store.epoch };
}

// Resolve projection entries to the store's current records. An entry whose id is no
// longer active, or whose digest no longer matches, fails the whole resolve.
function resolve(store, entries) {
  const active = new Map(store.records.filter(isActive).map((r) => [r.id, r]));
  const records = [];
  for (const entry of entries) {
    const record = active.get(entry?.id);
    if (!record || record.digest !== entry.digest) return null;
    records.push(Object.freeze({ ...record }));
  }
  return Object.freeze(records);
}

// Recall through a projection: serve it when current, otherwise rebuild from
// the store first and serve the rebuild. Text always comes from the store.
// Bypass and rebuild, never resurrect.
export function recallCurrent(store, projection) {
  const read = readProjection(store, projection);
  if (read.status === 'current') {
    const records = resolve(store, read.records);
    if (records !== null) return { projection, records, rebuilt: false };
  }
  const rebuilt = buildProjection(store);
  return { projection: rebuilt, records: recallAll(store), rebuilt: true };
}
