# Contract requests — getproperty-web

Endpoints or contract changes this frontend needs that the backend contract does not yet publish
(contract §1). Mocks of missing endpoints are marked `// CONTRACT-REQUEST` in `mocks/handlers/`.
Pinned contract: see `contract.lock.json`. What the API did with each request is recorded in
getproperty-api `docs/contract-requests-triage.md` (D-180).

## Open

| Date | Method | Path | Purpose | Fields | Status |
|---|---|---|---|---|---|
| 2026-10-17 | — | `InvoiceStatus`, `PaymentStatus`, `ServiceRequestStatus`, `WorkOrderStatus` | The remaining status enums as named components; `src/domain/status` keeps the planned values through `ContractEnum` until then. | named enum components | open — B4 (invoice, payment), B5 (service request, work order) per the triage |
| 2026-10-17 | — | `PublicPlanDto.features` | The features are module keys (`A1`, `A2`, `C2`, `resident_liff`, …); the pricing page shows only the keys it has a label for. Publish `features` as a named enum (`PlanModuleKey`) or with display labels so a new module is never silently hidden. | `PlanModuleKey` enum, or `features: [{ key, labelTh, labelEn }]` | open |
| 2026-10-17 | GET | `/v1/staff/buildings` | The staff PWA's building switcher (F4 4.1): the buildings of my scope (Staff: `currentTenant.buildingIds`, D-090) with names — `me` has ids only. Until then the list comes from `GET /v1/staff/reading-rounds/current` (one entry per building of the scope). Mocked in `mocks/handlers/contract-requests.ts`; shape in `src/lib/api/pending.ts`. | `{ data: [{ id, code, name, floorsCount\|null, unitCount }] }` | open |
| 2026-10-17 | — | `RoundBuildingDto.total`, `RoundBuildingDto.read` | Round progress for the whole round (F4 4.1 progress bar): the API lists only meters still to read (`remaining`), so the PWA counts what *this device* read; another staff member's readings are invisible to the bar. | `total: integer` (meters in the round), `read: integer` (accepted or pending review in the window) | open |
| 2026-10-17 | GET | `/v1/staff/buildings/{buildingId}/meters` | Meter points of a building for the staff PWA (F4 4.3: binding wizard, swap, per-unit device list) — the owner's `GET /v1/owner/buildings/{buildingId}/meters` is not on the staff BFF's allow-list (`/v1/staff` only). Until published, the devices screens say the list is not available. Mocked in `mocks/handlers/contract-requests.ts`; shape `StaffMeterPoint` in `src/lib/api/pending.ts`. | `{ data: [MeterDto & { floorName\|null, lastRegister\|null, channel: { channelId, gatewayDeviceId, meterDeviceId\|null, meterDeviceSerial\|null, busId, busType, address\|null, pin\|null }\|null }] }` | open |
| 2026-10-17 | GET | `/v1/staff/meter-drivers` | The getproperty-edge driver catalogue (D-013) for the binding wizard: which driver keys exist, on which bus type, with the model names they read. The wizard offers `eastron_sdm120`, `eastron_sdm230`, `pulse_counter` (edge E1.2/E1.3) meanwhile; a device from the building's inventory brings its own driver. | `{ data: [{ key, busType, vendor, models: string[], utility }] }` | open (not mocked) |
| 2026-10-17 | GET | `/v1/staff/install-orders` | Install work orders from Smart-plan subscriptions (F4 4.3 §1: per-unit device list to install). Today the PWA derives the install work from devices `assigned` to the building and meter points without a channel. | `{ data: [{ id, buildingId, unitId, unitNo, items: [{ kind: gateway\|meter_device, assetItemId\|null, deviceId\|null, state: open\|done }], dueAt\|null }] }` | open (not mocked) |

## Closed

| Date | Method | Path | Purpose | Resolution |
|---|---|---|---|---|
| 2026-10-17 | — | `OperatorMeDto.menu`, `AdminMeDto.menu` | Menu keys as named enums. | **done** in api `13be5a7` (D-180): `OwnerMenuKey`, `StaffMenuKey` (staff `me` = `StaffMeDto`), `AdminMenuKey`. Adopted at api `c13978b`: `src/features/*/shell/menu.ts` are `MenuRegistry<Schemas["…MenuKey"]>` (a new key fails the build); new keys owner `devices`, staff `reading_rounds` (served by `/readings`), admin `ota_releases`, `ingest_dead_letters`. |
| 2026-10-17 | — | `InvitationCreatedDto.inviteUrl` | Staff invitations on the staff host. | **done** in api `13be5a7`: Staff → `PUBLIC_STAFF_APP_URL/join?code=`. The staff host now serves `/join?code=` (→ `/login?invitation=`). |
| 2026-10-17 | GET | `/v1/owner/search?q=` | Global search of the owner top bar. | **done** in api `13be5a7` (`SearchResultDto`, hit types building, unit, party, lease, device; invoices with B4). Mock moved to `mocks/handlers/search.ts`. |
| 2026-10-17 | GET | `/v1/public/plans` | Pricing page (D-156). | **done** in api `13be5a7` (`PublicPlansDto`: single price or `priceFrom`/`priceTo`, `kind` plan/addon, `status: proposed`, `report` unit). The pricing page shows ranges, add-ons and the "indicative" badge. |
| 2026-10-17 | GET | `/v1/public/utility-tariffs/current` | Loss-calculator teaser. | **done** in api `13be5a7` (`PublicTariffDto`; 404 `tariff.not_found` while nothing is published → the teaser hides). |
| 2026-10-17 | POST | `/v1/{owner,staff,admin}/telemetry/web-vitals` | Web Vitals RUM. | **done** in api `13be5a7` (`WebVitalsReportDto`, 202). The client now sends route patterns (`routePattern`, ids → `[id]`). |
| 2026-10-17 | POST | `/v1/staff/readings` | One meter reading from the staff PWA (offline queue target). | **done** in api `e00cfae` as **`POST /v1/staff/meter-readings`** (`MeterReadingCreateDto { assetItemId, photoDocumentId, typedValue?, readAt, note? }`, `Idempotency-Key`); the queue targets it (F4 4.1). |
| 2026-10-17 | — | `nextActions` on editable aggregates | Actions the actor may take now. | **done** in api `13be5a7` / `e00cfae` (units, inspections, invitations, bank accounts, support grants, DSRs, tariff versions, devices, OTA rollouts, reading reviews). |
| 2026-10-17 | — | Status enums as named components | `LeaseStatus`, `DepositStatus`, `ReadingSource`, `ReadingReviewState`, `MeterHealth`, `DeviceStatus` … | **done** for B2/B3 enums (`src/domain/status` now resolves them from the contract); the rest is the open row above. |
