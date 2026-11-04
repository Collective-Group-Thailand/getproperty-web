# J — Juristic console & gate surface · getproperty-web

Kickoff prefix: the repo's standard prefix (CLAUDE.md, master plan, design-system.md, `../docs/design/DESIGN.md`) + `../docs/design/J-DESIGN.md` + `../getproperty-api/docs/prompts/J-README.md` + this file. `Do JW<N> only. Plan first, then execute.` Adopt the contract: `API_CONTRACT_REF=<api sha> pnpm gen:api --adopt`.

Design is decided in `J-DESIGN.md` (design lead). Stitch references live in `../docs/design/stitch/j/` with `NOTES.md` — take layout and density from them, never their drift (Inter font, redrawn logo, coloured money, pills). Use the G0 shell (ConsoleRail), shared pieces, tokens and i18n. Thai + English for every string.

## JW1 — Juristic console: register, charges, receivables (after J1.2)
Routes (juristic tenants only; menu keys from the API):
- `/juristic` overview: figures row (billed, collected %, outstanding highlighted, units in arrears, active plans), aging strip (4 buckets), this cycle's rail (open → computed → issued → collecting), tasks (approvals waiting, debt clearance requests, disputes).
- `/juristic/register` co-owner register: plots or floors by `property.kind` (village = soi/plot list with land area; condo = floor cards with ratio), unit record with owners and shares, bill-to party, channels, invite code (print QR sheet in batch), transfer wizard (date, buyer, proration preview).
- `/juristic/budgets` and `/juristic/budgets/[id]`: budget lines by account, linked resolution, "สร้างอัตราจากงบนี้" → rate plan draft with basis picker and a live preview of per-unit amounts (min / median / max, total equals budget).
- `/juristic/resolutions` list + record (paper-like document view, attachments).
- `/juristic/cycles` reuse billing cycles with frequency, unearned schedule shown on the cycle record.
- `/juristic/receivables` (Stitch `receivables-desktop`): tabs with counts, pinned unit column, owner + second line, outstanding / surcharge right aligned, oldest overdue, next step badge, channels, bulk bar (remind, propose plan, pause). Case record: timeline of collection events, statement, plan, dispute, actions panel.
- `/juristic/plans` payment plans list + record with instalment table.
- `/juristic/debt-clearance` requests queue, issue/refuse, certificate document view, public verify page `/verify/[code]` (public zone).
- `/juristic/collections/settings`: ladder editor as a vertical step list (offset, action, channel, template preview, approval) — legal steps show "ต้องให้ทนายยืนยันก่อนเปิดใช้" while O-038 is open (from the API flag).
- Printed letters: batch print view (A4, address window) for parties without digital channels.
Acceptance: Vitest units for basis preview rounding display, ladder editor, bulk actions; Playwright specs written (deferred run): register → transfer, budget → rate, receivables bulk remind, debt clearance issue/refuse, verify page; Lighthouse owner budgets; Storybook stories for new pieces.

## JW4 — Gate surface and gate admin (after J4.2)
- `/gate` (guard audience, tablet landscape 1180×820 and portrait 820×1180; Stitch `gate-tablet`): device registration flow + PIN, shift switch, entry card (plate keypad with Thai category letters + number + province, kind segmented control with 64-px targets, destination search by house / soi / owner, optional photo via camera, PDPA note from API), primary "แจ้งเจ้าของบ้าน", "สแกน QR เชิญ" (camera), waiting list with live timers and policy progress, inside list with exit stamp, SOS banner that takes over the top of the screen with acknowledge.
- Offline-first: IndexedDB queue with client ids, visible "ออฟไลน์ · จะส่งเมื่อกลับมาออนไลน์ (3)" status, retries; SSE reconnect with backoff.
- Kiosk hygiene: no hover-only affordances, 17-px body, 28-px plate in mono, high contrast for sunlight, screen wake lock, auto lock after inactivity to the PIN screen.
- `/juristic/gate` admin: gates and devices, guards and shifts, estate policies (delivery drop point, default timeout policy, retention days read-only from API), blacklist, visitor log with filters (logged reason required to open), incident log and record.
Acceptance: units for keypad, queue, timers; Playwright (deferred) visitor loop with mock SSE, offline queue, invite scan (mock camera); Lighthouse budget for `/gate` (JS ≤ 180 KB first load).

## JW2 — Accounting, funds, expenses, vendors (after J2.2)
- `/juristic/accounting`: income/expense statement by month with year switch, budget vs actual table (bars inline, brand blue only for actual), balance sheet, export menu (CSV / Express / FlowAccount).
- `/juristic/funds` fund ledger and account, transfer with resolution picker.
- `/juristic/expenses` list + new request form (numbered sections, attachments, WHT), approval inbox for committee/manager with band explanation, payment record, 50 ทวิ document.
- `/juristic/petty-cash`, `/juristic/bank-statements` import + match queue (two-pane: statement lines left, candidates right).
- `/juristic/vendors`, contracts (expiry badges), quotation rounds (comparison table of ≥ 3 quotes), evaluations, PM schedules calendar.
Acceptance: units for comparison table and match queue logic; Playwright specs (deferred); Lighthouse owner budgets.

## JW3 — Import, handover inbox, PM portfolio (after J3.3)
- `/juristic/import` 4-step wizard (Stitch `import-wizard-desktop`): upload templates, validation table with inline fixes and download of bad rows, reconcile card (file vs declared vs bank; difference requires a reason + attachment), go-live with rollback note; parallel cycle comparison view.
- Handover inbox (developer → juristic) with totals and acceptance.
- PM portfolio `/portfolio`: building table with collection rate, arrears, budget use, SLA, staff assignment board, management contracts.
Acceptance: units for wizard state machine; Playwright (deferred); Lighthouse.
