# F2 — Owner console (owner zone)

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F1 เสร็จแล้ว · ทำทีละ Deliverable (2.1 → 2.6) ต่อ 1 session · รันกับ MSW ได้จนกว่า backend deliverable จะมี
> หลักออกแบบ (D-100): หน้าแรกคือ "เช้านี้ต้องทำอะไร" — ไม่ใช่เมนูยาว ๆ

---

You are a senior frontend engineer on **`getproperty-web`**. Build the landlord's console. Every screen shows the data the API returns and never computes money, tariffs or dates.

## Deliverable 2.1 — Dashboard & properties/rooms (B2.1, B4.5, B3.4)
1. **Dashboard** (`/`): "Today" queue (readings pending before cut-off, bills to review/issue, slips to review, deposits due in ≤ 3 days, stale meters, overdue tenants), KPI row (collected this month %, arrears, occupancy, **loss % with THB**), cycle state card with the next cut-off, compliance score, quick actions. Property switcher drives everything; "all properties" summary for multi-property orgs.
2. **Properties & rooms**: property list/detail (address, utility accounts, billing cycle settings, VAT status), **room map** (floors × rooms; card = code, status, tenant, balance, meter health dot; filters; click → room drawer with lease, last readings with photos, open bill, tickets later), room list (DataTable, saved views), bulk create wizard, Excel import with preview, room type editor (default rent and lease lines).
3. Settings entry points for billing cycle and reading policy (full settings in 2.6).
4. Tests: dashboard renders every queue from mocks; room map keyboard navigation; axe; Lighthouse (owner list/detail budget).

## Deliverable 2.2 — Tenants, leases, deposits (B2.2–B2.4)
1. Tenant directory (search, documents with audited download, LINE link state), create/invite flow (QR to show on screen + SMS).
2. **Lease wizard**: room → tenant(s) → term & amounts (deposit/advance with the cap hint from the API's compliance preview endpoint; refusals shown with `legalRef`) → lease lines (utility mode metered/included, parking, internet…) → contract preview (standard contract + allowed addendum) → send for signature → status tracking → countersign. Lease detail with timeline, documents, notice/renewal/termination actions (typed confirmations).
3. **Deposits**: list with 7-day countdown, settlement workspace (move-in vs move-out inspection comparison side-by-side with photos, damage items with evidence upload, proposed refund from the API, tenant response state, refund recording with transfer reference), overdue highlight.
4. Tests: wizard validation and compliance refusal rendering; settlement flow on mocks; axe.

## Deliverable 2.3 — Billing cycles & bills (B4.2, B4.3)
1. **Cycle workspace** (`/billing`): current cycle per property with state stepper (open → readings pending → computed → issued → closed); readings-pending table (room, meter, last reading, who is assigned, "request reading" → staff task); computed review table (per room: previous/current reading with source badge + photo thumbnail, units, tariff, amounts, flags: estimated, above-cap refused, zero usage, first/last month pro-rata) with inline one-off items; **Issue all** typed confirmation (restates property, period, count, total) with `Idempotency-Key`; auto-issue setting banner.
2. **Bills**: list (filters by period/status/room), bill detail (lines with disclosure fields D-022, QR, delivery log to LINE, payments, documents), actions: resend, void (before payment), credit/debit note wizard; PDF viewer.
3. Tests: issue flow; flags rendering; bill detail matches contract examples; axe.

## Deliverable 2.4 — Payments, slips, arrears, documents (B4.4, B4.5, B4.3)
1. Payments list (method, provider ref, allocation), **slip review queue** (image viewer with zoom, verification result, duplicate warning, approve/reject with reason), manual payment recording (cash/transfer with evidence; typed confirmation), refunds/overpayment credits.
2. **Arrears**: aging table, per-tenant drill-down, send reminder now, reminder schedule indicator, late-fee policy state (read-only unless allowed).
3. Documents archive (all document types, period filter, zip export), receipts resend.
4. Tests: slip approve/reject; arrears filters; axe.

## Deliverable 2.5 — Meters, devices, loss (B3.1, B3.3, B3.4)
1. Meter points per property (health, last reading, source, series chart 15m/1h/1d), reading history with photos, review queue for OCR/manual readings (accept/correct/reject).
2. Devices (read-mostly for owners): gateways & meters with status, config version, last seen, "identify"/"read now" commands; HaaS vs owned badge; swap history.
3. **Loss workspace**: enter utility invoice (manual or photo with OCR prefill), loss report per cycle (units/THB/%, trend chart, suspects list with links to rooms/meters), export.
4. Tests: series chart accessibility (data table fallback); invoice entry; axe.

## Deliverable 2.6 — Settings, members, subscription, reports (B1.3, B6.1, B4.5)
1. Org settings (company data for documents, logo, VAT flag, bank account with OTP confirmation step, reminder schedule, quiet hours, estimate policy, reading photo requirement, utility rates ≤ cap with the cap shown from tariffs), property settings (billing cycle, cut-off, grace), members & roles, notification routing matrix (tenant-facing events), privacy (consent purposes, DSR inbox).
2. Subscription page: plan, usage (rooms counted), invoices with QR, upgrade Lite → Smart (site survey request), read-only mode banner when suspended.
3. Reports & exports: income/expense summary, VAT working figures (VAT orgs), FlowAccount / PEAK / Excel exports with period picker; insights (pilot KPIs for the org from B6.3 endpoint when present).
4. Tests: bank-account OTP step; settings effective-date display; exports download via BFF streaming; axe; Lighthouse.
