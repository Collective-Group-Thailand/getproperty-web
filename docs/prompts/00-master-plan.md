# 00 — Master Plan (frontend): getproperty-web

> อ่านไฟล์นี้ก่อนทุก session แล้วค่อยเปิด prompt ของ deliverable ที่ได้รับมอบหมาย (F0–F2, F4–F5)
> Repo นี้คือ **frontend ของฝั่ง operator และ platform** — Next.js app เดียวที่รวม owner + staff + admin · backend อยู่ที่ repo `getproperty-api` · **แอปผู้อยู่อาศัย (LINE Mini App / LIFF) แยกเป็น repo `getproperty-liff`** (D-154)

---

## 1. Product
**getproperty — ให้เช่าง่าย อยู่สบาย**, operated by Collective Group (Thailand), is Collective Group's **Building Operations platform** (D-150): one core for four tenant types — `apartment` (the first customer, Phase 1: Thai apartment owners with 30–300 units, D-010), `condo_juristic`, `pm_company`, `landlord`. The product promise is zero-touch billing (D-011): readings arrive by IoT or a staff photo → the invoice is computed at the lawful tariff → the resident gets it in LINE with a Thai QR → the bank confirms → the receipt goes out. The operator's screen is a *morning dashboard*; the resident's screen (in `getproperty-liff`) is *a bill that is pleasant to pay* (D-100). This repo delivers the operator and platform interfaces; `getproperty-api` delivers every behaviour and all data. Business rules live in `docs/decisions.md`.

**Naming (D-151, binding in code, routes, docs and English copy)**: a **tenant** is the SaaS customer organisation (`tenant.type`), never "org". People who live in or own units are **parties**; the people who live there are **residents** (`occupancy.role` tenant / co-resident / owner), never "tenants". Assets: `property` (group of buildings) → `building` → `floor` → `unit` (room / condo_unit / house / shop / parking); `asset_item` (meters, locks, pumps…), `meter_assignment`. Billing: `billing_cycle`, `invoice` + `invoice_line` (source rent / meter / common_fee / fund / penalty / service / deposit), `rate_plan`, `payment`, `receipt` / `tax_invoice`. Service: `service_request` → `work_order`. Thai UI copy may keep the everyday words (ห้อง, ผู้เช่า, บิล).

## 2. Why one app with three zones (and the resident app outside it)
One Next.js app gives the operator and platform audiences one design system, one set of domain components (status badges, invoice card, reading card with photo, unit map, timeline) and one deployment, while zones keep audiences apart:

| Zone | Host (env) | Local dev | Audience / token | Upstream API prefix | Default theme | SEO |
|---|---|---|---|---|---|---|
| owner | `OWNER_HOST` (default host) | `localhost:3000` | `operator` (Owner, Manager, Accountant of a tenant) | `/v1/owner/*` | light | `noindex` except the public marketing pages under `(marketing)` |
| staff | `STAFF_HOST` | `staff.localhost:3000` | `operator` with the Staff role (also Owner/Manager on the go) | `/v1/staff/*` (+ `/v1/owner/me`) | light / high-contrast | `noindex`, installable PWA |
| admin | `ADMIN_HOST` | `admin.localhost:3000` | `platform` | `/v1/admin/*` | light | `noindex`, no sitemap |

**Resident and technician app — `getproperty-liff` (D-154)**: the LINE Mini App for residents (audience `resident`, `/v1/resident/*`: invoices & pay, service requests, lease & e-sign, move-out notice, usage, announcements, parcels, profile & consent) and, in R2, external technicians (audience `technician`, `/v1/technician/*`: my work orders) is a **separate repository** with its own deployment, so its bundle stays light inside the LINE in-app browser. It copies the `src/ui` tokens/components and `src/i18n` formatters it needs from this repo until `collective-shared` exists (D-155). Nothing in this repo serves a resident, links to a LIFF URL or exchanges a LINE id token.

- **Host-based zones, not path-based**: `src/proxy.ts` (Next 16) maps the request host to an internal route segment (`STAFF_HOST/x` → `/staff/x`, `ADMIN_HOST/x` → `/admin/x`; the owner host is the root with `[locale]`) and returns 404 for another zone's segment on the wrong host. Each zone has its own origin: cookies are host-only, CSP differs per zone, and a staff-page XSS cannot ride an admin session.
- **Separate root layouts** (no `src/app/layout.tsx`): `src/app/[locale]/layout.tsx` (owner + marketing), `src/app/staff/layout.tsx`, `src/app/admin/layout.tsx` — each with its own `<html>`, providers, theme, fonts subset and analytics.
- The same Docker image serves all three hosts; `ZONES` env can restrict which hosts an instance answers.

