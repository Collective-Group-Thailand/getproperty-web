# 00 — Master Plan (frontend): getproperty-web

> อ่านไฟล์นี้ก่อนทุก session แล้วค่อยเปิด prompt ของ deliverable ที่ได้รับมอบหมาย (F0–F5)
> Repo นี้คือ **frontend อย่างเดียว** — Next.js app เดียวที่รวม owner + tenant + staff + admin · backend อยู่ที่ repo `getproperty-api`

---

## 1. Product
**getproperty — บิลทำเอง เก็บเงินเอง ถูกกฎหมาย**, operated by Collective Group (Thailand), is a multi-tenant SaaS for Thai apartment owners (30–300 rooms, D-010). The product promise is zero-touch billing (D-011): readings arrive by IoT or a staff photo → the bill is computed at the lawful tariff → the tenant gets it in LINE with a Thai QR → the bank confirms → the receipt goes out. The owner's screen is a *morning dashboard*; the tenant's screen is *a bill that is pleasant to pay* (D-100). This repo delivers every user interface; `getproperty-api` delivers every behaviour and all data. Business rules live in `docs/decisions.md`.

## 2. Why one app with four zones
One Next.js app gives one design system, one set of domain components (status badges, bill card, reading card with photo, room map, timeline) and one deployment, while zones keep audiences apart:

| Zone | Host (env) | Local dev | Audience / token | Upstream API prefix | Default theme | SEO |
|---|---|---|---|---|---|---|
| owner | `OWNER_HOST` | `localhost:3000` | `org` (Owner, Manager, Accountant) | `/v1/owner/*` | light | `noindex` except the public marketing pages under `(marketing)` |
| tenant | `TENANT_HOST` | `tenant.localhost:3000` | `tenant` (LIFF or magic link) | `/v1/tenant/*` | system | `noindex`; LIFF endpoint URL |
| staff | `STAFF_HOST` | `staff.localhost:3000` | `org` with the Staff role (also Owner/Manager on the go) | `/v1/staff/*` (+ `/v1/owner/me`) | light / high-contrast | `noindex`, installable PWA |
| admin | `ADMIN_HOST` | `admin.localhost:3000` | `platform` | `/v1/admin/*` | light | `noindex`, no sitemap |

- **Host-based zones, not path-based**: `src/proxy.ts` (Next 16) maps the request host to an internal route segment (`TENANT_HOST/x` → `/tenant/x`, `STAFF_HOST/x` → `/staff/x`, `ADMIN_HOST/x` → `/admin/x`) and returns 404 for another zone's segment on the wrong host. Each zone has its own origin: cookies are host-only, CSP differs per zone, and a tenant-page XSS cannot ride an owner session.
- **Separate root layouts** (no `src/app/layout.tsx`): `src/app/[locale]/layout.tsx` (owner + marketing), `src/app/tenant/layout.tsx`, `src/app/staff/layout.tsx`, `src/app/admin/layout.tsx` — each with its own `<html>`, providers, theme, fonts subset and analytics.
- The same Docker image serves all hosts; `ZONES` env can restrict which hosts an instance answers.

