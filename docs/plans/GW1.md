# GW1 — Storage (web, after api G1)

Pack: `docs/prompts/G-growth-web.md` GW1 · decisions D-276, D-279, D-285, D-286, D-292 · open O-022 (package prices).

## Contract
- Adopt the api contract at HEAD (G0+G1+G2, Mac `5931568`): `API_CONTRACT_REF=<sha> pnpm gen:api --adopt`, `apiCommit` = `5931568`.
- Re-sync `docs/decisions.md` from getproperty-api (`docs/contract/api-conventions.md` is unchanged; web keeps no device-protocol copy).
- G2 types arrive with the same contract: owner menu keys `mandated_units`, `mandates`, `co_broke`, `deals` are registered as `null` (no page yet) until GW2.

## Owner (extend B7 / D-276 — no second meter)
- `StorageCard` (subscription page) gains the G1 figures: free + packages = quota, category breakdown (listing media, attachments, legal documents, other system files) as one stacked list with bars, the legal-hold share explained (counted, never deletable, always issued), bytes waiting for purge; a "Manage storage" link.
- New page `/subscription/storage` (same menu entry `subscription`): banner at 80 % (warning) / 100 % (full / over), the extended `StorageCard`, **packages** (my packages with state, period, invoice link, auto-renew switch; offers from `GET /v1/owner/storage/packages` — buy with confirmation restating size + total incl. VAT and an Idempotency-Key, or "ยังไม่เปิดขาย" when `onSale` is false; never a price the API did not send), **largest files** (`GET /v1/owner/storage/files`, tabs stored / deleted, pagination, multi-select; bulk delete with confirmation (restorable for the purge window) and restore; legal-hold and other non-deletable rows locked with their reason and retention date).
- Same banner on the subscription page.
- Status maps: `storagePackage` (`StoragePackageState`).

## Admin (extend the storage tab of D-279)
- Package definitions (`GET/POST /v1/admin/storage/packages`, `PATCH …/{id}`) replace the legacy `storage.packs` setting card (the setting stays empty since D-285): table with size, period, tenant type, visibility, price / on sale, version state, active window; *New package* (key, names, size GB, period, tenant type, visibility, price optional, VAT, effective from — never backdated) and *Edit* (names, active switch); price changes point to Price plans (new version + publish). `per_package` added to the price-plan version billing units.
- Usage table rows: *Set free quota* (`PUT /v1/admin/tenants/{id}/storage-quota`: GB, effective from, reason = audit note) and *Reconcile now* (`POST …/actions/reconcile`).
- Reconciliation report card (`GET /v1/admin/storage/reconciliations`): drift, corrected, orphans / missing.

## Mocks
- `mocks/storage-world.ts` (state: definitions, tenant packages, files, quota overrides, reconciliations; reset with the owner part `storage` and the platform reset); owner handlers `mocks/owner/storage.ts` (moves `GET /v1/owner/storage` out of settings), admin handlers `mocks/platform/storage.ts`; controls `POST /__mock/storage/price?key=&price=` (founder publishes a price) and `POST /__mock/storage/pay?package=` (Finance records the payment).

## Tests
- Unit: storage helpers (category order, level → banner), status map coverage.
- e2e `owner-storage.spec.ts`: meter + legal-hold explanation, not-on-sale state, bulk delete (held rows locked) → deleted tab → restore, buy after a price is published → pending → paid → quota up; axe. `admin-platform.spec.ts`: package create / edit, quota override with reason, reconcile; axe.
