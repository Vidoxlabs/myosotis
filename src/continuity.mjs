// Myosotis continuity: one active thread of memory per subject, held in the process.
// Ported from the predecessor's attach, isolate, and active-lookup rules. The ledger
// is a frozen value the caller keeps; nothing is written anywhere else, so a new
// process starts with an empty ledger and no earlier id attaches to it.

import { randomUUID } from 'node:crypto';

export class ContinuityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContinuityError';
    this.code = code;
  }
}

const STATES = Object.freeze(['active', 'isolated']);

const nonEmpty = (value) => typeof value === 'string' && value.length > 0;

const invalid = (message) => new ContinuityError('continuity-invalid', message);

// The single answer for an unknown id, an isolated id, and another subject's id.
// It names none of them, so a refusal tells the caller nothing about the ledger.
const notAttachable = () => new ContinuityError('continuity-not-attachable', 'this continuity cannot be attached');

export function openContinuity() {
  return Object.freeze({ continuities: Object.freeze([]) });
}

function entriesOf(ledger) {
  if (ledger === null || typeof ledger !== 'object' || !Array.isArray(ledger.continuities)) {
    throw invalid('a continuity ledger is the value openContinuity returns');
  }
  const ids = new Set();
  const active = new Set();
  for (const entry of ledger.continuities) {
    if (!nonEmpty(entry?.id) || !nonEmpty(entry?.subject) || !STATES.includes(entry?.state)) {
      throw invalid('every continuity has an id, a subject, and the state active or isolated');
    }
    if (ids.has(entry.id)) throw invalid('a continuity id appears more than once in the ledger');
    ids.add(entry.id);
    if (entry.state === 'active') {
      if (active.has(entry.subject)) throw invalid('a subject holds more than one active continuity');
      active.add(entry.subject);
    }
  }
  return ledger.continuities;
}

function subjectOf(request) {
  const subject = request?.subject;
  if (!nonEmpty(subject)) throw invalid('subject must be a non-empty string');
  return subject;
}

const activeFor = (entries, subject) => entries.find((entry) => entry.subject === subject && entry.state === 'active') ?? null;

const ledgerOf = (entries) => Object.freeze({ continuities: Object.freeze(entries) });

const opened = (subject) => Object.freeze({ id: `continuity-${randomUUID()}`, subject, state: 'active' });

/**
 * The subject's active continuity, read only. Returns frozen
 * `{ attached: true, continuityId }`, or `{ attached: false, continuityId: null }` when
 * none is attached. It never opens one.
 */
export function lookupContinuity(ledger, request) {
  const entries = entriesOf(ledger);
  const active = activeFor(entries, subjectOf(request));
  return Object.freeze(active === null
    ? { attached: false, continuityId: null }
    : { attached: true, continuityId: active.id });
}

/**
 * Attach to the subject's continuity. Returns frozen `{ ledger, continuityId, created }`.
 * With no `continuityId` (absent or null), the active continuity is returned, and one is
 * opened only when the subject has none. With a `continuityId`, the call succeeds only
 * when that id is this subject's active continuity, and the ledger is returned as given.
 * An unknown id, an isolated id, and another subject's id are one refusal,
 * `continuity-not-attachable`, that does not say which it was.
 */
export function attachContinuity(ledger, request) {
  const entries = entriesOf(ledger);
  const subject = subjectOf(request);
  const requested = request.continuityId ?? null;
  if (requested !== null && !nonEmpty(requested)) throw invalid('continuityId must be a non-empty string when present');
  const active = activeFor(entries, subject);
  if (requested !== null) {
    if (active === null || active.id !== requested) throw notAttachable();
    return Object.freeze({ ledger, continuityId: active.id, created: false });
  }
  if (active !== null) return Object.freeze({ ledger, continuityId: active.id, created: false });
  const entry = opened(subject);
  return Object.freeze({ ledger: ledgerOf([...entries, entry]), continuityId: entry.id, created: true });
}

/**
 * Isolate the subject's active continuity and open a new active one. Returns frozen
 * `{ ledger, continuityId, isolatedId }`. The isolated id never attaches again. With
 * nothing attached, a continuity is opened and `isolatedId` is null. Other subjects'
 * continuities do not change.
 */
export function isolateContinuity(ledger, request) {
  const entries = entriesOf(ledger);
  const subject = subjectOf(request);
  const active = activeFor(entries, subject);
  const kept = entries.map((entry) => (entry === active ? Object.freeze({ ...entry, state: 'isolated' }) : entry));
  const entry = opened(subject);
  return Object.freeze({ ledger: ledgerOf([...kept, entry]), continuityId: entry.id, isolatedId: active?.id ?? null });
}
