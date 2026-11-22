// Myosotis records: the memory record shape and its closed set of classes.
// A record is memory that claims to be something. Validation decides whether
// the claim is admissible as a record at all.

export const MEMORY_KINDS = Object.freeze(
  new Set(['organizational', 'personal-consented', 'active-thread', 'unconfirmed'])
);

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
  const issues = validateShape(input ?? {});
  if (issues.length > 0) throw new MemoryRecordError(issues);
  return Object.freeze({
    id: input.id,
    text: input.text,
    kind: input.kind,
    scope: input.scope,
  });
}

export function isUnconfirmed(record) {
  return record.kind === 'unconfirmed';
}

export function isDurable(record) {
  // active-thread records are working context, not durable memory. Consumers
  // that need durability must re-admit them as an explicit, declared act.
  return record.kind !== 'active-thread';
}
