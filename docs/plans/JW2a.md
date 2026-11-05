# JW2a — Juristic console: accounting, expenses, funds, petty cash, bank statements (plan + record)

> **Record (done 2026-11-06)**: as planned; the books follow the rail's building switcher (no building tabs). See PROGRESS 2026-11-06 (JW2a) and "Design decisions (J)".

Step **JW2a** of `docs/prompts/J-juristic-web.md` § JW2 (pack J), the accounting half of JW2 (vendors, contracts,
quotation rounds, evaluations and PM schedules are JW2b). Branch `feat/JW2a-accounting` from `main` `40726d1` (JW4
merged). Contract adopted at api **`c0a216c2`** (J2.1 merged: light GL, expenses with approval bands, WHT + 50 ทวิ,
petty cash, funds, statements, bank statement import — D-329, open O-041 / O-043). Design: `DESIGN.md`,
`J-DESIGN.md` §1 / §4 / §5, the JW1a / JW1b screens (`_shots/j-JW1a`, `_shots/j-JW1b`) for consistency. There is no
Stitch reference for accounting: the pages are built from the DESIGN.md patterns — figures row, paper documents,
dense tables, numbered forms, sticky next-steps panel.

## What the API gives (J2.1 at c0a216c2, 48 new operations)
- **Chart** `GET|POST /v1/owner/juristic/accounts`, `PATCH …/{id}` (code / type fixed once used, `isSystem` cannot be
  deactivated — 422 `account.system`, version → 412).
- **Journals** list (building, from / to, source, account, q, page) / get / manual create (`opening`, resolution for a
  fund-bank credit, Idempotency-Key) / reverse (reason 3–400, posted on); `ledger/actions/back-post` →
  `{posted, recognised}`; `ledger/exports` {format csv · express · flowaccount, from, to, buildingId} → export job.
- **Reports** `income-statement` (from, to, buildingId, granularity month · quarter · year → periods, income /
  expense sections with per-period amounts, surplus by period), `balance-sheet` (asOf → assets / liabilities / equity
  incl. surplus to date, `balanced`), `trial-balance` (asOf → accounts debit / credit / balance, `balanced`),
  `ledger-receivables` (per building: GL receivable vs open invoices − payer credit + plan not invoiced = expected,
  difference).
- **Expenses** list (state, kind, building, `awaitingMe`, q) / create (expense or petty-cash top-up; lines by expense
  account, VAT part, WHT key; payee party or name; fund + resolution) / get / PATCH draft (version) / attachments
  {documentId, kind} / submit (number EXP, band snapshot) / approve {reason?} / reject {reason} / cancel {reason} /
  pay {method bank_transfer · cheque · cash · fund, paidOn, reference, evidence (not for cash), fromAccountId}; the
  request carries `band` {roles, approvals, upTo}, `approvalsRequired`, `approvalsGiven`, `approvals[]`
  {approverUserId, role, decision, reason, at}, `requestedBy`, `certificate` {number, documentId, tax} and
  `nextActions` (edit · submit · cancel · approve · reject · pay · attach). Maker-checker 403 `expense.maker_checker`.
- **WHT certificates** (50 ทวิ) list / get / document; settings `juristic.approval_bands`, `juristic.wht_rates`
  (`verified: false` — ⚖ O-041), `juristic.bank_match_days` through `GET|PUT /v1/owner/settings`.
