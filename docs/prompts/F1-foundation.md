# F1 — Foundation: zones, proxy, BFF & auth, contract & mocks, i18n, shells, PWA base

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F0 เสร็จแล้ว
> ทำทีละ Deliverable ต่อ 1 session (1.1 → 1.3)

---

You are a senior frontend engineer on **`getproperty-web`**. Build the skeleton that every screen depends on. No business screens yet.

> **Three zones (D-154)**: owner, staff, admin. Everything resident-facing — LIFF init/login/account linking, the resident BFF (`/v1/resident/*`, `/v1/technician/*`), the LIFF CSP, the resident shell, my/km/lo/zh scaffolding — moved to the separate repository **`getproperty-liff`** (`docs/prompts/L1-foundation.md` there). Do not build any of it here. Naming per D-151: *tenant* = SaaS customer organisation; residents are parties.

## Deliverable 1.1 — Zones, proxy, root layouts, security headers
1. Env schema (zod, validated at boot, server/client split): `OWNER_HOST`, `STAFF_HOST`, `ADMIN_HOST`, `API_INTERNAL_URL`, `API_CONTRACT_SOURCE`, `NEXT_PUBLIC_ASSET_BASE_URL`, `NEXT_PUBLIC_LINE_OA_ID` (OA chat link in help), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `SENTRY_*`, `ZONES`, `NEXT_PUBLIC_ENV_BADGE`. No `TENANT_HOST` and no `NEXT_PUBLIC_LIFF_ID` (they belong to `getproperty-liff`).
2. `src/proxy.ts`: resolve zone from `Host` (with `*.localhost`); rewrite staff/admin hosts to their segments; 404 another zone's segment and `/bff/*` on the wrong host; unknown hosts → 404; next-intl on the owner host (`th` default no prefix, `en` at `/en`); per-zone CSP with nonce (staff allows camera; admin strictest; no LINE/LIFF domains anywhere), `X-Robots-Tag: noindex` on every non-marketing route, HSTS, `Referrer-Policy`, `Permissions-Policy` (camera on staff only); access-token refresh before rendering.
3. Three root layouts with zone providers (theme cookie `gp_theme`, next-intl, TanStack Query, toasts), fonts from `src/ui/fonts`, error boundaries per segment, `not-found`, `global-error`. Staff/admin locale from a cookie (th default), also settable from `/v1/{owner|admin}/me.language`.
4. ESLint zone boundaries with a failing fixture test (three zones + the retired `tenant`/`resident` segments — done with D-154; keep green).
5. Tests: unit tests for host → zone resolution; Playwright: each host renders its shell; `/staff` on the owner host → 404; `/tenant` anywhere → 404; admin responses carry `noindex`.

## Deliverable 1.2 — Contract, API clients, BFF, auth
1. `pnpm gen:api` (reads `API_CONTRACT_SOURCE`, verifies sha256 from `contract.lock.json`, `openapi-typescript` → `src/lib/api/schema.d.ts`, MSW base handlers into `mocks/generated/` from contract examples; error-path handlers from documented problem codes incl. `compliance.*`); CI contract-drift job. If the backend contract is not ready, bootstrap with a hand-written seed contract in `mocks/seed-openapi.json` (auth + `me` endpoints per contract §4), clearly marked.
2. `serverApi(zone)` and `browserApi` (openapi-fetch) with `Accept-Language`, `X-Tenant-Id` (from `__Host-gp_tenant`), request id, problem-details → typed `ApiError` (`code`, `detail`, `legalRef`, field `errors` mapped onto react-hook-form), automatic `Idempotency-Key` for flagged operations, `If-Match` support, query-key factory, TanStack Query defaults; `SubscriptionSuspendedError` handling (read-only banner).
3. `createBffHandler(zone)` for the three BFF routes: upstream allow-list per §4 (`/v1/resident/*` and `/v1/technician/*` refused by every zone here), token attach, refresh-once on `401`, cookie rotation, streaming passthrough (PDF, SSE), same-origin + `x-getproperty-csrf` check on non-GET, body size limit (slip and meter photos go to object storage by presign, not through the BFF), no caching of authenticated responses.
4. Auth (audience `operator` for owner/staff, `platform` for admin): owner sign-in (phone OTP primary; email + password + TOTP), **tenant switcher** for users who belong to several tenants (sets `__Host-gp_tenant`, sent as `X-Tenant-Id`); staff sign-in (OTP) + optional device PIN re-lock after inactivity; admin sign-in (email + password + TOTP); logout everywhere; `getActor(zone)` reading `/v1/{owner|staff|admin}/me` (cached per request); route guards in layouts. The resident LIFF flow (`liff.init` → id token → `/v1/auth/resident/line` → cookies; magic-link fallback) is `getproperty-liff` L1.
5. Tests: Vitest for BFF (allow-list incl. refusal of `/v1/resident`, CSRF, refresh-once, cookie flags); Playwright on MSW: owner OTP login → dashboard shell shows tenant name + role; tenant switcher sets the cookie and the next request carries `X-Tenant-Id`; an owner cookie never authenticates on the admin host; suspended subscription renders the read-only banner.

