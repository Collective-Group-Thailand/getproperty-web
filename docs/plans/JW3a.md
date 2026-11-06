# JW3a — Juristic console: import wizard from a legacy system (upload → validate → reconcile → commit → parallel cycle → go-live / rollback) and the full export

Step **JW3a** of `docs/prompts/J-juristic-web.md` § JW3 (pack J), the import half of JW3 (the handover inbox and the PM
portfolio are later steps). Branch `feat/JW3a-import-wizard` from `main` `6911ce7` (JW2b merged). Contract adopted at
api **`0b426453`** (J3.1 merged: import wizard, reconcile, parallel cycle, go-live, full export — D-332, D-313).
Design: `DESIGN.md`, `J-DESIGN.md` §3 `import-wizard-desktop` (keep the stepper with status lines, the reconcile
blocks with badges, the reason + attachment requirement, the sticky summary with facts, the disabled next button with
its reason, download bad rows, destructive cancel last, the error table; change: money stays ink, the attachment
button never wraps, no help upsell card, no version label), the JW2a / JW2b screens for consistency.

## What the API gives (J3.1 at 0b426453, 19 owner operations, all under `/v1/owner/juristic`)
- **Jobs** `GET|POST imports` (one open or committed job per building — 409 `import.job_open`; building + as-of date
  ≤ today + note), `GET imports/{id}`: state `draft · validated · reconciled · committed · live · rolled_back ·
  cancelled`, files per sheet (rows, errors, warnings), `totals` of the last validation (units new / attached, floors,
  parties new / attached, ownerships, incomplete units, bill-to, opening invoices, units in arrears, principal,
  surcharge, receivables, history count / Σ, bank operating / fund, rows with errors / warnings), `reconciliation`
  (items receivables + one per bank row: imported, reference, difference, status match · mismatch · no_statement;
  `explanationRequired`, declared, note, document), `created` per entity after the commit, `parallelCycleId` /
  `parallelRunAt`, **`nextActions`** (draft: upload · validate · cancel; validated: + reconcile; reconciled: + commit;
  committed: parallel_cycle · rollback · go_live; none without `juristic.import.manage`).
- **Templates** `GET imports/templates/{sheet}?format=xlsx|csv&language=th|en` (binary), **files** `POST
  imports/{id}/files` (presign `fileId` or inline base64; every upload re-validates the whole job), `DELETE
  imports/{id}/files/{sheet}`, `POST …/actions/validate`, `GET …/preview` (totals, floors to create, opening balances
  largest first ≤ 200), `GET …/rows?sheet&errorsOnly&language` (row data normalised, errors / warnings with column,
  code, message th / en), `GET …/bad-rows?sheet&format&language` (binary, an errors column).
- **Reconcile** `POST …/actions/reconcile` {declaredReceivables, note + documentId together (10–2000)}; **commit**
  (Idempotency-Key; `billToConsentDocumentId` when the register names a bill-to — 422
  `import.bill_to_consent_required`; 409 `import.preview_stale`; 422 `import.reconciliation_unexplained`);
  **rollback** (Idempotency-Key, reason 5–1000; 409 `import.rollback_blocked`), **cancel** (before commit),
  **go-live** (Idempotency-Key; `notifyOpeningBalances`, `acknowledgeDifferences`; 409 `import.parallel_cycle_missing`,
  `import.differences_unexplained`). While committed and not live, the building issues no invoice (409
  `import.go_live_pending`).
- **Parallel cycle** `POST|GET …/parallel-cycle` {billingCycleId of the building's property, legacy bills file} →
  per-unit computed vs legacy, summary (units, matching, different, unexplained, Σ); `POST
  …/differences/{id}/actions/explain` (5–1000).
- **Full export** `POST /v1/owner/juristic/export` (202 → `owner.exports.get`, kind `juristic_full_export`, ZIP).
- Permissions `juristic.import.read` (owner, manager, committee, auditor) · `.manage` (owner, manager) ·
  `juristic.export.run` (owner, manager); menu `juristic_import`; settings
  `juristic.import.parallel_cycle_required` (true), `juristic.import.allow_unexplained_differences` (false).

## Routes
| Route | What |
|---|---|
| `/juristic/import` | Head: H1 "นำเข้าข้อมูลจากระบบเดิม", lede, filled "เริ่มนำเข้า" (manage; dialog: building — buildings with an open / committed job disabled with the reason, as-of Thai date ≤ today, note; 409 `job_open` → link to the open job). Jobs table (job no. + building, as-of, files / rows, the step it stands at in words, state badge, last change); building switcher scopes the list. Empty state: what the five files are + start. Card "ส่งออกข้อมูลทั้งหมด" (export.run): what the ZIP holds, the export button. |
| `/juristic/import/[jobId]` (`?step=`) | Back link, H1 + lede (building · as-of), the dataset chip (job no. · file count). **Five-step track** with a status line per step (Stitch: number / tick, name, line): 1 อัปโหลดไฟล์ · 2 ตรวจสอบข้อมูล · 3 กระทบยอด · 4 ยืนยันนำเข้า · 5 รอบคู่ขนานและเริ่มใช้งาน — derived from `state` + `nextActions` + files + totals (pure `wizard.ts`); done steps link back read-only. Left: the step's work; right: the **sticky summary** (facts from the API's totals — units, owners, accounts in arrears, receivables, history; the state badge; one sentence on what happens next; the **next button disabled with its reason** in words; secondary: download bad rows; destructive last: cancel / rollback). Phones: summary after the stepper, bottom action bar. |

