# QUESTIONS.md — KIS Books Build

Log any ambiguity encountered during the build here. Do not block on questions — make the simplest reasonable assumption, document it, and continue. Review and resolve entries at each phase ship gate.

## Open Questions

| # | Phase | Question | Assumption Made | Resolved? | Resolution |
|---|-------|----------|-----------------|-----------|------------|
| | | | | | |

## Resolved Questions

| # | Phase | Question | Assumption Made | Resolved? | Resolution |
|---|-------|----------|-----------------|-----------|------------|
| | | | | | |

---

## How to Use This File

1. **When you encounter ambiguity** during any build task, add a row to the Open Questions table.
2. **Number sequentially** (1, 2, 3...) regardless of phase.
3. **"Assumption Made"** = what you decided to do in the absence of clarity. Be specific.
4. **"Resolved?"** = No until explicitly confirmed by the developer or resolved by later context.
5. **At each phase ship gate**, review all open questions. Move resolved items to the Resolved table.
6. **Never delete rows** — move them between tables so there's a complete decision history.

### Example Entry

| # | Phase | Question | Assumption Made | Resolved? | Resolution |
|---|-------|----------|-----------------|-----------|------------|
| 1 | 2.2 | Should COA account numbers be required or optional? | Optional — the proposal says "optional, user-configurable" so we allow NULL in the account_number column and do not enforce it during creation. | Yes | Confirmed by proposal §2.1 |
| 2 | 4.1 | Should voided transactions be excluded from report queries by default? | Yes — reports filter `WHERE status != 'void'` unless explicitly including void transactions. Void transactions are still visible in the transaction list with a void badge. | No | |
