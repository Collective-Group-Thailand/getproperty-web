# JW3b — handover inbox and PM portfolio (pack J, api J3.2 + J3.3 at `1e364785afaf`)

Plan written before the code (J-AUTORUN, design lead D-J20). Decisions: D-314, D-333 (developer handover), D-334 (PM
company portfolio, management contracts, staff). JW3a (import wizard) is done; this step is the rest of JW3.

## Contract
`API_CONTRACT_REF=1e364785afaf1aba3900372f338877123dc4e5a6 pnpm gen:api --adopt` — +28 operations: `owner.juristicHandovers.*`
(5), `owner.juristicManagementContracts.*` (9), `owner.pmPortfolio.*` (2), `owner.pmStaff.*` (4), `owner.pmContracts.*` (6),
`admin.juristicHandovers.*` (2, not in this step). Menu keys `juristic_handovers`, `juristic_management_contracts`,
`pm_portfolio`, `pm_staff`, `pm_contracts`.

## 1 · Handover inbox (juristic tenants, `juristic_handovers`)
- **`/juristic/handovers`** — rail: ตั้งค่าและระบบ, after นำเข้าข้อมูล (both bring a building in). View tabs with counts:
  รอตรวจรับ (`pending_review`, default when it has rows) · รับแล้ว · ปฏิเสธแล้ว · ทั้งหมด. Rows: building + the
  register in words (units · owners), the handover date (with "ยังไม่ถึงวันส่งมอบ" before it), advance common fees,
  first fund contributions, brought forward (ink, right aligned), state badge. Empty state says what arrives here.
- **`/juristic/handovers/[id]`** (record page): back link, H1 building, state badge, lede (sent · as-of · handover date).
  Left: figures row from `totals` (brought forward highlighted when not zero); **problems** that block an acceptance
  (one line per problem in words, unit number, no codes); **receiving bank account** (masked, from the developer) beside
  the office's matched account or a calm warning that none matches (journals then post to the operating bank role)
  with a link to bank accounts; **owners** — new vs matched by LINE (`partiesToCreate` / `partiesToAttach`); **units**
  table (unit, owners with share, advance fees with period, fund, brought forward) filtered all · with brought
  forward · with a problem, 50 per page; after acceptance **what was recorded** (`applied`); rejection reason and
  whether getbuild got it; the juristic person's registration when recorded.
  Right: sticky ActionPanel (summary facts, what an acceptance does in four lines, actions from `nextActions`):
  - **accept** (filled; disabled with its reason when the date has not come or problems remain): typed building name,
    legal form / property kind only "when the developer did not send it" (optional selects), notify opening balances
    (default on), Idempotency-Key.
  - **juristic_formed** (filled after acceptance): formation date ≤ today, registration no. (≤ 100), Idempotency-Key.
  - **reject** (destructive last): reason 5–1000, Idempotency-Key.
  - Refusals in words with one next step: `handover.not_due`, `handover.unit_owned`, `handover.totals_mismatch`,
    `handover.invalid`, `handover.invalid_state` (reload), `register.shares_exceeded`, 404 (not found page), a missing
    legal form (`validation.failed` on `legalForm` → the field).
- Committee / auditor: read-only panel line.

## 2 · PM company (`pm_company` tenants: `pm_portfolio`, `pm_staff`, `pm_contracts`)
- **`/portfolio`** (pm_company → PM portfolio; landlords keep theirs): figures row from `totals` (buildings · units,
  collected 12 months %, overdue now highlighted, open requests with SLA-breached, contracts ending); an info line when
  offers wait for an answer; the building table (pinned building + juristic, collection % with a thin line and the last
  cycle, overdue + accounts + > 90 days, budget use line or "no approved budget", work: requests · past SLA · work
  orders, staff today, the management contract's end). Empty state → contracts.
- **`/portfolio/buildings/[buildingId]`**: KPIs in sections (collection, arrears, budget, work, expiring service
  contracts table, staff today), panel = the management contract (fee per period, term, days left) + assign staff;
  privacy line (aggregates only — no resident, invoice or ledger line, D-334 (3)). 404 → not found.
- **`/portfolio/staff`** staff board: tabs วันนี้ (board: building cards with staff and end action; unassigned members
  with assign) · การมอบหมายทั้งหมด (`pmStaff.list`, current / all). Assign dialog (building, member, role, shift, from,
  to exclusive in words), end dialog; `pm_staff.not_member` / `outside_term` / `overlap` / `ended` as field errors /
  reload.
- **`/portfolio/contracts`** management contracts: tabs ข้อเสนอรอตอบ · มีผล · ทั้งหมด with counts; rows title +
  juristic, building, fee per period, term, state + access line.
- **`/portfolio/contracts/[contractId]`**: shared record (terms, fee in words, access grant window, fees requested per
  period); panel from `nextActions`: accept (explains the read grant and the start-date deadline), decline (reason),
  terminate (date today…end, reason, typed phrase). `management_contract.invalid_state` / `offer_expired` / `overlap`
  in words.

## 3 · Juristic management contracts (`juristic_management_contracts`)
Fits beside service contracts (vendors group): list + record reuse the shared record (charges with their expense
requests, PM staff assigned), offer / cancel / terminate from `nextActions`. The draft editor (building, PM tenant,
vendor, fee, term, account, WHT, resolution, document) is a follow-up if it does not fit (recorded in PROGRESS).

## src/ui, status, mocks
- Status maps `handover`, `managementContract`; no new `src/ui` component expected (StatsRow, ProgressLine, SimpleTable,
  ActionPanel, FactGrid, ViewTabs reused).
- Mocks `mocks/owner/handovers.ts` (state `handovers`, reset part `juristic`): five handovers (due and clean, with
  problems + unmatched bank, not due, accepted waiting for formation, rejected), accept / reject / formed with the API's
  rules; flags `unitOwned`, `mismatch`. `mocks/owner/pm.ts` (state `pm`, reset part `pm` and `juristic`): a PM company
  tenant + personas (owner, staff), three managed buildings (one is the juristic mock's อาคาร A), an offer, a terminated
  contract, staff and assignments with the API's checks; the juristic side reads the same contracts.

## Tests and gates
Units: handover gating (accept reason, problem words, unit filter), PM figures (share of a percent string, budget line,
staff board joins, assignment windows, contract actions), menu (rail placement, pm keys), status maps. Stories:
`Juristic/Handovers`, `PM/Portfolio`. Playwright specs written, not run: `e2e/juristic-handover.spec.ts`,
`e2e/pm-portfolio.spec.ts`. Lighthouse: juristic set + new `pm` set (≤ 260 KB initial JS).
