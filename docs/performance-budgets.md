# Performance budgets (design-system.md §7, D-179)

Enforced with Lighthouse CI (`pnpm lhci`, configs in `lighthouse/`) and, from F1, Web Vitals RUM posted
through the BFF. On a shared CI runner LCP/INP/CLS are **warnings** (a lab run is not a p75); the initial
JS size and the accessibility score are **errors** — the JS budgets below are **hard limits**, not
ratchets (D-179, 2026-10-17).

| Route type | LCP (p75) | INP (p75) | CLS | JS shipped (gz, initial) | Lighthouse set |
|---|---|---|---|---|---|
| Marketing (owner host) | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 180 KB | `owner-marketing` |
| Owner dashboard / list / detail | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 260 KB | `owner` |
| Owner workspaces (cycle review, room map) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 260 KB (D-179; measured in the `owner` set) | `owner` |
| Staff PWA | ≤ 2.5 s on 4G mid-range; instant from cache offline | ≤ 200 ms | ≤ 0.1 | ≤ 200 KB | `staff` |
| Admin | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 260 KB | `admin` |

`resource-summary:script:size` is asserted as the budget in bytes (180 KB → 184 320; 200 KB → 204 800;
260 KB → 266 240). Lighthouse measures transferred bytes; with compression on the server that is the gz
figure. `pnpm lhci` prints the measured size of every URL after each set (`initial JS [set] url: a–b KB`).

The resident LIFF budget (LCP ≤ 2.0 s on 4G mid-range, CLS ≤ 0.05, ≤ 180 KB per D-179) lives with the
resident app in `getproperty-liff` (D-154).

## Why these numbers (D-179)

React 19 + the Next 16 App Router runtime alone are ≈ 138 KB gz on every page (react-dom 72.7, the
router 31.7, the rest of Next's client 28.5, Turbopack's runtime 4.4) — the old 120 KB marketing and
180 KB staff targets were below or barely above that floor. D-179 re-based the budgets on it and made
them hard limits once the reductions below landed.

## Measured (2026-10-17, transferred script bytes, Lighthouse `resource-summary` = the CDP measurement)

| Set | URL | Before (F1 1.3) | After (D-179 work) | Budget | Headroom |
|---|---|---|---|---|---|
| `owner-marketing` | `/`, `/en` | 194.2 KB | 169.5 KB | 180 KB | 10.5 KB |
| `owner-marketing` | `/pricing` | 184.7 KB | 167.5 KB | 180 KB | 12.5 KB |
| `owner` | `/dashboard` (signed in) | 261.2 KB | 181.7 KB | 260 KB | 78.3 KB |
| `staff` | `/` (signed in, mobile) | 265.2 KB | 187.3 KB | 200 KB | 12.7 KB |
| `admin` | `/` (signed in) | 258.0 KB | 180.0 KB | 260 KB | 80.0 KB |
| (not a set) | owner `/login` | 248.1 KB | 186.6 KB | — | — |
| (not a set) | staff `/login` | 240.0 KB | 181.7 KB | — | — |
| (not a set) | owner 404 page | 175.7 KB | 156.2 KB | — | — |

Lighthouse reported the same figures (±0.2 KB; e.g. staff 187.3 KB in all three runs); accessibility 1.0 on every
page of every set.

## Owner console after F2 2.1–2.5 (2026-10-17, `pnpm lhci owner`, desktop preset, signed in as the owner persona)

| URL | Initial JS | Budget | Headroom | What loads later (on first use) |
|---|---|---|---|---|
| `/dashboard` | 183.7 KB | 260 KB | 76.3 KB | — |
| `/units?building=` (board, 8 units) | 215.6 KB | 260 KB | 44.4 KB | unit drawer, status dialog |
| `/units?building=` (board, 300 units, virtualised) | 215.6 KB | 260 KB | 44.4 KB | unit drawer |
| `/leases/new` (wizard) | 225.7 KB | 260 KB | 34.3 KB | date picker popover, dialogs, PDF viewer |
| `/leases/[id]` | 220.3 KB | 260 KB | 39.7 KB | signature pad dialog, PDF viewer |
| `/deposits/[id]` (settlement) | 193.3 KB | 260 KB | 66.7 KB | photo viewer, deduction / refund dialogs |
| `/billing` (cycle workspace) | 198.6 KB | 260 KB | 61.4 KB | draft lines, charge dialog, issue confirmation |
| `/invoices` | 186.0 KB | 260 KB | 74.0 KB | — |
| `/invoices/[id]` | 200.9 KB | 260 KB | 59.1 KB | note wizard, PDF viewer |
| `/payments/slips` | 190.5 KB | 260 KB | 69.5 KB | zoomable slip viewer, decision dialogs |
| `/arrears` | 188.5 KB | 260 KB | 71.5 KB | — |
| `/meters/[id]` (series chart) | 189.3 KB | 260 KB | 70.7 KB | — (the chart is server SVG) |
| `/loss` | 220.0 KB | 260 KB | 40.0 KB | bill entry dialog with date pickers |