## 3. Repository structure (target, after F1)
```
getproperty-web/
├─ src/
│  ├─ proxy.ts                      host → zone rewrite, 404 cross-zone paths, next-intl (owner marketing), token refresh, CSP nonce, security headers
│  ├─ app/
│  │  ├─ [locale]/                  OWNER zone (root layout) — (marketing) landing, pricing, legal · (console) dashboard buildings/ units/ parties/ leases/ deposits/ billing/ invoices/ payments/ arrears/ meters/ loss/ devices/ service-requests/ (R2) reports/ settings/ subscription/
│  │  ├─ staff/                     STAFF zone (root layout, PWA) — today readings/ inspections/ devices/ work-orders/ (R2) parcels/ (R2)
│  │  ├─ admin/                     ADMIN zone (root layout) — (auth)/login (console)/ tenants subscriptions tariffs devices ota support privacy audit settings
│  │  ├─ bff/[...path]/route.ts     owner BFF → /v1/owner/*   (staff/bff, admin/bff are the zone equivalents)
│  │  ├─ robots.ts sitemap.ts       owner host marketing pages only
│  │  └─ global-error.tsx
│  ├─ features/
│  │  ├─ shared/<domain>/           used by more than one zone (invoice card, reading card, unit status, timeline, document viewer, file upload)
│  │  ├─ owner/<domain>/            dashboard, buildings, units, parties, leases, billing, payments, meters, loss, service requests, settings…
│  │  ├─ staff/<domain>/            today, readings (camera + OCR), inspections, provisioning (QR scan), work orders…
│  │  └─ admin/<domain>/            tenants, tariffs, fleet, support…
│  ├─ ui/                           design system: tokens (TS → generated CSS), Tailwind v4 theme, components, patterns, icons, charts, fonts — copied by getproperty-liff (D-155)
│  ├─ domain/                       status presentation keyed by generated API enums; client-side form schemas (zod)
│  ├─ i18n/                         next-intl config, messages/{th,en}/*.json, formatters (formatTHB, formatUnits, Buddhist-era dates)
│  └─ lib/
│     ├─ api/                       schema.d.ts (generated), clients (server: API_INTERNAL_URL; browser: zone /bff), query keys, error mapping (incl. compliance problems)
│     ├─ auth/                      session cookies, login/logout server actions, refresh, current actor, tenant switcher
│     ├─ bff/                       createBffHandler(zone)
│     ├─ pwa/                       service worker registration, offline queue for staff readings
│     ├─ zones/                     host → zone mapping
│     └─ observability/             Sentry, OpenTelemetry, web-vitals
├─ .storybook/  e2e/  mocks/ (MSW handlers generated from the contract + overrides)
├─ docs/  prompts/ contract/ adr/ PROGRESS.md contract-requests.md performance-budgets.md
├─ contract.lock.json
└─ Dockerfile (standalone)  .github/workflows/ci.yml
```
Import rules (ESLint `getproperty/zone-boundaries`): a zone's `app/*` and `features/<zone>/**` may not import another zone's `features/**`; everything may import `ui`, `features/shared`, `domain`, `i18n`, `lib`; a `tenant` or `resident` zone segment (files or imports) is refused anywhere in `src/` (D-151, D-154).

