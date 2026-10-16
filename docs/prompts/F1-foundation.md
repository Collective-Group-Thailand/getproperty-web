# F1 — Foundation: zones, proxy, BFF & auth, contract & mocks, i18n, shells, PWA base

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F0 เสร็จแล้ว
> ทำทีละ Deliverable ต่อ 1 session (1.1 → 1.3)

---

You are a senior frontend engineer on **`getproperty-web`**. Build the skeleton that every screen depends on. No business screens yet.

## Deliverable 1.1 — Zones, proxy, root layouts, security headers
1. Env schema (zod, validated at boot, server/client split): `OWNER_HOST`, `TENANT_HOST`, `STAFF_HOST`, `ADMIN_HOST`, `API_INTERNAL_URL`, `API_CONTRACT_SOURCE`, `NEXT_PUBLIC_ASSET_BASE_URL`, `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_LINE_OA_ID`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `SENTRY_*`, `ZONES`, `NEXT_PUBLIC_ENV_BADGE`.
2. `src/proxy.ts`: resolve zone from `Host` (with `*.localhost`); rewrite tenant/staff/admin hosts to their segments; 404 another zone's segment and `/bff/*` on the wrong host; next-intl on the owner host (`th` default no prefix, `en` at `/en`); per-zone CSP with nonce (tenant CSP allows LIFF SDK + LINE domains; staff allows camera; admin strictest), `X-Robots-Tag: noindex` on every non-marketing route, HSTS, `Referrer-Policy`, `Permissions-Policy` (camera on staff + tenant only); access-token refresh before rendering.
3. Four root layouts with zone providers (theme cookie `gp_theme`, next-intl, TanStack Query, toasts), fonts from `src/ui/fonts`, error boundaries per segment, `not-found`, `global-error`. Tenant/staff/admin locale from a cookie (th default), tenant locale also settable from `/v1/tenant/me.language`.
4. ESLint zone boundaries with a failing fixture test.
5. Tests: unit tests for host → zone resolution; Playwright: each host renders its shell; `/tenant` on the owner host → 404; admin responses carry `noindex`.

## Deliverable 1.2 — Contract, API clients, BFF, auth, LIFF
1. `pnpm gen:api` (reads `API_CONTRACT_SOURCE`, verifies sha256 from `contract.lock.json`, `openapi-typescript` → `src/lib/api/schema.d.ts`, MSW base handlers into `mocks/generated/` from contract examples; error-path handlers from documented problem codes incl. `compliance.*`); CI contract-drift job. If the backend contract is not ready, bootstrap with a hand-written seed contract in `mocks/seed-openapi.json` (auth + `me` endpoints per contract §4), clearly marked.
2. `serverApi(zone)` and `browserApi` (openapi-fetch) with `Accept-Language`, `X-Org-Id`, request id, problem-details → typed `ApiError` (`code`, `detail`, `legalRef`, field `errors` mapped onto react-hook-form), automatic `Idempotency-Key` for flagged operations, `If-Match` support, query-key factory, TanStack Query defaults; `SubscriptionSuspendedError` handling (read-only banner).
3. `createBffHandler(zone)` for the four BFF routes: upstream allow-list per §4, token attach, refresh-once on `401`, cookie rotation, streaming passthrough (PDF, SSE), same-origin + `x-getproperty-csrf` check on non-GET, body size limit (slip and meter photos go to S3 by presign, not through the BFF), no caching of authenticated responses.
4. Auth: owner sign-in (phone OTP primary; email + password + TOTP), org switcher (sets `__Host-gp_org`); **tenant LIFF** flow (`src/lib/liff`: `liff.init`, `liff.login` if needed, id token → tenant BFF `POST /auth/line` → cookies; mobile-web fallback: SMS magic link page); staff sign-in (OTP) + optional device PIN re-lock after inactivity; admin sign-in (email + password + TOTP); logout everywhere; `getActor(zone)` reading `/v1/{surface}/me` (cached per request); route guards in layouts.
5. Tests: Vitest for BFF (allow-list, CSRF, refresh-once, cookie flags); Playwright on MSW: owner OTP login → dashboard shell shows org name + role; LIFF login (mocked `liff` object) → tenant home; an owner cookie never authenticates on the admin host; suspended subscription renders the read-only banner.

## Deliverable 1.3 — Shells, i18n, domain presentation, PWA base, observability, quality gates
1. **Shells** from `src/ui` AppShell:
   - Owner: collapsible sidebar built from **menu entitlements in `/v1/owner/me`**, topbar (property switcher, global search, notification centre, language, environment badge, user menu), breadcrumbs; mobile: bottom nav (Today, Rooms, Bills, Money, More).
   - Tenant (LIFF): header with room code + building name, bottom nav (Home, Bills, Usage, Repairs (R2), Me); LINE-native feel (full-bleed cards, 16 px gutters, large tap targets); works inside LIFF and as a standalone mobile web page.
   - Staff (PWA): big-target bottom nav (Today, Readings, Inspect, Devices, More), camera-first layouts, offline indicator + sync badge (queue in 1.3.5), high-contrast toggle.
   - Admin: sidebar from `/v1/admin/me` entitlements, command palette, environment badge.
2. **i18n**: messages per zone and feature (`src/i18n/messages/{th,en}/{common,owner,tenant,staff,admin}/*.json`), ICU plurals, lint rule blocking hard-coded UI strings, glossary of rental/metering terms (th ↔ en), tenant-language scaffolding for my/km/lo/zh (empty files, fallback to en).
3. **Domain presentation**: `src/domain/status/{lease,bill,payment,deposit,reading,meterHealth,device,ticket,subscription}.ts` typed against generated enums; `ReadingSourceBadge` (iot / ocr / manual / estimated with icons); `ComplianceNotice` rendering `legalRef`; next-action helpers that only interpret API-provided `nextActions`.
4. **Observability**: Sentry per zone, OpenTelemetry fetch instrumentation, Web Vitals RUM through the BFF, request id in error states.
5. **PWA base (staff, tenant)**: manifest per host, service worker (Workbox) with app-shell caching, an **offline queue** for staff reading submissions (photo + value stored in IndexedDB, replayed with the original `Idempotency-Key`, conflict shown if the API rejects) — ADR-0007; web push subscription (VAPID) after a meaningful action.
6. **Realtime**: SSE client (ids only → TanStack invalidation) with per-zone channel auth; in-app notification centre in all zones.
7. **Marketing pages (owner host, `(marketing)`)**: landing (value proposition, loss calculator teaser reading public tariff data from the API), pricing (plans from `/v1/owner/plans/public`), legal pages (terms, privacy, PDPA notice, DPA) — content from `src/i18n`, SEO metadata, Organization JSON-LD; sitemap only for these pages.
8. **Quality gates**: Lighthouse CI URL sets per zone, axe in Playwright for every shell, Storybook visual snapshots for shells.
9. ADR-0004…0007; `docs/PROGRESS.md` entry.
