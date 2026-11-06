# JW2b — Juristic console: vendors, service contracts, quotation rounds, evaluations, PM under a contract (plan + record)

> **Record (done 2026-11-06)**: as planned; preventive plans stay under แจ้งซ่อม (the contract lists and links them). See PROGRESS 2026-11-06 (JW2b) and "Design decisions (J)".

Step **JW2b** of `docs/prompts/J-juristic-web.md` § JW2 (pack J), the vendor half of JW2 (the light GL was JW2a). Branch
`feat/JW2b-vendors-contracts` from `main` `9dae497` (JW2a merged). Contract adopted at api **`fb2a22ff`** (J2.2 merged:
vendors, service contracts, quotation rounds, evaluations, PM under a contract — D-331, D-310; and CR-017 / D-330:
`PlateDetectionState` `historical`). Design: `DESIGN.md`, `J-DESIGN.md` §1 / §4 / §5, the JW2a screens
(`_shots/j-JW2a`) for consistency. No Stitch reference exists for vendors; as in JW2a the pages are built from the
DESIGN.md patterns — figures row, dense tables, numbered forms, sticky next-steps panel, thin charts.

## What the API gives (J2.2 at fb2a22ff, 23 owner operations)
- **Vendors** `GET|POST /v1/owner/juristic/vendors`, `GET|PATCH …/{vendorId}`: a party of the tenant (existing
  `partyId` or created from name / type / contact), categories (16), contact, bank **masked** (bank, account name, last
  4), `taxIdHint` (last 4; the 13-digit id with its check digit lives on the party), state `active · blocked` (+ reason,
  `vendor.blocked` stops new contracts / quotations / expense requests), `activeContracts`, `version` (412).
- **Contracts** `/v1/owner/juristic/vendor-contracts` list (vendor, building, state, **`endingWithinDays`** = the renewal
  queue) / create / get / PATCH (drafts, version) / `documents` (contract · amendment · insurance · guarantee · other) /
  `actions/activate` (quotation rule above `juristic.quotation_threshold`; instalments scheduled — 422
  `vendor_contract.quotations_required`, `vendor_contract.schedule_invalid`) / `actions/renew` (successor draft; 409
  `already_renewed`) / `actions/terminate` (reason, effective date) — all three with Idempotency-Key. Detail: SLA terms
  per priority, instalment plan + instalments with their expense requests, `instalmentsTotal`, documents, evaluations
  (oldest first) + `evaluationSummary` (last 6: average, last, trend, SLA breaches), PM plans, expense requests, alerts
  sent, `daysLeft`, `noticeBy`, `renewalId` / `renewsContractId`, `nextActions` (edit · activate · renew · terminate ·
  attach · evaluate). `sla-breaches?month=` (work orders, breaches by kind response · resolve · request_sla).
  `evaluations` GET / POST (month in the term and not future, a 1–5 score per criterion of
  `juristic.vendor_evaluation_criteria`, incidents, notes; immutable — 409 `vendor_evaluation.exists`).
- **Quotation rounds** `/v1/owner/juristic/quotation-rounds` list (state, building, **`awaitingMe`**) / create / get
  (quotations **cheapest first**, `threshold`, `minimumQuotations`, award + approvals + outcome, `nextActions`
  add_quotation · award · approve · reject · cancel) / `quotations` (vendor, amount, VAT, valid until, received on,
  document **required**; 409 `quotation.exists`) / `actions/award` {quotation, outcome contract · expense, basis
  resolution · approval, `fewerQuotationsReason` (10–1000) required when the amount is above the threshold with fewer
  than `minimumQuotations` — 422 `quotation.minimum_not_met`} / `approve` · `reject` (band roles, maker-checker 403) /
  `cancel` (reason).
- **Expense requests** gain `vendorId` (payee from the vendor), `vendorContractId`, `quotationRoundId` (+ `vendorName`
  on the DTO); above the threshold a vendor purchase not under a contract needs an awarded round
  (`expense.quotations_required`). **Maintenance plans** gain `vendorContractId` (+ `vendorName`).