Every URL within the 260 KB hard limit (D-179); accessibility 1.0 asserted on each. The F2 screens stay
lean because charts are server-rendered SVG with a `<details>` table (no chart library), the PDF viewer
is the browser's own (a `blob:` URL in an iframe, loaded with the dialog), overlays are the lazy
`@/ui/components/overlays` versions, the board virtualises floors with `@tanstack/react-virtual`
(≈ 4 KB), and the image viewer is a `lazyWarm` chunk. The heaviest page is the lease wizard (one client
component with every step); split it per step first if it gets close to the limit.

## Staff PWA after F4 (2026-10-17, `pnpm lhci staff`, mobile preset, signed in as the staff persona)

| URL | Initial JS | Budget | Headroom | What loads later (on first use) |
|---|---|---|---|---|
| `/` (Today) | 190.2 KB | 200 KB | 9.8 KB | — |
| `/readings` (round) | 197.2 KB | 200 KB | 2.8 KB | capture flow (camera, compression, keypad, API client) |
| `/inspections` | 189.0 KB | 200 KB | 11.0 KB | — |
| `/inspections/[id]` (checklist) | 197.4 KB | 200 KB | 2.6 KB | camera, keypad, completion with signature pads |
| `/devices` | 190.2 KB | 200 KB | 9.8 KB | — |
| `/devices/install` (wizard) | 195.6 KB | 200 KB | 4.4 KB | scanner panel, camera, keypad, identify button |

Accessibility 1.0 on every URL. What keeps the screens in budget: the capture flow, the camera, the
keypad (where it is not the first thing on screen), the scanner and the signature pads are `lazyWarm`
chunks (warmed on the first tap, cached by the service worker for offline use); staff status badges come
from one status map each (`StatusBadgeOf`) instead of every domain's glyphs (`DomainStatusBadge`); the
round list's evidence thumbnails use a plain typed `fetch` instead of the API client. The thin headroom on
the round and the checklist is where the next staff feature must look first (`pnpm analyze`). LCP is a
warning-level lab figure here (2.1–3.5 s simulated on a runner shared with other builds); Web Vitals RUM
is the real signal.

## What made the difference

Measured step by step on the same pages (savings are the measured deltas of each step):