Steps:
1. **Upload** — one row per sheet (register*, opening_balance*, payment_history, bank_balance): what it holds, the
   template links (Excel / CSV, the page language), a drop zone (drag-drop + choose, CSV / XLSX ≤ 5 MB) or the **file
   chip** (name, rows, errors / warnings as badges, uploaded at; replace, remove). Upload = presign → `files` with
   `fileId` (scan retried). Required-sheet line under the list.
2. **Validate** — figures of the last validation; **row table with inline sheet tabs** (counts with errors), the
   errors-only toggle, columns row / the key fields / the problems (column label + message), paginated; per sheet
   "ดาวน์โหลดแถวที่ผิด (.xlsx)" and re-validate. Fix = edit the file, upload again (the API has no row edit — said in
   one line; the Stitch "แก้ไขข้อมูลโดยตรง" column is not offered).
3. **Reconcile** — declared receivables input (money string), "กระทบยอด" → blocks: **file vs declared**
   (receivables) and **statement vs file** per bank row, each with a status badge (ตรงกัน · ต้องอธิบายส่วนต่าง ·
   ไม่พบ statement), figures in ink (difference included), cut-off chip "ตัดยอด ณ <as-of>". When any item is not a
   match: note (10–2000) **and** attachment (one line, fixed min width) required → reconcile again with both; gating
   pure + tested.
4. **Commit** — what will be created (the API's totals + preview: floors to create, opening balances largest first),
   the opening drafts "not issued until go-live", the irreversible-until-go-live explanation and the rollback window
   (until go-live, exactly what was created); bill-to consent upload when `totals.billTos > 0`; typed confirmation
   (building name); Idempotency-Key.
5. **Parallel cycle + go-live** — cycle helper: the property's cycles (open / computed), open a cycle / compute it
   when none is computed; legacy bills upload → compare; summary figures; **per-unit differences table** (unexplained
   first, filter all / different / unexplained; explain dialog 5–1000); acknowledgement switch only when
   `allow_unexplained_differences` is true; **go-live checklist** (J-DESIGN pilot go-live): reconcile matched or
   explained · parallel cycle run (or not required) · differences 0 or explained (or acknowledged) — go-live with
   the notify switch and typed confirmation; **rollback** destructive last (reason, typed building name, what will be
   deleted from `created`); after live: the result card (live since, opening balances issued).

**Error states** (every code; pure `importProblem` → title / body / next step): `job_open` (link to the open job),
`invalid_state` (reload), `preview_stale` (re-validate button), `reconciliation_unexplained` (back to step 3, focus
note), `bill_to_consent_required` (consent field), `rollback_blocked` (what blocks it in words; contract request for
the table), `parallel_cycle_missing` (to the cycle helper), `differences_unexplained` (to the differences, filter
unexplained), `go_live_pending` (shown on the job and as the cycle's issue refusal), `file_invalid` / `invalid_rows`
(template link), document scan states.

## Tests
Vitest: step machine (state × nextActions × files × totals × reconciliation × report → steps, current, step lines,
viewing a done step, next reason), error mapping (every code), reconcile gating (items, note length, attachment,
mismatch / no statement), go-live checklist (settings unknown → conservative), differences table (order, filters,
counts), sheet list (required / optional / legacy bills), menu placement, status maps. MSW `mocks/owner/imports.ts`
(state `imports`, reset part `juristic`): stateful jobs — a live job for อาคาร A, a draft for a new building with
files; CSV parsed for real, XLSX simulated; validation errors (ID refusal, unknown owner, share > 100), reconcile
against a seeded statement, commit / rollback / cancel / go-live with every error code reachable, parallel cycle with
differences, full export. Playwright written, not run: upload → validate errors → fix → reconcile with attachment →
commit → parallel cycle explain → go-live; rollback. Storybook: step track, reconcile blocks, differences table, file
chip.

## Gates
lint · format:check · typecheck · unit · gen:api --check · icons / design-language / dead-ends · build ·
build-storybook · Lighthouse juristic set extended (initial JS ≤ 260 KB) · screenshots 1440 + 390 in
`_shots/j-JW3a/`.