## 4. Data access & auth (BFF pattern — ADR-0004)
- **Server Components** fetch with `serverApi(zone)` (openapi-fetch, `API_INTERNAL_URL`, `Authorization: Bearer <access token from the zone cookie>`, `Accept-Language`, `X-Tenant-Id` from the `__Host-gp_tenant` cookie when the user belongs to several tenants). Lists render initial data on the server and hydrate TanStack Query.
- **Client Components** use `browserApi` (same generated types, base URL `/bff`) + TanStack Query. The zone BFF allow-lists upstream prefixes (owner → `/v1/owner`, `/v1/auth/operator`; staff → `/v1/staff`, `/v1/owner/me`, `/v1/auth/operator`; admin → `/v1/admin`, `/v1/auth/platform`; `/v1/resident/*` and `/v1/technician/*` are never reachable from this app — they belong to `getproperty-liff`'s BFF), attaches the token, streams the response back (PDF downloads, SSE), refreshes once on `401`, and requires same-origin `Origin` + header `x-getproperty-csrf: 1` for non-GET requests.
- **Cookies** (host-only, `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` prefix): `__Host-gp_at` / `__Host-gp_rt` per host, `__Host-gp_tenant` (current tenant id, owner/staff hosts). Access-token refresh happens in `proxy.ts` before rendering and in the BFF.
- **Login flows** (audience `operator` for owner + staff, `platform` for admin): owner phone OTP (primary) / email + password + TOTP, then a tenant switcher when the user belongs to several tenants; staff same as owner (OTP) with an optional device PIN re-lock; admin email + password + TOTP. Resident LIFF login (LINE id token → `/v1/auth/resident/line`) lives in `getproperty-liff`.
- **Authorisation in the UI** reads `/v1/{owner|staff|admin}/me` (roles, permissions, menu entitlements, scopes, subscription state). The UI hides what the user cannot do; the API is the enforcement point. Suspended subscription (D-082) → read-only banner and disabled mutations, driven by `me.subscription.state`.
- **Server Actions** only for auth and small forms; business mutations go through the BFF so errors, idempotency keys and optimistic updates are handled uniformly.
- Realtime via the API's SSE auth; payloads are ids only → invalidate TanStack Query keys (owner dashboard, staff reading round, invoice detail).

## 5. Contract sync with `getproperty-api` (ADR-0005)
- `pnpm gen:api` reads `API_CONTRACT_SOURCE` (local: `../getproperty-api/contract/openapi.json`; CI: the release asset pinned in `contract.lock.json`) → `openapi-typescript` → `src/lib/api/schema.d.ts` (committed) → regenerates MSW base handlers in `mocks/generated/` from the contract examples.
- CI fails if the generated file differs from the committed one. `src/domain/status/*` is typed `Record<Schemas['InvoiceStatus'], StatusMeta>` etc., so a new backend enum value fails the build until it has a label, tone and icon.
- Missing endpoints → `docs/contract-requests.md` + mock; never invent a shape.

## 6. Platform baseline
Next.js 16 (App Router, RSC, `proxy.ts`), React 19, TypeScript strict (5.9 until 6 is the stable Next toolchain), Tailwind v4, pnpm, Node 24 LTS. `src/ui` built on Radix + CVA (ADR-0002), Storybook 10, TanStack Query/Table/Virtual, react-hook-form + zod, next-intl, Zustand (UI state only), Recharts (usage charts), Vitest + Testing Library, Playwright (+ axe), Lighthouse CI, MSW, Workbox (staff PWA offline queue). Sentry, OpenTelemetry, Web Vitals RUM → API. Same tooling and CI shape as `getpack-web`; `getproperty-liff` uses the same stack (plus `@line/liff`).

## 7. Release scope & run order (frontend)
**R1** (D-014): owner console (dashboard, buildings/units, parties/leases/deposits, billing cycles/invoices, payments/arrears, meters/loss, settings, subscription), staff PWA (today, readings with camera/OCR, inspections, provisioning), admin (tenants, subscriptions, tariffs, fleet, support, audit). **R2**: service requests & work orders (owner triage, staff work orders), locks, parcels/announcements (operator side), e-Tax, TM30, energy insight. **R3**: vacancy listing, booking, insurance. The resident app's R1/R2 scope (home, invoices & pay, receipts, usage, lease & e-sign, notice, privacy; R2 service requests, announcements, parcels, technician work orders, my/km/lo/zh) is planned in `getproperty-liff` (`docs/prompts/L0`–`L4`).

| Step | Prompt | Output | Needs from backend |
|---|---|---|---|
| F0 | `F0-setup.md` 0.1 → 0.2 | fresh Next.js 16 app in the target structure, tooling, CI; `src/ui` foundation + brand tokens (done; the resident zone it created was removed by D-154) | nothing |
| F1 | `F1-foundation.md` 1.1 → 1.3 | three zones, proxy, root layouts, BFF & auth (OTP, TOTP, tenant switcher), contract & mocks, i18n, shells, staff PWA base, observability | B1.1 contract (mocks until then) |
| F2 | `F2-owner-console.md` 2.1 → 2.6 (R2: 2.7) | owner zone | B2–B4, B6.1 (2.7: B5.1–B5.3) |
| F3 | — moved to `getproperty-liff` (D-154); see `docs/prompts/README.md` | — | — |
| F4 | `F4-staff-pwa.md` 4.1 → 4.3 (R2: 4.4) | staff PWA (offline-tolerant readings, camera, QR provisioning; R2 tasks, work orders, parcels) | B2.4, B3.1, B3.3 (4.4: B5.1–B5.4) |
| F5 | `F5-admin.md` 5.1 → 5.3 | platform admin zone | B1.3, B3.1, B6.1, B6.4 |
F2, F4 and F5 run in parallel in separate git worktrees after F1, against MSW mocks until the backend deliverable exists. The resident app (`getproperty-liff`, L0–L4) runs in parallel in its own repository.

## 8. Definition of Done (every screen/flow)
- Lint, typecheck, unit/component, e2e green; axe clean (WCAG 2.2 AA); keyboard path works; performance budgets met (Lighthouse CI).
- Runs against the real backend in the integration environment; no `CONTRACT-REQUEST` mock left for that screen.
- Thai + English strings, no hard-coded copy; statuses via `src/domain/status`; compliance problems rendered with `legalRef`.
- Irreversible actions (issue invoices, void invoice, record manual payment, approve slip, refund, deposit refund, terminate lease, revoke access, bank-account change, cancel subscription) use typed confirmation dialogs that restate the target (unit code + amount) and send an `Idempotency-Key`.
- `docs/PROGRESS.md` updated: screens done, decisions implemented (D-###), deviations, contract requests raised.

## 9. ADRs in this repo
0001 Thai-first typography · 0002 Component base (Radix + Tailwind v4 + CVA) · 0003 Theming via generated CSS variables · 0004 One app, three host-based zones + BFF/cookies (written ahead of F1 and amended for D-154; F1 adds the implementation notes) · 0005 Contract consumption & mocks · 0006 ~~LIFF-first tenant zone~~ — not written here: superseded by ADR-0008 and `getproperty-liff`'s ADR-0004 "LIFF-first single-zone app" · 0007 Staff PWA offline queue · 0008 Resident app in a separate repository (D-154). F0 wrote 0001–0003; 0004 and 0008 were written with the D-154 change; F1 writes 0005 and 0007.