## 3. Repository structure (target, after F0)
```
getproperty-web/
├─ src/
│  ├─ proxy.ts                      host → zone rewrite, 404 cross-zone paths, next-intl (owner marketing), token refresh, CSP nonce, security headers
│  ├─ app/
│  │  ├─ [locale]/                  OWNER zone (root layout) — (marketing) landing, pricing, legal · (console) dashboard properties/ rooms/ leases/ deposits/ billing/ bills/ payments/ arrears/ meters/ loss/ devices/ reports/ settings/ subscription/
│  │  ├─ tenant/                    TENANT zone (root layout) — liff/ (LIFF entry + account linking) home bills/[id] pay receipts usage repairs announcements parcels lease deposit notice profile privacy
│  │  ├─ staff/                     STAFF zone (root layout, PWA) — today readings/ inspections/ devices/ tickets/ parcels/
│  │  ├─ admin/                     ADMIN zone (root layout) — (auth)/login (console)/ orgs subscriptions tariffs devices ota support privacy audit settings
│  │  ├─ bff/[...path]/route.ts     owner BFF → /v1/owner/*   (tenant/bff, staff/bff, admin/bff are the zone equivalents)
│  │  ├─ robots.ts sitemap.ts       owner host marketing pages only
│  │  └─ global-error.tsx
│  ├─ features/
│  │  ├─ shared/<domain>/           used by more than one zone (bill card, reading card, room status, timeline, document viewer, file upload, QR pay sheet)
│  │  ├─ owner/<domain>/            dashboard, properties, leases, billing, payments, meters, loss, settings…
│  │  ├─ tenant/<domain>/           home, bills, pay, usage, repairs, lease…
│  │  ├─ staff/<domain>/            today, readings (camera + OCR), inspections, provisioning (QR scan), tickets…
│  │  └─ admin/<domain>/            orgs, tariffs, fleet, support…
│  ├─ ui/                           design system: tokens (TS → generated CSS), Tailwind v4 theme, components, patterns, icons, charts, fonts
│  ├─ domain/                       status presentation keyed by generated API enums; client-side form schemas (zod)
│  ├─ i18n/                         next-intl config, messages/{th,en,(my,km,lo,zh)}/*.json, formatters (formatTHB, formatUnits, Buddhist-era dates)
│  └─ lib/
│     ├─ api/                       schema.d.ts (generated), clients (server: API_INTERNAL_URL; browser: zone /bff), query keys, error mapping (incl. compliance problems)
│     ├─ auth/                      session cookies, login/logout server actions, refresh, current actor, LIFF exchange
│     ├─ bff/                       createBffHandler(zone)
│     ├─ liff/                      LIFF init, id-token exchange, LINE share helpers
│     ├─ pwa/                       service worker registration, offline queue for staff readings
│     └─ observability/             Sentry, OpenTelemetry, web-vitals
├─ .storybook/  e2e/  mocks/ (MSW handlers generated from the contract + overrides)
├─ docs/  prompts/ contract/ adr/ PROGRESS.md contract-requests.md performance-budgets.md
├─ contract.lock.json
└─ Dockerfile (standalone)  .github/workflows/ci.yml
```
Import rules (ESLint boundaries): a zone's `app/*` and `features/<zone>/**` may not import another zone's `features/**`; everything may import `ui`, `features/shared`, `domain`, `i18n`, `lib`.

## 4. Data access & auth (BFF pattern — ADR-0004)
- **Server Components** fetch with `serverApi(zone)` (openapi-fetch, `API_INTERNAL_URL`, `Authorization: Bearer <access token from the zone cookie>`, `Accept-Language`, `X-Org-Id` from the org cookie when the user has several orgs). Lists render initial data on the server and hydrate TanStack Query.
- **Client Components** use `browserApi` (same generated types, base URL `/bff`) + TanStack Query. The zone BFF allow-lists upstream prefixes (owner → `/v1/owner`, `/v1/auth/org`; tenant → `/v1/tenant`, `/v1/auth/tenant`; staff → `/v1/staff`, `/v1/owner/me`; admin → `/v1/admin`, `/v1/auth/platform`), attaches the token, streams the response back (PDF downloads, SSE), refreshes once on `401`, and requires same-origin `Origin` + header `x-getproperty-csrf: 1` for non-GET requests.
- **Cookies** (host-only, `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` prefix): `__Host-gp_at` / `__Host-gp_rt` per host, `__Host-gp_org` (current org id, owner/staff hosts). Access-token refresh happens in `proxy.ts` before rendering and in the BFF.
- **Login flows**: owner phone OTP (primary) / email + password + TOTP; tenant **LIFF** (LINE id token → `POST /v1/auth/tenant/line` via the tenant BFF → cookies) or SMS magic link; staff same as owner (OTP) with an optional device PIN re-lock; admin email + password + TOTP.
- **Authorisation in the UI** reads `/v1/{surface}/me` (roles, permissions, menu entitlements, scopes, subscription state). The UI hides what the user cannot do; the API is the enforcement point. Suspended subscription (D-082) → read-only banner and disabled mutations, driven by `me.subscription.state`.
- **Server Actions** only for auth and small forms; business mutations go through the BFF so errors, idempotency keys and optimistic updates are handled uniformly.
- Realtime via the API's SSE auth; payloads are ids only → invalidate TanStack Query keys (owner dashboard, staff reading round, tenant bill).

