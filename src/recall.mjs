// Bounded selection over current memory records supplied by the caller.
import { ADMISSIBLE_SENSITIVITY } from './records.mjs';

const MAX_RECALL_CHARS = 6000;

export class RecallError extends Error {}

function checkedCounts(input) {
  const { candidateCount, policyEligibleCount, selectedCount } = input ?? {};
  const counts = [candidateCount, policyEligibleCount, selectedCount];
  if (counts.some(count => !Number.isSafeInteger(count) || count < 0)
    || selectedCount > policyEligibleCount || policyEligibleCount > candidateCount) {
    throw new RecallError('Recall counts must satisfy 0 <= selected <= eligible <= candidates.');
  }
  return { candidateCount, policyEligibleCount, selectedCount };
}

export function recallBounded(input) {
  const { records, maxChars = MAX_RECALL_CHARS, counts } = input ?? {};
  if (!Array.isArray(records)) throw new RecallError('Recall needs a list of memory records.');
  if (!Number.isSafeInteger(maxChars) || maxChars <= 0) {
    throw new RecallError('maxChars must be a positive whole number.');
  }
  const expected = counts === undefined ? null : checkedCounts(counts);
  const limit = Math.min(maxChars, MAX_RECALL_CHARS);
  const candidateCount = records.length;
  const selected = [];
  let policyEligibleCount = 0;
  let usedChars = 0;

  for (let index = 0; index < candidateCount; index += 1) {
    const record = records[index];
    const { id, text, sensitivity, state = 'active' } = record ?? {};
    if (typeof id !== 'string' || id.length === 0 || typeof text !== 'string' || text.length === 0
      || state !== 'active' || !ADMISSIBLE_SENSITIVITY.includes(sensitivity)) continue;
    policyEligibleCount += 1;
    if (text.length > limit - usedChars) continue;
    usedChars += text.length;
    selected.push(Object.freeze({ ...record, id, text, sensitivity }));
  }

  const actual = checkedCounts({ candidateCount, policyEligibleCount, selectedCount: selected.length });
  if (expected && Object.keys(actual).some(field => actual[field] !== expected[field])) {
    throw new RecallError('Recall counts do not match the supplied records and selection.');
  }
  return Object.freeze({ ...actual, maxChars: limit, usedChars, records: Object.freeze(selected) });
}