- Permissions `juristic.vendor.read` (owner, manager, staff, accountant, committee, auditor) · `.manage` (owner, manager,
  accountant) · `.evaluate` (owner, manager, committee); menu `juristic_vendors`, `juristic_vendor_contracts`,
  `juristic_quotations`; settings `juristic.quotation_threshold`, `juristic.contract_expiry_alert_days`,
  `juristic.contract_instalment_lead_days`, `juristic.vendor_evaluation_criteria`.
- **Gate (D-330)**: `PlateDetectionState` + `historical` — a late LPR read kept as history: no entry, no barrier, not
  claimable.

## Routes
| Route | What |
|---|---|
| `/juristic/vendors` | View tabs ใช้งาน · ระงับ · ทั้งหมด (counts), category select, search; rows: name + contact line, categories, tax id ····last 4, active contracts, state. Head: "เพิ่มผู้ให้บริการ" (manage). |
| `/juristic/vendors/new`, `/juristic/vendors/[id]/edit` | Numbered form: 1 ผู้ให้บริการ (an existing company / person of the register, or a new one: name, type, tax id with a check-digit check), 2 ประเภทงาน (category checkboxes), 3 ผู้ติดต่อ, 4 บัญชีรับเงิน (bank, account name, **last 4 digits only**, the reason in one line), 5 หมายเหตุ; sticky summary. |
| `/juristic/vendors/[id]` | Record: facts (type, tax id ····, contact, bank masked, categories), blocked callout with the reason; contracts of the vendor (state, term, expiry badge); evaluation summary per contract (average, last, trend word, SLA breaches); panel: new contract (prefilled vendor), edit, block (reason) / unblock. |
| `/juristic/contracts` | View tabs **ใกล้ครบกำหนด** (active, `endingWithinDays` = the largest of `juristic.contract_expiry_alert_days`; window links 30 · 60 · 90 from the setting) · ร่าง · ใช้งาน · หมดอายุ · ยกเลิก · ทั้งหมด (counts); rows: title + vendor, building, term, value, expiry badge (notice date passed → warning "แจ้งต่อสัญญาภายใน …", inside the window → "เหลือ N วัน", ended → neutral; renewal draft → "มีร่างต่อสัญญาแล้ว"). The list opens on the renewal queue when it has contracts. Head: "สร้างสัญญา". |
| `/juristic/contracts/new`, `/juristic/contracts/[id]/edit` | **Contract editor**, numbered: 1 คู่สัญญาและระยะเวลา (building, vendor, title, category, start / end Thai date pickers, notice days, value incl. VAT), 2 ขอบเขตงาน, 3 SLA ตามความเร่งด่วน (a 4-row table low · normal · high · urgent → response / resolve hours, a row is used when both are filled), 4 งวดชำระ (frequency, due day 1–28, amount and VAT per instalment, first due date, expense account, WHT key with the O-041 note) — the plan in words, never a computed schedule, 5 ค่าปรับ (text), 6 ที่มาและเอกสาร (awarded quotation round of this vendor and building, adopted resolution, documents to attach); sticky summary with the quotation rule ("มูลค่าเกิน ฿50,000.00 ต้องมาจากรอบใบเสนอราคา…") from the setting. Saves a draft → record. |
| `/juristic/contracts/[id]` | Record: head with status + expiry badge; facts row (value, term, notice by, instalments total); sections: scope + SLA table; **instalments ↔ expense requests** (seq, due, amount, VAT, state, request number + state linking to the request); **evaluations** (summary: average, last, trend word + icon, SLA breaches; a thin brand-blue line of the scores, 1–5 axis, data-table fallback; per-month table by criterion; months of the term without an evaluation with "ประเมินเดือนนี้"); **SLA breaches by month** (month links, work orders / breaches table: kind, work order, priority, allowed vs actual hours); **PM plans** (title, asset, every N days, next due, last work order state, link to /maintenance); documents; alerts sent. Panel = `nextActions`: activate (rule + instalment lead days + maker-checker note), renew (dialog: end, optional start / value / resolution → opens the renewal draft), evaluate (link), edit, attach; terminate last (reason, effective date, typed confirmation). |
| `/juristic/contracts/[id]/evaluate` | **Monthly evaluation form**: month (`?month=`; months of the term up to this month without one), one 1–5 scale per criterion of `juristic.vendor_evaluation_criteria` (labels th / en from the setting, words under 1 and 5), incidents + note, note; **SLA breaches of the month pulled read-only** (work orders count, breaches list) with "ระบบดึงจากใบสั่งงาน แก้ไขไม่ได้"; summary: criteria scored n / m, "บันทึกแล้วแก้ไขไม่ได้"; Idempotency-Key; the average is the API's. |
| `/juristic/quotations` | View tabs **รออนุมัติจากฉัน** (`awaitingMe`, first for approvers) · เปิดรับ · รออนุมัติ · ให้งานแล้ว · ยกเลิก · ทั้งหมด (counts); rows: title + building / category, quotations n with the ≥ 3 mark, lowest quote (the API's first), estimate, state. Head: "เปิดรอบเสนอราคา" (dialog: building, title, category, estimate, description). |
| `/juristic/quotations/[id]` | Record: the **rule line** ("ยอดเกิน ฿50,000.00 ต้องมีใบเสนอราคาอย่างน้อย 3 ใบ — มีแล้ว 2 ใบ", three dots); **comparison table cheapest first** (rank, vendor, amount incl. VAT, VAT, valid until with an expired badge, received, document; the cheapest marked "ราคาต่ำสุด", the awarded row on the pale tint with "ได้งาน"); the award (outcome, basis, resolution, reason when fewer, links to the contract / expense draft); cancel reason. Panel: the award's approvals (rule in one sentence from the band snapshot, progress line, decisions with name / role / time, why the viewer cannot approve — maker ≠ checker first); actions = `nextActions`: add quotation (vendor, amount, VAT, valid until, received on, document upload, note), **award** dialog (quotation cards cheapest first, expired disabled; outcome contract → start / end, expense → account + WHT; basis resolution → adopted resolution of the building, approval → the band from the settings; **reason field when required**, 10–1000 chars), approve (note) / reject (reason), cancel (reason). |

Changed: **expense request form** — section 1 gains "ผู้ให้บริการ" (active vendors; the payee comes from the vendor), then
the vendor's active contract of the building and the awarded quotation round of the vendor, with the threshold note;
the record names the vendor, contract and round with links. **Maintenance plan form** — "ทำภายใต้สัญญา" select (draft or
active contracts of the building, juristic tenants only); the plan list shows the vendor. **Gate desk (JW4)** — reads
come from `view=recent`; pending reads keep claim / dismiss, `historical` reads are listed as "อ่านย้อนหลัง" with
"ไม่เปิดไม้กั้นอัตโนมัติ", never claimable. **Rail** — the ผู้ให้บริการ group (J-DESIGN §5): ผู้ให้บริการ · สัญญา ·
ใบเสนอราคา.

## Tests
Vitest: quotation comparison ordering (cheapest first, ties by received date, the API's order kept) and the ≥ 3 rule
display (met / short / below threshold / unknown), award reason requirement (above threshold and fewer than the minimum,
boundary at the threshold, typed amount vs the API's decimal), renewal queue (window from the setting, expiry badge by
days left / notice date / state / renewal draft, the default tab), evaluation trend (chart points oldest first, gaps,
trend word, months without an evaluation inside the term and not in the future), tax id check digit, SLA terms from the
editor rows, LPR view (claimable vs historical), menu placement, status maps. MSW mocks for every endpoint
(`mocks/owner/vendors.ts`, state `vendors`, reset part `juristic`; control `/__mock/owner/vendors/job` runs the hourly
job: instalments → submitted expense requests, expiry alerts). Playwright written, not run: vendor → quotation round →
three quotations → award by approval → second member approves → contract draft → activate → job → instalment expense
request; monthly evaluation; renewal. Storybook: comparison table, SLA table, evaluation trend, expiry badges.

## Gates
lint · format:check · typecheck · unit · gen:api --check · icons / design-language / dead-ends · build ·
build-storybook · Lighthouse juristic set extended (initial JS ≤ 260 KB) · screenshots 1440 + 390 in
`_shots/j-JW2b/`.