| Change | Where | Saved (gz) |
|---|---|---|
| **Per-icon glyph modules.** `src/ui/icons/curated.ts` (our name → Lucide shape) is turned by `pnpm icons` into one plain-data module per icon, `src/ui/icons/glyphs/<name>.ts` (`IconCheck = { name, node }`), drawn by `<Icon icon={IconCheck}>`. A page ships only the glyphs its client components draw (one module per icon because the bundler chunks by module — a shared multi-icon module would still ship every icon any client component uses); a glyph is data, so a server component can hand one to a client component. The by-name registry (`registry.ts`) is for Storybook and tests only; ESLint refuses it and `lucide-react` (now a dev dependency) in app code; `pnpm icons:check` runs in CI. | every page | ≈ 8 KB (marketing 194.2 → 186.6) |
| **Precompiled messages.** next-intl's `experimental.messages.precompile` compiles every catalog under `src/i18n/messages` to an ICU AST at build time and aliases the client formatter to the format-only runtime: no `intl-messageformat` / ICU parser in any bundle. The JSON files stay the source; tests and Storybook read them as written. (The legal page reads its sections with `t.has`/`t` instead of `t.raw`, which returns compiled values now.) | every page | ≈ 11 KB (186.6 → 175.7) |
| **Error pages without the icon set.** `error.tsx` (ZoneError) draws `ErrorState` + a retry `Button`: three glyphs (alert, refresh, spinner) instead of the registry. | every page (the error boundary is in every page's tree) | part of the icon step |
| **Overlays and toasts on first use.** `@/ui/components/overlays` (`LazySheet`, `LazyDialog`, `LazyAlertDialog`, `LazyDropdownMenu`, `LazyPopover`) render nothing — or just the trigger with its ARIA state — until first opened, then load the Radix component; chunks are warmed on the first pointer/key interaction, so menus open without a wait and the staff service worker caches them for offline use. ESLint keeps zones on the lazy versions. The toast viewport (sonner) loads with the first `toast(…)`; tooltips bring their own provider, so no console mounts one. | consoles | ≈ 45 KB (owner 244.3 → 198.8, staff 249.0 → 203.5) |
| **SegmentedControl without Radix.** A WAI-ARIA radio group written out (roving tabindex, arrows, Home/End) instead of Radix ToggleGroup. | marketing, sign-in | ≈ 8 KB (marketing 177.2 → 169.3) |
| **Idempotency set instead of the operations table.** `pnpm gen:api` also writes `src/lib/api/generated/idempotent.ts` (the 9 operations that need `Idempotency-Key`); the client reads that, so the 176-operation flag table stays out of the browser. | consoles | ≈ 2.5 KB |
| **PIN dialogs on first use.** `DeviceLock` keeps the store and the inactivity timer; `DeviceLockDialogs` (set-up and lock screen, PBKDF2, form fields) loads when one opens. | staff | ≈ 1 KB |
| **TanStack Query on demand (lazy console providers).** `ConsoleProviders` no longer mounts `QueryProvider`: components that use queries wrap themselves (pages with lists, `NotificationPanel`, `GlobalSearchDialog`), all sharing the tab's one client; `@/lib/api/query-runtime` lets realtime invalidation and the read-only switch attach once a client exists (before that nothing is cached). The notification badge counts from a direct inbox fetch, refreshed on realtime events. | consoles | ≈ 13–15 KB (owner 196.3 → 181.7, staff 200.1 → 187.3) |

## What is left, and where the next kilobytes are

- **Framework floor ≈ 138 KB** — fixed by React/Next versions.
- **`tailwind-merge` ≈ 9 KB** on every page with a client component (`cn`). Kept: callers override
  component classes and rely on last-wins merging; dropping it would need an audit of every `className`
  override. The first thing to revisit if the marketing set gets close to 180 KB.
- **Staff shell app code ≈ 40 KB**: offline queue (idb), service-worker registration and push prompt,
  device lock, realtime client, the API client (openapi-fetch), shell frame and next-intl's client
  runtime. F4 adds reading capture on this page: keep camera/OCR code behind the capture action.
- **Web Vitals RUM ≈ 3.7 KB** is loaded at start on purpose (late registration loses INP entries).

## How the sets run

`pnpm lhci` starts the mock API (`mocks/server.ts`) and the production server, signs the persona of each
console set in on the mock API and hands Lighthouse the session as a `Cookie` header, so `owner`
(`/dashboard`), `staff` (`/`) and `admin` (`/`) are measured as signed-in shells; `owner-marketing`
(`/`, `/en`, `/pricing`) is public and also asserts the SEO category. Where Chrome runs as root
(containers) pass `LHCI_CHROME_FLAGS="--headless=new --no-sandbox"` (and `CHROME_PATH` to a Chromium).
CI runs it in the `lighthouse` job.

To see what is in a bundle: `pnpm analyze` (webpack build with `@next/bundle-analyzer`, treemaps in
`.next/analyze/client.html`; the module sizes are representative even though the shipped build is
Turbopack's) or `pnpm exec next analyze` (Turbopack's own analyzer, interactive). Run `pnpm build` again
before `pnpm lhci` — the analyzer build replaces `.next`.

## History

- **F0** — sets configured against placeholder shells; no Chrome in the sandbox.
- **F1 1.3 (2026-10-17)** — measured over budget; ratchets: marketing 200 KB (target 120), owner/admin
  280 KB (target 250), staff 280 KB (target 180).
- **D-179 (2026-10-17)** — budgets re-based (180 / 260 / 200 / 260) and enforced as hard limits after the
  reductions above; every set passes.

## Admin console (F5) and owner F2 2.6 (2026-10-20, `pnpm lhci admin owner`, desktop preset, signed in — admin as a platform admin, owner as the owner persona)

Every URL within the 260 KB hard limit (D-179); accessibility 1.0 on every URL (an error assertion).

| Set | URL | Initial JS (gz) |
|---|---|---|
| `admin` | `/` | 184.0 KB |
| `admin` | `/tenants` | 193.9 KB |
| `admin` | `/tenants/0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11` | 182.4 KB |
| `admin` | `/tenants/0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11/subscription` | 219.1 KB |
| `admin` | `/tenants/0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11/pilot` | 194.2 KB |
| `admin` | `/subscriptions/invoices/8b000000-0000-4000-8000-000000000001` | 191.1 KB |
| `admin` | `/tariffs/9b000000-0000-4000-8000-000000000001` | 196.7 KB |
| `admin` | `/settings` | 188.6 KB |
| `admin` | `/audit` | 185.3 KB |
| `admin` | `/outbox` | 194.9 KB |
| `admin` | `/devices` | 192.1 KB |
| `admin` | `/devices/2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e03` | 191.6 KB |
| `admin` | `/ota/rollouts/aa000000-0000-4000-8000-000000000001` | 192.5 KB |
| `owner` | `/settings` | 199.7 KB |
| `owner` | `/settings/bank-accounts` | 197.7 KB |
| `owner` | `/settings/members` | 196.9 KB |
| `owner` | `/settings/notifications` | 191.5 KB |
| `owner` | `/settings/privacy` | 194.9 KB |
| `owner` | `/billing/rate-plans` | 197.2 KB |
| `owner` | `/subscription` | 189.6 KB |
| `owner` | `/subscription/invoices/8b000000-0000-4000-8000-000000000001` | 189.6 KB |
| `owner` | `/reports` | 188.9 KB |

## R2 owner F2 2.7 and staff F4 4.4 (2026-10-21, `pnpm lhci owner staff`, owner desktop / staff mobile preset, signed in)

Every URL within the hard limits (D-179: owner 260 KB, staff 200 KB); accessibility 1.0 on every URL (an error assertion). The R2 screens add no new dependency: forms reuse the console's `FormDialog` / `ConfirmAction`, the staff camera (`PhotoCapture` → `CameraCapture`) is a `lazyWarm` chunk loaded when the photo button is used, not in the initial JS. Measured after the contract re-sync to api `57eef37`; the owner rows from F2 2.1–2.6 that the re-sync touched are re-measured here.

| Set | URL | Initial JS (gz) |
|---|---|---|
| `owner` | `/dashboard` | 184.8 KB |
| `owner` | `/leases/new` (with the compliance preview) | 226.9 KB |
| `owner` | `/billing` | 201.8 KB |
| `owner` | `/invoices/1e700000-0000-4000-8000-000000000102` (QR + deliveries) | 204.5 KB |
| `owner` | `/meters/a1000000-0000-4000-8000-000000000004` | 192.6 KB |
| `owner` | `/loss` | 221.4 KB |
| `owner` | `/billing/rate-plans` | 197.3 KB |
| `owner` | `/service-requests` | 194.4 KB |
| `owner` | `/service-requests/5e700000-0000-4000-8000-000000000001` | 195.2 KB |
| `owner` | `/work-orders` | 187.2 KB |
| `owner` | `/work-orders/70000000-0000-4000-8000-000000000003` | 196.5 KB |
| `owner` | `/maintenance` | 221.5 KB |
| `owner` | `/access` | 192.5 KB |
| `owner` | `/access/10c00000-0000-4000-8000-000000000001` | 192.5 KB |
| `owner` | `/announcements` | 187.2 KB |
| `owner` | `/announcements/new` | 197.5 KB |
| `owner` | `/parcels` | 199.0 KB |
| `owner` | `/community/facilities` | 196.7 KB |
| `owner` | `/community/rules` | 217.6 KB |
| `staff` | `/` (Today from `GET /v1/staff/tasks`) | 193.3 KB |
| `staff` | `/work-orders` | 191.3 KB |
| `staff` | `/work-orders/70000000-0000-4000-8000-000000000001` | 197.3 KB |
| `staff` | `/parcels` | 194.8 KB |

Staff is the tight one: the work order screen sits 2.7 KB under the 200 KB limit. The next staff screen that needs more should move the cost-line form and the "waiting for parts" note behind a `lazyWarm` boundary (both are below the fold and used on a minority of visits) before anything else.

## Full pass after the api `18b160e` adoption (2026-10-21, `pnpm lhci`, every URL of every set, signed in)

All 62 URLs within the hard limits (D-179: marketing 180 KB, owner / admin 260 KB, staff 200 KB); accessibility 1.0 on
every URL (an error assertion). New in the sets: admin `/integration-events` and `/privacy`, staff
`/service-requests/[id]` (the message thread). The first full pass found staff `/readings` at **201.8 KB** (over the
limit; it had last been measured at 195.8 KB in F4 4.1): `ReadingSourceBadge` imported the `@/domain/status` barrel,
which ships every status map (≈ 5 KB gz). It now imports `@/domain/status/readingSource` alone — every staff page
dropped ≈ 2 KB and `/readings` to 195.0 KB. Client code must import status maps from their own file, never the barrel.

| Set | URL | Initial JS (gz) |
|---|---|---|
| `owner-marketing` | `/` | 170.7 KB |
| `owner-marketing` | `/en` | 170.7 KB |
| `owner-marketing` | `/pricing` | 168.6 KB |
| `owner` | `/dashboard` | 184.8 KB |
| `owner` | `/units?building=5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c` | 216.8 KB |
| `owner` | `/units?building=5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b8e` | 216.8 KB |
| `owner` | `/leases/new` | 225.9 KB |
| `owner` | `/leases/1ea50000-0000-4000-8000-000000000002` | 221.6 KB |
| `owner` | `/deposits/de900000-0000-4000-8000-000000000303` | 194.7 KB |
| `owner` | `/billing` | 196.7 KB |
| `owner` | `/invoices` | 187.3 KB |
| `owner` | `/invoices/1e700000-0000-4000-8000-000000000102` | 199.4 KB |
| `owner` | `/payments/slips` | 191.7 KB |
| `owner` | `/arrears` | 189.8 KB |
| `owner` | `/meters/a1000000-0000-4000-8000-000000000004?building=5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c` | 187.5 KB |
| `owner` | `/loss` | 220.7 KB |
| `owner` | `/settings` | 202.1 KB |
| `owner` | `/settings/bank-accounts` | 197.9 KB |
| `owner` | `/settings/members` | 197.1 KB |
| `owner` | `/settings/notifications` | 191.7 KB |
| `owner` | `/settings/privacy` | 195.2 KB |
| `owner` | `/billing/rate-plans` | 197.4 KB |
| `owner` | `/subscription` | 189.8 KB |
| `owner` | `/subscription/invoices/8b000000-0000-4000-8000-000000000001` | 189.8 KB |
| `owner` | `/reports` | 189.1 KB |
| `owner` | `/service-requests` | 194.5 KB |
| `owner` | `/service-requests/5e700000-0000-4000-8000-000000000001` | 197.5 KB |
| `owner` | `/work-orders` | 187.3 KB |
| `owner` | `/work-orders/70000000-0000-4000-8000-000000000003` | 197.9 KB |
| `owner` | `/maintenance` | 221.5 KB |
| `owner` | `/access` | 192.6 KB |
| `owner` | `/access/10c00000-0000-4000-8000-000000000001` | 192.6 KB |
| `owner` | `/announcements` | 187.3 KB |
| `owner` | `/announcements/new` | 197.6 KB |
| `owner` | `/parcels` | 199.1 KB |
| `owner` | `/community/facilities` | 196.8 KB |
| `owner` | `/community/rules` | 217.7 KB |
| `staff` | `/` | 191.5 KB |
| `staff` | `/readings` | 195.0 KB |
| `staff` | `/inspections` | 188.3 KB |
| `staff` | `/inspections/15e00000-0000-4000-8000-000000000002` | 197.0 KB |
| `staff` | `/devices` | 189.5 KB |
| `staff` | `/devices/install` | 195.1 KB |
| `staff` | `/work-orders` | 189.5 KB |
| `staff` | `/work-orders/70000000-0000-4000-8000-000000000001` | 196.8 KB |
| `staff` | `/parcels` | 193.0 KB |
| `staff` | `/service-requests/5e700000-0000-4000-8000-000000000001` | 195.1 KB |
| `admin` | `/` | 188.2 KB |
| `admin` | `/tenants` | 194.3 KB |
| `admin` | `/tenants/0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11` | 181.6 KB |
| `admin` | `/tenants/0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11/subscription` | 216.7 KB |
| `admin` | `/tenants/0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11/pilot` | 193.4 KB |
| `admin` | `/subscriptions/invoices/8b000000-0000-4000-8000-000000000001` | 190.4 KB |
| `admin` | `/tariffs/9b000000-0000-4000-8000-000000000001` | 197.3 KB |
| `admin` | `/settings` | 187.9 KB |
| `admin` | `/audit` | 184.5 KB |
| `admin` | `/outbox` | 194.1 KB |
| `admin` | `/devices` | 192.3 KB |
| `admin` | `/devices/2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e03` | 190.9 KB |
| `admin` | `/ota/rollouts/aa000000-0000-4000-8000-000000000001` | 191.7 KB |
| `admin` | `/integration-events` | 184.5 KB |
| `admin` | `/privacy` | 188.2 KB |

## Release-fix adoption (api `048a8bd`) and B6.2 / B6.3 owner screens (2026-10-21, `pnpm lhci`, every URL of every set, signed in)

Every set met its budget and accessibility 1.0 (`owner-marketing` 3, `owner` 41, `staff` 10, `admin` 15 URLs). The owner set
was re-run on its own after one Lighthouse runtime error (`NO_NAVSTART` on `/loss` — the page loaded too slowly on a
machine shared with another session's Lighthouse run; not a budget result). The new screens, all well inside 260 KB:

| Set | URL | Initial JS | Budget | Headroom |
|---|---|---|---|---|
| `owner` | `/payments/held` (held payments to check) | 189.4 KB | 260 KB | 70.6 KB |
| `owner` | `/payments/[id]` (a held payment) | 190.6 KB | 260 KB | 69.4 KB |
| `owner` | `/parties/link-requests` | 190.1 KB | 260 KB | 69.9 KB |
| `owner` | `/tm30` | 191.0 KB | 260 KB | 69.0 KB |
| `owner` | `/reports/etax` | 189.8 KB | 260 KB | 70.2 KB |
| `owner` | `/reports/etax/[id]` | 188.7 KB | 260 KB | 71.3 KB |
| `owner` | `/reports/insights` (12 series charts + benchmarks) | 193.6 KB | 260 KB | 66.4 KB |

Insights draws its charts with the server-rendered SVG `Chart` (no chart library, no client JavaScript); six series are
shown, the other six sit in a native `<details>` — nothing to download until opened, and no JS either way. The rest of the
sets moved by ≤ 1.5 KB against the `18b160e` pass (largest: `/dashboard` 184.9 KB with the new queue items, `/settings`
202.3 KB, `/leases/new` 226.0 KB, `/loss` 220.8 KB; staff 188.4–197.1 KB of 200 KB; admin 181.7–216.8 KB).

## Pre-release review fixes (2026-10-21, `pnpm lhci`, every URL of every set, signed in)

Every set met its budget with accessibility 1.0: `owner-marketing` 168.9–171.0 KB (180), `owner` 185.4–226.6 KB
(260), `admin` 182.2–217.4 KB (260), **`staff` 190.1–199.4 KB (200)**. The staff pages grew by about 2 KB with the
review fixes that must live in the shell (the offline queue's cross-tab lock and owner binding, the held items in the
sync sheet, the sign-out warning); the sign-out clean-up itself (`leaveStaffDevice`: push removal, queue / draft /
cache purge) and the queue's IndexedDB-lease fallback load on first use. The largest staff page is the work order
(199.4 KB, door codes now fetched on tap by a small client component): **0.6 KB of headroom** — the next staff
feature has to come with a reduction (candidates: the work-order step forms on demand, the sync sheet's list).

