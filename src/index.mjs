// Myosotis: governed memory. Consent to keep, promise to forget.
// The public face of the reference library.

export { MEMORY_KINDS, MemoryRecordError, memoryRecord, isUnconfirmed, isDurable } from './records.mjs';
export {
  ConsentError,
  consentGrant,
  revokeConsent,
  consentState,
  requiresConsent,
} from './consent.mjs';
export {
  openStore,
  admitMemory,
  forgetMemory,
  recallAll,
  projectionStamp,
  projectionIsValid,
} from './forget.mjs';

export const VERSION = '0.1.0';

export function about() {
  const lines = [
    `myosotis ${VERSION}`,
    'governed memory: consent to keep, promise to forget',
    '',
    'modules:',
    '  records  memory record shape and the closed set of classes',
    '  consent  grants, revocations, and the consent state',
    '  forget   the store state machine: admission, the structural forget, the epoch',
    '',
    'memory classes: organizational, personal-consented, active-thread, unconfirmed',
    'fail-closed rule: a projection whose stamp is stale is refused, never served',
  ];
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(about());
}
