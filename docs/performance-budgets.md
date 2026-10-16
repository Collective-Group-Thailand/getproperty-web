# Performance budgets (design-system.md §7)

Enforced with Lighthouse CI (`pnpm lhci`, configs in `lighthouse/`) and, from F1, Web Vitals RUM posted
through the BFF. On a shared CI runner LCP/INP/CLS are **warnings** (a lab run is not a p75); the initial
JS size and the accessibility score are **errors**.

| Route type | LCP (p75) | INP (p75) | CLS | JS shipped (gz, initial) | Lighthouse set |
|---|---|---|---|---|---|
| Marketing (owner host) | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 120 KB | `owner-marketing` (F2) |
| Owner dashboard / list / detail | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB | `owner` |
| Owner workspaces (cycle review, room map) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 300 KB | `owner-workspaces` (F2) |
| Staff PWA | ≤ 2.5 s on 4G mid-range; instant from cache offline | ≤ 200 ms | ≤ 0.1 | ≤ 180 KB | `staff` |
| Admin | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB | `admin` (F1) |

`resource-summary:script:size` is asserted as the budget in bytes (180 KB → 184 320; 250 KB → 256 000).
Lighthouse measures transferred bytes; with compression on the server that is the gz figure.

The resident LIFF budget (LCP ≤ 2.0 s on 4G mid-range, CLS ≤ 0.05, ≤ 150 KB) moved with the resident
app to `getproperty-liff` (D-154).

Techniques: RSC by default, client components only where interactive, route-level splitting,
`next/image` AVIF/WebP with `sizes`, font subsetting (ADR-0001: 152 KB for all five files, two preloaded),
preconnect to S3/CDN, TanStack Query hydration, virtualised long lists (room map with 300 rooms), no
layout shift from fonts or images.

## F0 status

`pnpm lhci` is configured for the `owner` and `staff` URL sets against the placeholder shells (the
`tenant` set was replaced by `staff` when the resident zone moved out, D-154); it needs Chrome and a
`pnpm build` and is not part of `pnpm test`. The CI job is added in F1 together with the admin set. Ratchets (a ceiling pinned above the current measurement while the gap is worked down)
are recorded in the set's `$comment` and here, never raised silently.
