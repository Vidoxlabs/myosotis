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

export function consentGrant({ subject, scope, grantedBy } = {}) {
  const issues = [];
  if (typeof subject !== 'string' || subject.length === 0) issues.push('subject must be a non-empty string');
  if (typeof scope !== 'string' || scope.length === 0) issues.push('scope must be a non-empty string');
  if (grantedBy !== subject) {
    issues.push('personal consent must be granted by the subject (grantedBy must equal subject)');
  }
  if (issues.length > 0) throw new ConsentError(issues);
  return Object.freeze({ subject, scope, grantedBy });
}

export function revokeConsent({ subject, scope } = {}) {
  const issues = [];
  if (typeof subject !== 'string' || subject.length === 0) issues.push('subject must be a non-empty string');
  if (typeof scope !== 'string' || scope.length === 0) issues.push('scope must be a non-empty string');
  if (issues.length > 0) throw new ConsentError(issues);
  return Object.freeze({ subject, scope });
}

export function consentState({ grants = [], revocations = [] } = {}) {
  const revoked = new Set(revocations.map((r) => `${r.subject}::${r.scope}`));
  const active = grants.filter((g) => !revoked.has(`${g.subject}::${g.scope}`));
  return {
    hasConsentFor(scope) {
      return active.some((g) => g.scope === scope);
    },
    activeGrants: Object.freeze([...active]),
  };
}