- **Funds** list / create / get / PATCH / ledger (lines on the fund's bank and equity accounts) / request transfer
  {direction in · out, amount, transferOn, counter account, resolution — required for out, note, reference};
  `fund-transfers` list / get / approve / reject (another user; `nextActions`).
- **Petty cash** list / create (custodian, float) / get (entries newest first, counts, last count, balance) / spends
  (receipt required, 422 `petty_cash.insufficient`) / counts (counted amount → difference entry). Top-ups are expense
  requests of kind `petty_cash_top_up`.
- **Bank statements** list / import {bankAccountId, formatKey kbank · scb · bbl · ktb, fileName, content base64 ≤ 2 MB}
  → `{statement, replayed, imported, duplicates, autoMatched}` / get; **lines** list (statement, state unmatched ·
  matched · ignored · all) / get with ranked `suggestions` {kind, id, amount, bookedOn, label, referenceHit, days} /
  match {kind, targetId} / ignore {reason 3–600} / unmatch.
- **Budget vs actual** gains `expenseSideAvailable`, `budgetedExpense`, `actualExpense`, `expenseLines[]` {label, kind,
  accountId, budgeted, actual, remaining}.
- Permissions `juristic.accounting.read|manage`, `juristic.expense.read|request|approve|pay`,
  `juristic.petty_cash.spend`, `juristic.fund.manage|approve`; menu `juristic_accounting`, `juristic_expenses`,
  `juristic_funds`, `juristic_bank_statements`.

## Routes
| Route | What |
|---|---|
| `/juristic/accounting` | **Financial statements.** Link tabs งบรายได้–ค่าใช้จ่าย · งบดุล · งบทดลอง; building tabs when > 1; head: export menu (CSV / Express / FlowAccount — through the export worker) and, for `accounting.manage`, "ลงบัญชีย้อนหลัง" (back-post) as an outlined action with a result toast. **Income statement** as paper: year switch (Buddhist years) and month · quarter · year segmented links; one column per period + total, income and expense sections with their subtotals, the surplus on a double rule; numbers are the API's strings in tabular figures, negatives in parentheses. **Balance sheet** as of a date (assets / liabilities / equity with the surplus to date, "สมดุล ✓" or the mismatch). **Trial balance** (code, account, debit, credit, balance; totals on a double rule). **Ledger vs receivables** check card on the statement tab (per building: GL receivable, expected, difference — "ตรงกัน" or the difference as a warning, never red). |
| `/juristic/accounting/journals` | Journal list: date, number (short id), source in words, memo, building, total; filters source / month / search; head "บันทึกรายการปรับปรุง" for managers. |
| `/juristic/accounting/journals/new` | **Manual journal**: numbered sections (1 วันที่และอาคาร · 2 รายการ · 3 หมายเหตุและมติ), lines with account combobox, debit / credit, unit, memo; a sticky summary with Σ debit, Σ credit and the difference computed from the typed amounts (integers of satang, the only client sum — the user's own input, never an API figure); save disabled with the reason until balanced and ≥ 2 lines; opening-balance switch; resolution picker when a line credits a fund bank account. |
| `/juristic/accounting/journals/[id]` | Journal as paper (date, source with a link to the document it came from, memo, building, lines with debit / credit, totals on a double rule); reversed-by / reverses links; panel: reverse with reason + date (manual and opening journals only — documents correct their own). |
| `/juristic/accounting/accounts` | **Chart of accounts** grouped by type (assets, liabilities, equity, income, expense) with code (mono), Thai / English name, role badge for system accounts, bank account link, state; add account, rename / link bank / deactivate per row (system accounts locked with the reason). |
| `/juristic/expenses` | Underline tabs with counts: **รออนุมัติจากฉัน** (`awaitingMe`, first) · ทั้งหมด · ร่าง · รออนุมัติ · รอจ่าย · จ่ายแล้ว; table: number, title + payee, building, amount (net and WHT muted), approvals "1/2", state badge; head "ขอเบิกค่าใช้จ่าย" (primary). |
| `/juristic/expenses/new`, `/juristic/expenses/[id]/edit` | **Request form**: 1 ผู้รับเงิน (vendor from the register's parties or a name; building), 2 รายการตามบัญชี (lines: expense account, description, amount incl. VAT, VAT part, WHT rate select with "อัตรารอยืนยัน" note when `verified: false`), 3 แหล่งเงิน (operating / a fund + resolution), 4 เอกสารแนบ (quotation · invoice · receipt · other); sticky summary shows counts and the band the request will need (from the settings bands) — totals come from the API after saving the draft. Saves a draft (Idempotency not needed for create) then opens the record. |
| `/juristic/expenses/[id]` | Record: paper (title, payee, lines by account with VAT / WHT, the API's amount, WHT and net on a double rule, attachments, approvals); panel: **approval band explanation** ("ยอดไม่เกิน ฿100,000 ต้องอนุมัติ 2 คน จาก เจ้าของ · ผู้จัดการ · กรรมการ", a progress line of approvals given / required, who approved), actions from `nextActions`: submit, approve, reject (reason), cancel (reason), pay (method, date, reference, evidence upload, paid-from account); maker ≠ checker message when the viewer drafted it; 50 ทวิ link once issued. |
| `/juristic/expenses/certificates`, `/juristic/expenses/certificates/[id]` | 50 ทวิ list (number, payee with tax-id hint, form ภ.ง.ด.3 / 53, base, tax) and the certificate as paper (payer, payee, items by income type and rate, totals, PDF button; the API's ⚖ draft notice). |
| `/juristic/expenses/settings` | **Approval bands** editor (rows: up to amount — last "ขึ้นไป", roles checkboxes, approvals 1–5; ascending check before sending; reason; values from the API) and **WHT rates** editor (key, Thai / English label, income type, rate %, verified switch; unverified rows badged). Bank match days through the shared setting row. |
| `/juristic/funds` | Funds: one card per fund (name, kind, building, bank account masked, bank balance, fund equity), transfers waiting for approval first (approve / reject by another user), recent transfers; head "สร้างกองทุน". |
| `/juristic/funds/[fundId]` | Fund ledger (date, memo, source, debit / credit on the fund bank and equity accounts, resolution link), bank account, edit; panel: request transfer (direction, amount, date, counter account, **resolution picker** required for out, reference, note) → the transfer waits for a second user. |
| `/juristic/funds/transfers/[id]` | Transfer record: facts, resolution, requested by / decided by; approve / reject (`nextActions`; requester sees "รอผู้อื่นอนุมัติ"). |
| `/juristic/petty-cash`, `/juristic/petty-cash/[id]` | Floats (float, balance with a thin bar, custodian, last count); record: entries (top-up / spend / difference, receipt link), counts with differences; panel: record a spend (account, amount, date, description, receipt upload), count (counted amount → the API's difference), top-up = a new expense request of kind `petty_cash_top_up` (prefilled link). |
| `/juristic/bank-statements` | Imported files (bank, account, period, lines, matched / unmatched with a progress line); **import** (bank account, bank format picker KBank · SCB · BBL · KTB, CSV ≤ 2 MB read as base64; result: imported, duplicates, auto-matched or "ไฟล์นี้นำเข้าแล้ว"). |
| `/juristic/bank-statements/[statementId]` | **Two-pane matching queue**: statement lines left (state tabs unmatched · matched · ignored with counts, date, in / out amount, description, reference), the selected line's suggestions right (label, date ± days, reference hit badge, amount; match), ignore with reason, unmatch; progress "จับคู่แล้ว 18 จาก 24". Phones: list, then the line's panel. `?line=` keeps the selection server-rendered. |

Changed: budget record (the expense side of budget vs actual: per line budgeted / actual / remaining with a thin bar —
brand blue only for actual), the rail (J-DESIGN §5 การเงิน: บัญชีและกองทุน, ค่าใช้จ่ายและอนุมัติ, bank statements),
the mock personas' menus and permissions.

## Tests
Vitest: statement formatting by period (columns per granularity, Buddhist-year labels, year range, negative figures),
balanced-journal check (satang integers, empty / one-sided / unbalanced / balanced, ≥ 2 lines), band explanation
(band for an amount, roles in words, progress, maker-checker reasons), matching queue logic (ordering, progress, next
line after an action, suggestion ranking), WHT display (rate label, unverified note, form name), menu placement.
MSW mocks for every endpoint (`mocks/owner/accounting.ts`, state `accounting`, reset part `juristic`). Playwright
written, not run: expense request → approve by a second user → pay → 50 ทวิ; manual journal → reverse; statement
import → match; fund transfer → second-user approval. Storybook: income statement, band explanation, matching queue,
journal balance summary.

## Gates
lint · format:check · typecheck · unit · gen:api --check · icons / design-language / dead-ends · build ·
build-storybook · Lighthouse juristic set extended (initial JS ≤ 260 KB) · screenshots 1440 + 390 in
`_shots/j-JW2a/`.
