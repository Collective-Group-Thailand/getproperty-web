# Brand — getproperty

The logo is the **founder's artwork** (supplied 2026-10-21 as a PNG, traced to vector and approved after a
correction of the chimney gradient). It replaces the D-100 placeholder mark. The source files live in
`docs/brand/`; everything the app draws or serves is generated from them by `pnpm brand`
(`scripts/build-brand.ts`, `pnpm brand:check` in CI).

| | Value | Where |
|---|---|---|
| Name | **getproperty** — lower case (D-001), Latin name kept in Thai copy | `BRAND_NAME`, `src/ui/brand/config.ts` |
| Tagline | **บิลทำเอง เก็บเงินเอง ถูกกฎหมาย** | `BRAND_TAGLINE`; `shared.brand.tagline` in `src/i18n` |
| Company | **Collective Group (Thailand)** | `BRAND_COMPANY` |
| Domain | `getproperty.co` | `BRAND_DOMAIN` |
| Logo | "getproper" navy `#21365B`, the house "ty" blue `#1A4BA3`, the chimney a **vertical gradient `#62AEF9` → `#2E69F5`** (part of the logo — never flatten it) | `docs/brand/getproperty-logo.svg` → `<Wordmark />` |
| Logo, one colour | white, for dark and brand-blue backgrounds | `getproperty-logo-white.svg` → `<Wordmark tone="onDark" />` |
| Mark | the house "ty" + chimney alone | `getproperty-mark.svg` → `<Mark />`, `<Wordmark compact />` |
| App icon | white house on a `#1A4BA3` rounded square, chimney white → `#BFD9FD` | `getproperty-app-icon.svg` → favicons, PWA, apple-touch |

**The logo has its own lettering.** Never set "getproperty" in a font next to it, never re-draw, re-colour
(other than the founder's white version), stretch or outline it. In running text the name stays plain text.

## Using it in the app

- `<Wordmark size="sm|md|lg" />` — height 28 / 36 / 56 px, width follows the artwork (≈ 4.7 : 1).
  `compact` = the mark. `tone="auto"` (default) follows the theme through the `logo-*` tokens: the founder's
  colours on light and high contrast, the white version on dark. `tone="onDark"` forces the white version.
- Accessible name "getproperty" (`role="img"`); `decorative` when visible text or the enclosing link already
  names it (the console top bars: the home link is named "home").
- Every instance gets its own chimney-gradient id (`useId`), so several logos on a page never clash.
- Server components only: a client frame receives the logo as a prop (`shellBrand()` →
  `brand={…}` on the owner / staff / admin frames), so the path data is markup, never client JavaScript
  (D-179 budgets). Error boundaries and other client-only places use the static files below.

| Place | What |
|---|---|
| Sign-in (owner, staff, admin) | `AuthFrame`: `<Wordmark size="sm" />`, named |
| Owner / admin top bar | `BrandSlot`: the mark on phones and while the sidebar is collapsed, the full logo otherwise |
| Staff top bar | the mark (`shellBrand().compact`) |
| Marketing header | full logo; the mark below 420 px (the nav keeps its room on a 360 px phone) |
| Staff `/offline` | inline SVG from `geometry.ts`, `logo-*` token colours, no script |
| Admin template preview (e-mail) | `/brand/getproperty-logo.png`, as an e-mail client would load it |

## Files (`pnpm brand`)

| File | Use |
|---|---|
| `public/brand/getproperty-{logo,logo-white,mark,mark-white,app-icon}.svg` | the founder's SVGs, byte for byte |
| `public/brand/getproperty-logo{,-white}.png` | 880 × 188, e-mail and the Organization JSON-LD `logo` |
| `public/brand/favicon.svg` | tab icon: the mark, white in a dark browser UI (`prefers-color-scheme`) |
| `public/favicon.ico`, `public/brand/favicon-{16,32,48}.png` | raster fallbacks — the app icon |
| `public/apple-touch-icon.png`, `public/brand/apple-touch-icon.png` | 180 × 180, full bleed (iOS rounds it) |
| `public/pwa/staff-{192,512}.png`, `staff-maskable-512.png` | staff PWA manifest (maskable: mark at 62 %, inside the safe circle) |
| `public/brand/og-image.png` | 1200 × 630 Open Graph / Twitter card of the owner host's public pages (logo + Thai tagline) |
| `src/ui/brand/geometry.ts` | path data and colours for the React components and the offline page |

Theme colour (`<meta name="theme-color">`, manifest `theme_color`): `#1A4BA3`. Manifest `background_color`: the
light page paper.

## Colour tokens (`src/ui/tokens/primitives.ts` → `semantic.ts`)

`BRAND` holds the logo's four hex values verbatim (`hexToOklch`); the `brand` ramp (hue 261, peak chroma 0.16)
supplies the quiet steps around them.

| Token | Light | Dark | High contrast |
|---|---|---|---|
| `primary` | `#1A4BA3` (house blue) | `#62AEF9` (chimney sky) | `#21365B` (navy) |
| `primary-hover` | `#21365B` (navy) | sky, L + 0.08 | `brand-950` |
| `focus-ring` | `#1A4BA3` | `#62AEF9` | black |
| `primary-subtle` / `-fg` | `brand-50` / navy | `brand-950` / `brand-300` | `brand-50` / `brand-950` |
| `logo-ink` / `logo-house` | navy / blue | white / white | navy / blue |
| `logo-chimney-top` / `-bottom` | `#62AEF9` / `#2E69F5` | white / white | `#62AEF9` / `#2E69F5` |

| Palette | Hue | Peak chroma | Meaning |
|---|---|---|---|
| `brand` | 261 | 0.16 | **primary** — actions, links, focus ring, the logo |
| `neutral` | 75 | 0.012 | chrome: borders, muted text, neutral badges — warm, so the page never reads clinical |
| paper (`PAPER`) | 80 | 0.006–0.012 | the owner's page (`bg` L 0.978), band, borders, ink (L 0.22) |
| `green` | 145 | 0.15 | **success** — paid, synced, healthy |
| `amber` | 72 | 0.16 | **warning / attention** — due soon, estimated reading, slip waiting. Never for money that is merely due |
| `red` | 27 | 0.19 | **danger** — overdue, compliance refusal, device offline, destructive actions |
| `blue` | 228 | 0.14 | **info** — cerulean, turned away from the brand's royal blue so an info badge never reads as primary |

Every pair the components use is checked at WCAG 2.2 AA in all three themes by `pnpm contrast`
(46 pairs × 3 themes, including the logo against the page and cards at 3 : 1). The logo's house blue on
white is 8.1 : 1, navy 12.1 : 1; on the dark page the blue would be 2.3 : 1, which is why dark uses the sky.

## Changing the logo

1. Replace the files in `docs/brand/` (same names; the logo's three paths in the order ink, house, chimney).
2. `pnpm brand` (Chromium for the OG card: `PW_CHROMIUM_EXECUTABLE`), then `pnpm tokens && pnpm contrast`
   if the colours changed (`BRAND` in `primitives.ts`).
3. Review the visual snapshots (`pnpm e2e:visual --update-snapshots`) and tell `getproperty-liff`
   (`docs/shared-copies.md`).

Never copy another product's colours, type or marks (CLAUDE.md); getpack's palette is not a reference (D-003).
