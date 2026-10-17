# Performance budgets (design-system.md §7, D-179)

Enforced with Lighthouse CI (`pnpm lhci`, configs in `lighthouse/`) and, from F1, Web Vitals RUM posted
through the BFF. On a shared CI runner LCP/INP/CLS are **warnings** (a lab run is not a p75); the initial
JS size and the accessibility score are **errors** — the JS budgets below are **hard limits**, not
ratchets (D-179, 2026-10-17).

| Route type | LCP (p75) | INP (p75) | CLS | JS shipped (gz, initial) | Lighthouse set |
|---|---|---|---|---|---|
| Marketing (owner host) | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 180 KB | `owner-marketing` |
| Owner dashboard / list / detail | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 260 KB | `owner` |
| Owner workspaces (cycle review, room map) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 300 KB | `owner-workspaces` (F2) |
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
