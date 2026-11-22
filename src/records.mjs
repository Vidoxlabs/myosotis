// Myosotis records: the memory record shape and its closed set of classes.
// A record is memory that claims to be something. Validation decides whether
// the claim is admissible as a record at all.

import { requiresConsent } from './consent.mjs';

export const MEMORY_KINDS = Object.freeze(
  new Set(['organizational', 'personal-consented', 'active-thread', 'unconfirmed'])
);

const ADMISSIBLE_SENSITIVITY = ['public', 'internal', 'restricted'];

export class MemoryRecordError extends Error {
  constructor(issues) {
    super(`invalid memory record: ${issues.join('; ')}`);
    this.name = 'MemoryRecordError';
    this.issues = issues;
  }
}

function validateShape({ id, text, kind, scope }) {
  const issues = [];
  if (typeof id !== 'string' || id.length === 0) issues.push('id must be a non-empty string');
  if (typeof text !== 'string' || text.length === 0) issues.push('text must be a non-empty string');
  if (!MEMORY_KINDS.has(kind)) {
    issues.push(`kind must be one of ${[...MEMORY_KINDS].join(', ')} (got ${JSON.stringify(kind)})`);
  }
  if (typeof scope !== 'string' || scope.length === 0) issues.push('scope must be a non-empty string');
  return issues;
}

export function memoryRecord(input) {
  const { id, text, kind, scope } = input ?? {};
  const record = { id, text, kind, scope };
  const issues = validateShape(record);
  if (requiresConsent(kind)) {
    const { sensitivity, provenance } = input;
    const source = provenance !== null && typeof provenance === 'object'
      && !Array.isArray(provenance) && Object.hasOwn(provenance, 'source')
      ? provenance.source : undefined;
    if (!ADMISSIBLE_SENSITIVITY.includes(sensitivity)) {
      issues.push(`personal sensitivity must be one of ${ADMISSIBLE_SENSITIVITY.join(', ')}`);
    }
    if (source !== 'explicit-user') {
      issues.push('personal provenance source must be explicit-user');
    }
    record.sensitivity = sensitivity;
    record.provenance = Object.freeze({ source });
  }
  if (issues.length > 0) throw new MemoryRecordError(issues);
  return Object.freeze(record);
}

export function isUnconfirmed(record) {
  return record.kind === 'unconfirmed';
}

export function isDurable(record) {
  // active-thread records are working context, not durable memory. Consumers
  // that need durability must re-admit them as an explicit, declared act.
  return record.kind !== 'active-thread';
}
