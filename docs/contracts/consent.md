# Contract: consent

Label: `specified` (rules), `implemented` (state machine in `src/consent.mjs`).

## Shape

```
grant { subject, scope, grantedBy }     — subject == grantedBy: personal consent in this edition
revocation { subject, scope }           — kills the grant it names
state { grants, revocations }           — answers hasConsentFor(scope)
```

## Rules

1. **Personal consent is granted by the subject.** In this edition, `grantedBy` must equal `subject`. Consent a person cannot themselves give is not consent. Delegated granting (a parent for a child, an org admin for a member) is a real need and is `planned`, named here so it is not invented later by accident.
2. **A grant names a scope.** Consent is not global. A grant for one scope permits nothing in another.
3. **Revocation is immediate and permanent.** A revoked grant no longer permits admission, ever. Re-consent is a new grant after the revocation, on the record.
4. **Consent gates admission, not existence.** The check happens when a `personal-consented` record knocks on the store. What is already inside is the forget contract's business: revoking consent should lead the owner to forgetting what was kept under it.
5. **No implied consent.** Long conversation, friendly tone, repeated asks — none of it grants anything. Only a grant record grants.

## What consent does not cover

- `organizational`, `active-thread`, and `unconfirmed` records do not require a consent grant. They are admitted by their own rules because they are not personal memory.
- Consent does not create memory. It permits it. The declared act that creates the record is a separate thing.
