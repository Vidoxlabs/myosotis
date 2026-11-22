# Contract: consent

Label: `specified` (rules), `implemented` (state machine in `src/consent.mjs`).

## Shape

```
grant { subject, scope, grantedBy, sequence }   — subject == grantedBy: personal consent in this edition
revocation { subject, scope, sequence }         — kills the grants it names that it does not precede
state { grants, revocations }           — answers hasConsentFor(scope)
```

## Rules

1. **Personal consent is granted by the subject.** In this edition, `grantedBy` must equal `subject`. Consent a person cannot themselves give is not consent. Delegated granting (a parent for a child, an org admin for a member) is a real need and is `planned`, named here so it is not invented later by accident.
2. **A grant names a scope.** Consent is not global. A grant for one scope permits nothing in another.
3. **Revocation is immediate and permanent.** A revoked grant no longer permits admission, ever. Re-consent is a new grant after the revocation, on the record.

   `implemented` in `src/consent.mjs`. Order on the record is a `sequence`: a non-negative integer on a grant or a revocation, `null` when not given. A revocation kills a grant for the same subject and scope unless both carry a sequence and the grant's is strictly later; that later grant is re-consent. On a tie, or when either side has no sequence, the revocation wins. A revoked grant never comes back, because its own sequence does not change: only a new grant with a later sequence permits admission again.
4. **Consent gates admission, not existence.** The check happens when a `personal-consented` record knocks on the store. What is already inside is the forget contract's business: revoking consent should lead the owner to forgetting what was kept under it.
5. **No implied consent.** Long conversation, friendly tone, repeated asks — none of it grants anything. Only a grant record grants.

## What consent does not cover

- `organizational`, `active-thread`, and `unconfirmed` records do not require a consent grant. They are admitted by their own rules because they are not personal memory.
- Consent does not create memory. It permits it. The declared act that creates the record is a separate thing.

## Changes

- `0.3.0` — re-consent is implemented. Before `0.3.0`, `consentState` treated any revocation as permanent for its subject and scope, so the re-consent this contract describes was impossible. Grants and revocations now take an optional `sequence`, and every consent record carries `sequence` (`null` when not given). The change is additive: records without a sequence behave exactly as before.
