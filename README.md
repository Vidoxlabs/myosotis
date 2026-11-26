<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/myosotis-banner-dark.svg">
  <img src=".github/assets/myosotis-banner.svg" alt="Myosotis banner: a five-petal forget-me-not, and the tagline Memory that keeps only what you allow." width="1280">
</picture>

Memory that keeps only what you allow

# myosotis

Governed memory for agents: consent to keep, structural forget.

Myosotis is the memory system of Vivarium, the personal agent platform. It holds the contracts and reference modules for agent memory where two promises sit on the face of the thing: memory is only kept under proper consent, and a real forget is structural. A forget invalidates every projection built before it and withholds forgotten content from later reads. A stale projection fails closed; it never resurrects.

## Status

Version 1.2.0. The record, consent, forget, bounded recall, and in-process continuity rules are `implemented` as a tested reference library. A durable store, projection adapters, and service interfaces remain `specified` or `planned`.

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
| `forget.mjs` | The memory store state machine: admission and supersede, the confirmed and keyed forget that tombstones a whole supersede chain, the epoch, and stamped projections of identifiers and digests that are refused once stale and rebuilt before they serve. | `implemented` |
| `recall.mjs` | Bounded selection from caller-held records, with sensitivity checks and candidate, eligible, and selected counts. | `implemented` |
| `continuity.mjs` | One active continuity per subject, held in the process. Lookup never opens one, attach refuses any id that is not this subject's active id without saying why, and isolate opens a new active id. | `implemented` |

## Why the classes stay distinguishable

The four memory classes never collapse into one bucket:

- **organizational**: knowledge that belongs to a scope, like a team's working notes. Kept without personal consent because it is not about a person.
- **personal-consented** requires a live grant for its scope, an admissible sensitivity, and provenance of the principal's explicit confirmation.
- **active-thread**: working context for the conversation happening now. Ephemeral by nature, never promoted to durable silently.
- **unconfirmed**: an observation that has not been established. Stays marked. Never presented as known.

Conflating them is the failure mode this fabric exists to prevent.

## Why forget is an epoch

A forget that only deletes a row leaves every cached copy of that row alive. Myosotis models forget as an epoch bump: every projection (a cache, an index, a summary) carries the epoch it was built at, and any projection whose stamp no longer matches fails closed. Reading it is refused until it is rebuilt from the store. Bypass and rebuild, never resurrect.

## The family

Vivarium is the product. Its systems follow one naming law: ordinary botanical words that say what each system does.

| Name | Province |
| :--- | :--- |
| [`seed`](https://github.com/Vidoxlabs/seed) | Harness foundation: runs, tools, providers |
| [`capillary`](https://github.com/Vidoxlabs/capillary) | Context retrieval and relations, provenance-first |
| `myosotis` (this repo) | Memory with consent and structural forget |
| [`aestivation`](https://github.com/Vidoxlabs/aestivation) | Plans, verdicts, and the gate before assembly |
| [`drosera`](https://github.com/Vidoxlabs/drosera) | Tool faces, skills, hooks, cookbooks |
| [`trellis`](https://github.com/Vidoxlabs/trellis) | Multi-point testing with dated evidence |
| [`bloom`](https://github.com/Vidoxlabs/bloom) | Vivarium's user interface: the app a person opens |
| [`vivarium`](https://github.com/Vidoxlabs/vivarium) | The product's umbrella: pins the seven systems at exact commits |
| [`docs`](https://github.com/Vidoxlabs/docs) | Family documentation, synced from every public repository |

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

The Vidoxlabs name and mark are trademarks of Vidoxlabs LLC. They are not covered by this repository's MIT license.
