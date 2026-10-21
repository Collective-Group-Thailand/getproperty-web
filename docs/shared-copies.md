# Shared copies — what `getproperty-liff` must re-copy (D-154, D-155)

`getproperty-web` is the source of truth for `src/ui` (and the brand kit) until `collective-shared` exists
(D-155). `getproperty-liff` keeps the manifest of its copies in its own `docs/shared-copies.md` and checks them
with `pnpm shared:check`. This file lists, newest first, the changes here that the resident app has to take
over; the liff session re-copies them (from a `git archive` of the commit named, never from a working tree),
updates its manifest rows and runs `pnpm shared:check --strict`, `pnpm tokens`, `pnpm test`.

## 2026-10-21 — the founder's logo (commit in `docs/PROGRESS.md`, entry "Brand: the founder's logo")

The placeholder mark (D-100) and the teal palette are gone; the logo is the founder's artwork (`docs/brand`),
the `primary` tokens are the logo's blues. Liff's `Mark.tsx` / `Wordmark.tsx` copies still draw the old
placeholder and its tokens are still teal until it re-syncs.

| Path | Mode in liff | What changed |
|---|---|---|
| `src/ui/brand/Mark.tsx` | verbatim | the founder's mark (house "ty" + chimney gradient); `size` sm/md/lg/number, `tone`, `decorative`; per-instance gradient id |
| `src/ui/brand/Wordmark.tsx` | verbatim | the founder's full logo; no text set in a font |
| `src/ui/brand/Wordmark.stories.tsx` | verbatim | Default, Sizes, Compact, OnDark, Dark, HighContrast, ManyInstances |
| `src/ui/brand/config.ts` | verbatim | comment only |
| `src/ui/brand/index.ts` | verbatim | exports `LOGO_COLOURS`, `BRAND_HEIGHT`, the prop types |
| `src/ui/brand/geometry.ts` | **new**, generated | path data + colours (`pnpm brand` here; copy byte for byte) |
| `src/ui/brand/brand.test.tsx` | **new**, verbatim | names, gradient ids, sizes, `onDark`, server render, axe |
| `src/ui/tokens/primitives.ts` | verbatim | `BRAND` (logo hex values), `teal` → `brand` ramp (hue 261), `blue` (info) hue 255 → 228 |
| `src/ui/tokens/semantic.ts` | verbatim | `primary*` / `focus-ring` from the logo; new keys `logo-ink`, `logo-house`, `logo-chimney-top`, `logo-chimney-bottom` |
| `src/ui/generated/tokens.css` | generated | regenerate with `pnpm tokens` after copying the two files above |
| `scripts/check-contrast.ts` | verbatim | four logo pairs; the chimney stops exempt (46 pairs × 3 themes) |
| `scripts/build-tokens.ts` | verbatim | comment only |
| `src/ui/docs/Tokens.mdx` | verbatim | palette list |
| `src/ui/docs/Principles.mdx` | adapted | the `primary` line ("Brand blue") |
| `src/ui/components/Stat.tsx` | verbatim | comment only |
| `src/ui/components/SegmentedControl.tsx` | verbatim | new `fullWidth` prop (segments share the width, long labels wrap — 360 px sign-in / landing) |
| `src/ui/components/SegmentedControl.stories.tsx` | verbatim | `FullWidth` story |
| `src/ui/README.md` | adapted | the "Brand" paragraph |
| `eslint.config.mjs` | adapted (owned there) | palette guard: `teal` → `brand` in the raw-palette regex |

Brand files (binary — copy byte for byte; liff's own `public/brand/wordmark.svg` and `public/icons/*` are the
old placeholder and should be replaced from these):

| Path here | Use in liff |
|---|---|
| `docs/brand/getproperty-{logo,logo-white,mark,mark-white,app-icon}.svg`, `getproperty-logo-source.png` | source files |
| `public/brand/getproperty-{logo,logo-white,mark,mark-white,app-icon}.svg` | served logo files |
| `public/brand/getproperty-logo{,-white}.png` | e-mail / share |
| `public/brand/favicon.svg`, `public/favicon.ico`, `public/brand/favicon-{16,32,48}.png` | browser icons |
| `public/brand/apple-touch-icon.png` | → liff `public/icons/apple-touch-icon.png` |
| `public/pwa/staff-192.png`, `staff-512.png`, `staff-maskable-512.png` | → liff `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png` (same artwork; or run a copy of `scripts/build-brand.ts`) |

Theme colour for liff's manifest / `<meta name="theme-color">`: `#1A4BA3` (`LOGO_COLOURS.blue`).
