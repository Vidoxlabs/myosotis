# Contract: memory records

Label: `specified` (shape), `implemented` (validation in `src/records.mjs`).

## Shape

```
{
  id:    string, non-empty   — stable identifier within the store
  text:  string, non-empty   — the memory content itself
  kind:  string, closed set  — one of the four memory classes
  scope: string, non-empty   — who this memory belongs to
}
```

## The closed set of kinds

| Kind | Meaning | Consent required |
| :--- | :--- | :--- |
| `organizational` | Knowledge belonging to a scope (team notes, working knowledge). | No — it is not about a person. |
| `personal-consented` | Memory about a person. | Yes — a live grant for the scope. |
| `active-thread` | Working context for the current conversation. | No — ephemeral, never promoted silently. |
| `unconfirmed` | An observation not yet established. | No — but it stays marked unconfirmed. |

## Validation rules

1. A record must have a non-empty `id`, `text`, and `scope`.
2. `kind` must be in the closed set. Unknown kinds are rejected, never defaulted.
3. Records are frozen on creation. Corrections are new records, not in-place edits.

## Prohibitions

- No kind promotion outside an explicit, declared act. An `unconfirmed` observation does not become `organizational` knowledge because time passed.
- An `active-thread` record is never treated as durable memory by a consumer.
- `personal-consented` records never enter, or stay, without a consented scope. See the consent contract.
