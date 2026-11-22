# Myosotis interop

How myosotis meets the family. Every behavior attributed to a sibling below is sourced from that sibling's published repository at the time of writing; where a sibling has not shipped the behavior, it is not claimed.

## bloom: the proved consumer

Bloom describes memory consumption as:

> Owner-saved notes are durable and scoped... Add note to tell the team what to remember. Forget removes the note, invalidates cached recall, stops an active run, and withholds earlier memory-dependent outputs from future team prompts. Reading evidence or posting a message creates no durable personal note.

Mapping onto myosotis's contracts:

| Bloom behavior | Myosotis contract |
| :--- | :--- |
| Add note → durable, scoped | `memoryRecord` with `scope` required; admission through the consent check when personal. |
| Forget → removes the note | `forgetMemory` hit: remove from store. |
| Forget → invalidates cached recall | The epoch bump: every projection stamped earlier is stale and fails closed. |
| Forget → stops an active run | Out of myosotis's province: run control belongs to the harness, which consults the store's stamp. |
| Forget → withholds earlier outputs from future prompts | Same epoch discipline: a projection built before the forget never serves again. |
| Reading/posting creates no personal note | The no-ambient-inference non-goal: memory is created by declared acts only. |

The last row deserves emphasis because it is the whole class separation in one behavior: conversation is not memory.

## seed: the memory domain

Seed reserves the `memory` domain for tool identifiers. The natural tool faces of a memory store on seed's registry, using seed's closed verb set:

| Tool id | Effect class | Maps to |
| :--- | :--- | :--- |
| `memory.note.create` | write | Admission through `admitMemory`. |
| `memory.note.list` | read | Projection rebuilt at the current stamp. |
| `memory.note.read` | read | Single-record read, same stamp rule. |
| `memory.note.delete` | destructive | `forgetMemory`, with the epoch bump. |

`memory.note.delete` is deliberately the forget face, and it is deliberately classified destructive: a forget is an irreversible owner act, and destructive effects in the harness route the owner gate. A `forget` verb is not coined; the closed verb set stays closed, and `delete` with structural semantics is stronger than a new word.

## capillary: the boundary line

Capillary retrieves context and carries its provenance; myosotis governs what may be kept and what must be forgotten. The line:

- A packet capillary returns is **retrieval**. It is what was asked for, with provenance; it is not thereby memory.
- The moment a system decides to **keep** something durable from what was retrieved, that act crosses into myosotis: a record, a kind, a scope, a consent check when personal, an admission epoch.
- A recall cache that exists so retrieval is fast is a **projection** of memory, and the forget contract's epoch governs it exactly as it governs any other projection.

Retrieval informs. Memory keeps. Neither impersonates the other.

## Family

The family law and the full table live in the [capillary repository's family doc](https://github.com/Vidoxlabs/capillary/blob/main/docs/family.md). Short form: seed for the harness foundation, capillary for retrieval, myosotis for memory, aestivation for admission and review, bloom for the harness. Names are ordinary botanical words; provinces stay distinct.
