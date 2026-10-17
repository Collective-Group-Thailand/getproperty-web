# Performance budgets (design-system.md §7)

Enforced with Lighthouse CI (`pnpm lhci`, configs in `lighthouse/`) and, from F1, Web Vitals RUM posted
through the BFF. On a shared CI runner LCP/INP/CLS are **warnings** (a lab run is not a p75); the initial
JS size and the accessibility score are **errors**.

| Route type | LCP (p75) | INP (p75) | CLS | JS shipped (gz, initial) | Lighthouse set |
|---|---|---|---|---|---|
| Marketing (owner host) | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 120 KB | `owner-marketing` |
| Owner dashboard / list / detail | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB | `owner` |
| Owner workspaces (cycle review, room map) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 300 KB | `owner-workspaces` (F2) |
| Staff PWA | ≤ 2.5 s on 4G mid-range; instant from cache offline | ≤ 200 ms | ≤ 0.1 | ≤ 180 KB | `staff` |
| Admin | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB | `admin` |

`resource-summary:script:size` is asserted as the budget in bytes (180 KB → 184 320; 250 KB → 256 000).
Lighthouse measures transferred bytes; with compression on the server that is the gz figure.

The resident LIFF budget (LCP ≤ 2.0 s on 4G mid-range, CLS ≤ 0.05, ≤ 150 KB) moved with the resident
app to `getproperty-liff` (D-154).

Techniques: RSC by default, client components only where interactive, route-level splitting,
`next/image` AVIF/WebP with `sizes`, font subsetting (ADR-0001: 152 KB for all five files, two preloaded),
preconnect to S3/CDN, TanStack Query hydration, virtualised long lists (room map with 300 rooms), no
layout shift from fonts or images.

## How the sets run (F1 1.3)

`pnpm lhci` starts the mock API (`mocks/server.ts`) and the production server, signs the persona of each
console set in on the mock API and hands Lighthouse the session as a `Cookie` header, so `owner`
(`/dashboard`), `staff` (`/`) and `admin` (`/`) are measured as signed-in shells; `owner-marketing`
(`/`, `/en`, `/pricing`) is public and also asserts the SEO category. Where Chrome runs as root
(containers) pass `LHCI_CHROME_FLAGS="--headless=new --no-sandbox"`. CI runs it in the `lighthouse` job.

## Ratchets

Measured 2026-10-17 (F1 1.3, transferred script bytes, Lighthouse `resource-summary`):

| Set | Target | Measured | Ceiling now | Why the gap, and the plan |
|---|---|---|---|---|
| `owner-marketing` | 120 KB | 189–199 KB | 200 KB | A page with nothing on it already loads 172 KB: React 19 + Next 16 runtime (~110 KB), next-intl's client formatter (12 KB), and the root error boundary pulling `Button`/`ErrorState` with the whole curated icon registry (18 KB). Plan: per-icon modules in `src/ui/icons` (no registry object in client bundles), a dependency-free root error boundary, and server-resolved copy on public pages so they need no client formatter. |
| `owner` | 250 KB | 267 KB | 280 KB | The shell's overlays (dropdowns, popover, dialogs, sheet — Radix + floating-ui), TanStack Query and sonner load up front. Plan: load the search dialog, notification panel, more-sheet and toaster on first use. |
| `admin` | 250 KB | 264 KB | 280 KB | As `owner` (command palette, notification panel). |
| `staff` | 180 KB | 272 KB | 280 KB | As `owner`, plus the offline queue (idb), device lock and sync sheet. F4 works this down before the reading capture lands (lazy overlays, the icon change above, no Radix menu in the top bar). |

A ceiling only ever moves down; each change is recorded here and in the set's `$comment`.

## F0 status (historical)

`pnpm lhci` is configured for the `owner` and `staff` URL sets against the placeholder shells (the
`tenant` set was replaced by `staff` when the resident zone moved out, D-154); it needs Chrome and a
`pnpm build` and is not part of `pnpm test`. The CI job is added in F1 together with the admin set. Ratchets (a ceiling pinned above the current measurement while the gap is worked down)
are recorded in the set's `$comment` and here, never raised silently.
