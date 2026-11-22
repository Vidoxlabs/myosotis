# myosotis

Governed memory for agents: consent to keep, structural forget.

Myosotis is the memory member of the bloom agent family. It holds the contracts and reference modules for agent memory where two promises sit on the face of the thing: memory is only kept under proper consent, and a real forget is structural. A forget invalidates every projection built before it and withholds forgotten content from later reads. A stale projection fails closed; it never resurrects.

## Status

Version 0.3.0. Contracts and modules only; nothing shipped runtime-wise. The record, consent, and forget rules are `implemented` as a tested reference library. A durable store, projection adapters, and any service shape are `specified` or `planned`, not built.

## Install

```bash
npm install @vidoxlabs/myosotis
```

Requires Node >= 22.13. Zero runtime dependencies.

## Modules

| Module | What it holds | Label |
| :--- | :--- | :--- |
| `records.mjs` | Memory record shape and the closed set of memory classes: organizational, personal-consented, active-thread, unconfirmed. | `implemented` |
| `consent.mjs` | Consent grants and revocations, ordered by an optional sequence so a later grant is re-consent, and the state that answers whether a scope currently has consent. | `implemented` |
| `forget.mjs` | The memory store state machine: admission, the structural forget, the epoch, and stamped projections that are refused once stale and rebuilt before they serve. | `implemented` |

## Why the classes stay distinguishable

The four memory classes never collapse into one bucket:

- **organizational**: knowledge that belongs to a scope, like a team's working notes. Kept without personal consent because it is not about a person.
- **personal-consented**: memory about a person. Admitted only under a live consent record for the scope. No consent, no admission.
- **active-thread**: working context for the conversation happening now. Ephemeral by nature, never promoted to durable silently.
- **unconfirmed**: an observation that has not been established. Stays marked. Never presented as known.

Conflating them is the failure mode this fabric exists to prevent.

## Why forget is an epoch

A forget that only deletes a row leaves every cached copy of that row alive. Myosotis models forget as an epoch bump: every projection (a cache, an index, a summary) carries the epoch it was built at, and any projection whose stamp no longer matches fails closed. Reading it is refused until it is rebuilt from the store. Bypass and rebuild, never resurrect.

## The family

The family follows one design law: ordinary botanical words for public products, mirroring five flower-named personas.

| Name | Province |
| :--- | :--- |
| [`seed`](https://github.com/Vidoxlabs/seed) | Harness foundation: runs, tools, providers |
| [`capillary`](https://github.com/Vidoxlabs/capillary) | Context retrieval and relations, provenance-first |
| `myosotis` (this repo) | Memory with consent and structural forget |
| [`aestivation`](https://github.com/Vidoxlabs/aestivation) | Plans, verdicts, and the gate before assembly |
| [`drosera`](https://github.com/Vidoxlabs/drosera) | Tool faces, skills, hooks, cookbooks |
| [`trellis`](https://github.com/Vidoxlabs/trellis) | Multi-point testing with dated evidence |
| [`bloom`](https://github.com/Vidoxlabs/bloom) | The team workspace harness |

## Documentation

- `AGENTS.md`: start here before editing. Stay in this repository's province.
- `docs/charter.md`: mission, principles, non-goals.
- `docs/architecture.md`: the parts and how they compose.
- `docs/contracts/`: the record, consent, and forget contracts.
- `docs/interop.md`: how bloom consumes memory, and where capillary ends and myosotis begins.

## Development

```bash
npm test
```

Tests use the Node built-in runner. Adding a rule means adding the test that holds it.

## License

MIT
