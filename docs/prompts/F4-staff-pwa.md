# F4 — Staff PWA (staff zone)

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F1 เสร็จแล้ว · ทำทีละ Deliverable (4.1 → 4.3, R2: 4.4) ต่อ 1 session
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
2. R2: work orders, parcels and access codes for assigned work orders — Deliverable 4.4.
3. Tests: provisioning flow on mocks; binding wizard validation; axe.

## Deliverable 4.4 — Today's tasks, work orders, parcels (R2: B5.1, B5.2, B5.3, B5.4; D-072, D-090, D-210–D-213)
> R2 deliverable written when B5 landed (api `57eef37`). It replaces the R2 tiles of 4.1 and the R2 item of 4.3.
1. **Today** (`/`): the list comes from **`GET /v1/staff/tasks?building=&date=&mine=`** (D-213) — groups by type (work orders, inspections, readings, parcels, install orders) with counts, floors inside each group (building-wide first), most urgent first, overdue marked (priority raised by the API), a "mine / everyone" switch; each task opens its screen, and the **complete** action (`POST /v1/staff/tasks/{type}/{id}/actions/complete`, `Idempotency-Key`) is offered where the task can be finished from the list (`completable`): a work order with its after photo already taken, a parcel handed over with the resident's PIN or as staff-confirmed; a reading or an inspection opens its own capture / checklist (they need a photo or signatures); install orders are read-only (`staff_task.not_completable`, D-081). The reading round's progress stays on Today.
2. **Work orders** (`/work-orders`): my active work orders (`mine=true`) and the open service requests of my buildings (triage, take it = a work order assigned to me). **Work order page** (`/work-orders/[id]`), one-handed big buttons following the API's `nextActions`: **check-in** (the staff surface has no separate *accept*: checking in accepts), **before photos** with `CameraCapture` (compressed on the device, uploaded as `service_photo`, `POST …/photos` role `before`), **waiting for parts** with a note → **resume**, **after photos**, parts and costs (description, kind, quantity, unit price, optional receipt photo; the API computes the amount), **complete** with a note (the API refuses without an after photo, `work_order.photo_required`); the request's description and photos; **access codes** for the work order (`GET /v1/staff/work-orders/{id}/access`: the time-boxed PIN of each lock, valid from / to, shown on a tap). Verification stays with the owner (2.7).
3. **Parcels** (`/parcels`): **intake** — photo of the label (`CameraCapture`) → unit (from the building's units) → optional carrier / tracking → `POST /v1/staff/parcels` (the API notifies the resident) —; the parcels **waiting** with photo and unit; **pick-up** with the resident's 6-digit **PIN** (big keypad) or staff-confirmed, and return with a reason.
4. Tests: e2e with axe and 48-px targets (Today groups and complete; work order check-in → before / after photos with the fake camera → wait parts → resume → cost → complete; access codes; parcel intake → PIN pick-up); Lighthouse staff set (new pages within 200 KB, D-179); real-API run (with 2.7): staff completes the owner's work order with photos; a parcel taken in on the PWA is picked up with the PIN the resident reads through the API.
