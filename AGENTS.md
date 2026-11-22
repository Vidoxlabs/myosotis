# Myosotis workspace

## What this is

Myosotis is the governed memory fabric in the public bloom agent family. It holds the contracts and modules for a memory system with two promises on its face:

1. It only keeps memory it was permitted to keep.
2. When asked to forget, the forgetting is structural, not cosmetic.

This repository holds contracts first, and second a small, dependency-free reference module implementing the contract rules. Nothing here is a service, a database, or a deployed runtime.

## Claim labels

Every capability in this repository carries exactly one label, and it must be true on its face:

- `implemented` - exists as tested code in `src/` with `npm test` coverage.
- `specified` - exists as a written contract a competent party could implement against.
- `planned` - named as an intent. Never presented as done.
- `observed` - recorded as observed behavior of another system, with its source named.

A label is a claim about this repository in its current state. When a label stops being true, the label changes or the claim is removed.

## Progress honesty

The reference modules are honest library implementations of validation and state-machine rules, exercised by unit tests in this repository. They are not a live service. Nothing in this repository is deployed online. Do not write docs, READMEs, or comments that imply it is.

## Memory honesty rules

These rules bind contributions to this repository and the code it accepts:

- Consent precedes keep for personal memory. No consent record, no admission, no exceptions by pattern-guessing.
- Forget is structural. A real forget bumps the epoch, invalidates every projection stamped before it, and withholds forgotten content from later reads. A stale projection fails closed; it never resurrects.
- Removed content never resurfaces in later reads or prompts.
- Unconfirmed observations stay unconfirmed. They are never presented as established memory.
- An unknown is an unknown. A forget that matches no record is declared unknown, not silently successful.

## Public safety

This is a public repository. No hostnames, addresses, ports, cluster names, container names, credentials, or personal names in any file. Examples use loopback addresses or none. A leak is a defect; finding one means fixing it before anything else ships.

## Verification

- `npm test` must stay green. A claim of `implemented` requires a passing test named for it.
- Docs change with code or they do not change at all. There is no "docs later."
- Every behavioral rule that matters must be visible in a test. If it cannot be tested, it is a wish, and it must be labeled `planned`, not `implemented`.

## Stay in this province

This repository is governed memory: consent, forget, and recall of the current projection. It is a peer. Seed is the floor. Capillary, aestivation, and drosera are the other peers. Bloom is the only composer. Trellis is outside the call path. This task does not edit them. It is not Bloom's notes table, not a retrieval index, and not a service. How records are stored stays inside this package.

Forget removes the record and bumps the epoch. A projection stamped earlier fails closed. Do not add a path that serves a stale projection.

## Where the other seven live

| The work | Repository |
| --- | --- |
| Run records, tool identity, provider shape | `seed` |
| Bounded retrieval and relations | `capillary` |
| Consent, forget, and recall | `myosotis` (here) |
| Plans, verdicts, and the assembly gate | `aestivation` |
| Tool faces, skills, hooks, cookbooks | `drosera` |
| Probes over those libraries | `trellis` |
| The team workspace a person opens | `bloom` |
| Family documentation, synced from every public repository | `docs` |

## Skills

This file is the working method. A skill adds instructions and grants no consent and no forget. Do not add a second skill system here.

## Agents

One working method lives here. Do not add a roster, and do not edit a sibling from this checkout.

## References

Read in this order: this file, `docs/charter.md`, `docs/architecture.md`, `docs/contracts/`, `docs/interop.md`, then `src/`. Code and `npm test` win over a stale sentence.

## Cookbook

1. Read this file and the charter.
2. Run `npm test`.
3. Change a rule only together with the test that holds it.
4. Stop at the province boundary in the table above.

This recipe is instructions. This repository ships no tool pack.

## MCP

This repository is not an MCP server. Do not commit an MCP configuration, a server address, or a credential. A forget face, when one is packaged, is a drosera face. The connector is not in this repository.
