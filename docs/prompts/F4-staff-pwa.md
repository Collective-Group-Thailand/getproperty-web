# F4 — Staff PWA (staff zone)

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F1 เสร็จแล้ว · ทำทีละ Deliverable (4.1 → 4.3) ต่อ 1 session
> หลักออกแบบ: ใช้มือเดียว กลางแดด เน็ตไม่นิ่ง — ปุ่มใหญ่ กล้องก่อน พิมพ์น้อย ทำงาน offline ได้แล้วค่อย sync
> ศัพท์ (D-151): `building` → `floor` → `unit` · `asset_item` / `meter_assignment` · resident (party) · `work_order` · ช่างภายนอก (external technician) ใช้ LINE Mini App ใน `getproperty-liff` (`/v1/technician/*`, R2) — **ไม่ใช่** zone นี้

---

You are a senior frontend engineer on **`getproperty-web`**. Build the PWA for a tenant's building staff — caretakers, in-house technicians and installers (Staff role, audience `operator`, `/v1/staff/*`; Owners/Managers also use it on the go).

## Deliverable 4.1 — Today & reading rounds (B3.3)
1. **Today**: tasks grouped (readings before cut-off, inspections, installs, work orders (R2), parcels (R2)) with counts and floor grouping; building switcher for staff assigned to several.
2. **Reading round**: list of meter points still needing a reading (floor → unit → meter), each a big card with the last reading + thumbnail; **capture flow**: camera (rear, torch toggle, guide frame for the register), OCR result shown with confidence and the previous reading, typed correction with a big numeric keypad, plausibility warning from the API (out of band → "will go to review"), submit with `Idempotency-Key`; **offline queue** (ADR-0007): submissions stored in IndexedDB with the photo, replayed in order when online, per-item sync state and conflict handling; round progress bar.
3. Tests: Playwright with a fake camera stream; offline → online replay; axe with 48 px targets; Lighthouse staff budget.

## Deliverable 4.2 — Inspections & deposits (B2.4)
1. Inspection checklist (template per unit type) with per-item condition + photos (multi-shot, compressed client-side), signatures (staff + resident on the device), submit; move-out view shows the move-in photo beside the camera for the same item.
2. Tests: checklist persistence while offline; photo compression size budget; axe.

## Deliverable 4.3 — Device provisioning & installs (B3.1)
1. Install work orders (from Smart-plan subscriptions): per-unit device list; **gateway provisioning** by QR scan (ScanButton → provisioning code → API), network check feedback (gateway online within N minutes shown via SSE); **meter binding wizard**: scan meter QR/serial → choose meter point (`asset_item`) → bus/address or pin → photograph the physical register and type the install reading (becomes the first manual reading) → identify (LED) → done (creates the `meter_assignment` to the unit); swap flow with both readings and photos; local status page link for the gateway.
2. R2: **work orders** assigned to in-house staff (my work orders, check-in, before/after photos, parts and cost, close; the same flow external technicians get in `getproperty-liff`), parcels (photo → unit → notify the resident), temporary access codes for assigned work orders.
3. Tests: provisioning flow on mocks; binding wizard validation; work-order close on mocks (R2); axe.
