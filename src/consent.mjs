// Myosotis consent: grants, revocations, and the state that answers whether
// a scope currently permits personal memory. In this edition consent is
// personal and self-granted; the subject of the memory grants the consent.

export class ConsentError extends Error {
  constructor(issues) {
    super(`invalid consent record: ${issues.join('; ')}`);
    this.name = 'ConsentError';
    this.issues = issues;
  }
}

const KINDS_REQUIRE_CONSENT = Object.freeze(new Set(['personal-consented']));

export function requiresConsent(kind) {
  return KINDS_REQUIRE_CONSENT.has(kind);
}

// A consent record may carry a sequence: a non-negative integer that orders
// grants and revocations on the record. Absent means null.
function sequenceIssues(sequence, issues) {
  if (sequence !== undefined && sequence !== null && !(Number.isSafeInteger(sequence) && sequence >= 0)) {
    issues.push('sequence must be a non-negative integer when present');
  }
}

export function consentGrant({ subject, scope, grantedBy, sequence } = {}) {
  const issues = [];
  if (typeof subject !== 'string' || subject.length === 0) issues.push('subject must be a non-empty string');
  if (typeof scope !== 'string' || scope.length === 0) issues.push('scope must be a non-empty string');
  if (grantedBy !== subject) {
    issues.push('personal consent must be granted by the subject (grantedBy must equal subject)');
  }
  sequenceIssues(sequence, issues);
  if (issues.length > 0) throw new ConsentError(issues);
  return Object.freeze({ subject, scope, grantedBy, sequence: sequence ?? null });
}

export function revokeConsent({ subject, scope, sequence } = {}) {
  const issues = [];
  if (typeof subject !== 'string' || subject.length === 0) issues.push('subject must be a non-empty string');
  if (typeof scope !== 'string' || scope.length === 0) issues.push('scope must be a non-empty string');
  sequenceIssues(sequence, issues);
  if (issues.length > 0) throw new ConsentError(issues);
  return Object.freeze({ subject, scope, sequence: sequence ?? null });
}

// A revocation kills a grant for the same subject and scope unless both carry
// a sequence and the grant's is strictly later. That later grant is
// re-consent. Without a sequence on both sides, or on a tie, the revocation wins.
function revokes(revocation, grant) {
  if (revocation.subject !== grant.subject || revocation.scope !== grant.scope) return false;
  const revokedAt = revocation.sequence ?? null;
  const grantedAt = grant.sequence ?? null;
  if (revokedAt === null || grantedAt === null) return true;
  return revokedAt >= grantedAt;
}

export function consentState({ grants = [], revocations = [] } = {}) {
  const active = grants.filter((g) => !revocations.some((r) => revokes(r, g)));
  return {
    hasConsentFor(scope) {
      return active.some((g) => g.scope === scope);
    },
    activeGrants: Object.freeze([...active]),
  };
}
