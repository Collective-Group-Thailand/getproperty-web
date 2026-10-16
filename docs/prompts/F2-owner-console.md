# F2 — Owner console (owner zone)

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F1 เสร็จแล้ว · ทำทีละ Deliverable (2.1 → 2.6) ต่อ 1 session · รันกับ MSW ได้จนกว่า backend deliverable จะมี
> หลักออกแบบ (D-100): หน้าแรกคือ "เช้านี้ต้องทำอะไร" — ไม่ใช่เมนูยาว ๆ
> ศัพท์ (D-151): **tenant** = องค์กรลูกค้า SaaS (อพาร์ตเม้นต์รายแรก) · ผู้อยู่อาศัย = **party** ที่มี `occupancy` (resident) · `building` → `floor` → `unit` · `lease` · `invoice` / `invoice_line` · `service_request` → `work_order` — ใช้ในโค้ด route และ copy ภาษาอังกฤษ; copy ภาษาไทยใช้คำที่คนอ่านเข้าใจ (ห้อง, ผู้เช่า, บิล)

---

You are a senior frontend engineer on **`getproperty-web`**. Build the operator's console for a tenant (Phase 1: the first apartment customer; condo juristic / PM / landlord views come later on the same screens, D-150). Every screen shows the data the API returns and never computes money, tariffs or dates.

## Deliverable 2.1 — Dashboard & buildings/units (B2.1, B4.5, B3.4)
1. **Dashboard** (`/`): "Today" queue (readings pending before cut-off, invoices to review/issue, slips to review, deposits due in ≤ 3 days, stale meters, overdue residents, new service requests (R2)), KPI row (collected this month %, arrears, occupancy, **loss % with THB**), billing-cycle state card with the next cut-off, compliance score, quick actions. Building switcher drives everything; "all buildings" summary for tenants with several properties/buildings.
2. **Buildings & units** (A1.1 unit board): property → building list/detail (address, utility accounts, billing-cycle settings, VAT status), **unit board** (floors × units; card = unit code, unit status (vacant / occupied / reserved / under maintenance), current resident, balance, meter health dot; filters; click → unit drawer with occupancy and lease, last readings with photos, open invoice, open service requests (R2)), unit list (DataTable, saved views), bulk create wizard, Excel import with preview, unit type editor (`unit.type` room / … with default rent and lease lines).
3. Settings entry points for the billing cycle and reading policy (full settings in 2.6).
4. Tests: dashboard renders every queue from mocks; unit board keyboard navigation; axe; Lighthouse (owner list/detail budget).

## Deliverable 2.2 — Parties, leases, deposits (B2.2–B2.4)
1. **Party directory** (residents and other parties of the tenant: search, occupancy per unit — lessee / co-resident, documents with audited download, LINE link state), create/invite flow (QR to show on screen + SMS) that sends the resident to `getproperty-liff`.
2. **Lease wizard**: unit → lessee party (+ co-residents) → term & amounts (deposit/advance with the cap hint from the API's compliance preview endpoint; refusals shown with `legalRef`) → lease lines (utility mode metered/included, parking, internet…) → contract preview (standard contract + allowed addendum) → send for e-signature (the resident signs in `getproperty-liff`) → status tracking → countersign. Lease detail with timeline, documents, notice/renewal/termination actions (typed confirmations).
3. **Deposits**: list with 7-day countdown, settlement workspace (move-in vs move-out inspection comparison side-by-side with photos, damage items with evidence upload, proposed refund from the API, resident response state, refund recording with transfer reference), overdue highlight.
4. Tests: wizard validation and compliance refusal rendering; settlement flow on mocks; axe.

## Deliverable 2.3 — Billing cycles & invoices (B4.2, B4.3)
1. **Billing-cycle workspace** (`/billing`): current `billing_cycle` per building with state stepper (open → readings pending → computed → issued → closed); readings-pending table (unit, meter, last reading, who is assigned, "request reading" → staff task); computed review table (per unit: previous/current reading with source badge + photo thumbnail, units consumed, rate plan, amounts, flags: estimated, above-cap refused, zero usage, first/last month pro-rata) with inline one-off `invoice_line`s; **Issue all** typed confirmation (restates building, period, count, total) with `Idempotency-Key`; auto-issue setting banner.
2. **Invoices**: list (filters by period/status/unit), invoice detail (`invoice_line`s by `source_type` with the disclosure fields D-022, QR, delivery log to LINE, payments, documents), actions: resend, void (before payment), credit/debit note wizard; PDF viewer.
3. Tests: issue flow; flags rendering; invoice detail matches contract examples; axe.

## Deliverable 2.4 — Payments, slips, arrears, documents (B4.4, B4.5, B4.3)
1. Payments list (method, provider ref, allocation to invoices), **slip review queue** (image viewer with zoom, verification result, duplicate warning, approve/reject with reason), manual payment recording (cash/transfer with evidence; typed confirmation), refunds/overpayment credits.
2. **Arrears**: aging table, per-party drill-down, send reminder now, reminder schedule indicator, late-fee policy state (read-only unless allowed).
3. Documents archive (receipts, tax invoices, leases, notices; period filter, zip export), receipts resend.
4. Tests: slip approve/reject; arrears filters; axe.

## Deliverable 2.5 — Meters, devices, loss (B3.1, B3.3, B3.4)
1. Meter points per building (`asset_item` meters with their `meter_assignment` to units; health, last reading, source, series chart 15m/1h/1d), reading history with photos, review queue for OCR/manual readings (accept/correct/reject).
2. Devices (read-mostly for operators): gateways & meters with status, config version, last seen, "identify"/"read now" commands; rented vs owned badge; swap history.
3. **Loss workspace**: enter utility invoice (manual or photo with OCR prefill), loss report per cycle (units/THB/%, trend chart, suspects list with links to units/meters), export.
4. Tests: series chart accessibility (data table fallback); invoice entry; axe.

## Deliverable 2.6 — Settings, members, subscription, reports (B1.3, B6.1, B4.5)
1. Tenant settings (company data for documents, logo, VAT flag, bank account with OTP confirmation step, reminder schedule, quiet hours, estimate policy, reading photo requirement, `rate_plan`s ≤ cap with the cap shown from the utility tariff versions), building settings (billing cycle, cut-off, grace), members & roles, notification routing matrix (resident-facing events), privacy (consent purposes, DSR inbox).
2. Subscription page: plan (D-156: Apartment Starter / Smart …), usage (active units counted), invoices with QR, upgrade Starter → Smart (site survey request), read-only mode banner when suspended.
3. Reports & exports: income/expense summary, VAT working figures (VAT-registered tenants), FlowAccount / PEAK / Excel exports with period picker; insights (pilot KPIs for the tenant from the B6.3 endpoint when present).
4. Tests: bank-account OTP step; settings effective-date display; exports download via BFF streaming; axe; Lighthouse.

## Not in F2
Service requests & work orders on the owner side (A4 triage, SLA, assignment, preventive maintenance) are R2: the dashboard queue and the unit drawer reserve their place (2.1); the deliverable prompt is written when R2 is planned. The resident side (request intake, rating) and the external technicians' "my work orders" are `getproperty-liff` L4.