## 5. Contract sync with `getproperty-api` (ADR-0005)
- `pnpm gen:api` reads `API_CONTRACT_SOURCE` (local: `../getproperty-api/contract/openapi.json`; CI: the release asset pinned in `contract.lock.json`) → `openapi-typescript` → `src/lib/api/schema.d.ts` (committed) → regenerates MSW base handlers in `mocks/generated/` from the contract examples.
- CI fails if the generated file differs from the committed one. `src/domain/status/*` is typed `Record<Schemas['BillStatus'], StatusMeta>` etc., so a new backend enum value fails the build until it has a label, tone and icon.
- Missing endpoints → `docs/contract-requests.md` + mock; never invent a shape.

## 6. Platform baseline
Next.js 16 (App Router, RSC, `proxy.ts`), React 19, TypeScript 6 strict, Tailwind v4, pnpm, Node 24 LTS. `src/ui` built on Radix + CVA (ADR-0002), Storybook 10, TanStack Query/Table/Virtual, react-hook-form + zod, next-intl, Zustand (UI state only), `@line/liff`, Recharts (usage charts), Vitest + Testing Library, Playwright (+ axe), Lighthouse CI, MSW, Workbox (staff PWA offline queue). Sentry, OpenTelemetry, Web Vitals RUM → API. Same tooling and CI shape as `getpack-web`.

## 7. Release scope & run order (frontend)
**R1** (D-014): owner console (dashboard, properties/rooms, leases/deposits, billing cycles/bills, payments/arrears, meters/loss, settings, subscription), tenant LIFF (home, bills, pay, receipts, usage, lease, notice, privacy), staff PWA (today, readings with camera/OCR, inspections, provisioning), admin (orgs, subscriptions, tariffs, fleet, support, audit). **R2**: repairs, locks, parcels/announcements, e-Tax, TM30, 4 extra tenant languages, energy insight. **R3**: vacancy listing, booking, insurance.

| Step | Prompt | Output | Needs from backend |
|---|---|---|---|
| F0 | `F0-setup.md` 0.1 → 0.2 | fresh Next.js 16 app in the target structure, tooling, CI; `src/ui` foundation + brand tokens | nothing |
| F1 | `F1-foundation.md` 1.1 → 1.3 | zones, proxy, root layouts, BFF & auth (OTP, LIFF, TOTP), contract & mocks, i18n, shells, PWA base, observability | B1.1 contract (mocks until then) |
| F2 | `F2-owner-console.md` 2.1 → 2.6 | owner zone | B2–B4, B6.1 |
| F3 | `F3-tenant-liff.md` 3.1 → 3.4 | tenant zone (LIFF + mobile web) | B2–B4 |
| F4 | `F4-staff-pwa.md` 4.1 → 4.3 | staff PWA (offline-tolerant readings, camera, QR provisioning) | B2.4, B3.1, B3.3 |
| F5 | `F5-admin.md` 5.1 → 5.3 | platform admin zone | B1.3, B3.1, B6.1, B6.4 |
F2–F5 run in parallel in separate git worktrees after F1, against MSW mocks until the backend deliverable exists.

## 8. Definition of Done (every screen/flow)
- Lint, typecheck, unit/component, e2e green; axe clean (WCAG 2.2 AA); keyboard path works; performance budgets met (Lighthouse CI).
- Runs against the real backend in the integration environment; no `CONTRACT-REQUEST` mock left for that screen.
- Thai + English strings, no hard-coded copy; statuses via `src/domain/status`; compliance problems rendered with `legalRef`.
- Irreversible actions (issue bills, void bill, record manual payment, approve slip, refund, deposit refund, terminate lease, revoke access, bank-account change, cancel subscription) use typed confirmation dialogs that restate the target (room code + amount) and send an `Idempotency-Key`.
- `docs/PROGRESS.md` updated: screens done, decisions implemented (D-###), deviations, contract requests raised.

## 9. ADRs in this repo
0001 Thai-first typography · 0002 Component base (Radix + Tailwind v4 + CVA) · 0003 Theming via generated CSS variables · 0004 One app, four host-based zones + BFF/cookies · 0005 Contract consumption & mocks · 0006 LIFF-first tenant zone · 0007 Staff PWA offline queue. F0 writes 0001–0003; F1 writes 0004–0007.