## Deliverable 1.3 — Shells, i18n, domain presentation, PWA base, observability, quality gates
1. **Shells** from `src/ui` AppShell:
   - Owner: collapsible sidebar built from **menu entitlements in `/v1/owner/me`**, topbar (tenant switcher when several, building switcher, global search, notification centre, language, environment badge, user menu), breadcrumbs; mobile: bottom nav (Today, Units, Invoices, Money, More).
   - Staff (PWA): big-target bottom nav (Today, Readings, Inspect, Work orders (R2) / Devices, More), camera-first layouts, offline indicator + sync badge (queue in 1.3.5), high-contrast toggle.
   - Admin: sidebar from `/v1/admin/me` entitlements, command palette, environment badge.
2. **i18n**: messages per zone and feature (`src/i18n/messages/{th,en}/{common,owner,staff,admin}/*.json`), ICU plurals, lint rule blocking hard-coded UI strings, glossary of rental/metering terms (th ↔ en) using the D-151 English terms (unit, party, invoice, service request…). The resident languages my/km/lo/zh are `getproperty-liff`'s.
3. **Domain presentation**: `src/domain/status/{lease,invoice,payment,deposit,reading,meterHealth,device,serviceRequest,workOrder,unit,subscription}.ts` typed against generated enums; `ReadingSourceBadge` (iot / ocr / manual / estimated with icons); `ComplianceNotice` rendering `legalRef`; next-action helpers that only interpret API-provided `nextActions`.
4. **Observability**: Sentry per zone, OpenTelemetry fetch instrumentation, Web Vitals RUM through the BFF, request id in error states.
5. **PWA base (staff)**: manifest for the staff host, service worker (Workbox) with app-shell caching, an **offline queue** for staff reading submissions (photo + value stored in IndexedDB, replayed with the original `Idempotency-Key`, conflict shown if the API rejects) — ADR-0007; web push subscription (VAPID) after a meaningful action.
6. **Realtime**: SSE client (ids only → TanStack invalidation) with per-zone channel auth; in-app notification centre in all zones.
7. **Marketing pages (owner host, `(marketing)`)**: landing (value proposition, loss calculator teaser reading public tariff data from the API), pricing (plans from `/v1/owner/plans/public`, D-156), legal pages (terms, privacy, PDPA notice, DPA) — content from `src/i18n`, SEO metadata, Organization JSON-LD; sitemap only for these pages.
8. **Quality gates**: Lighthouse CI URL sets per zone, axe in Playwright for every shell, Storybook visual snapshots for shells.
9. ADR-0004 implementation notes (the decision is already written), ADR-0005, ADR-0007; `docs/PROGRESS.md` entry. (ADR-0006 "LIFF-first tenant zone" is not written here — superseded by ADR-0008 and `getproperty-liff`.)
