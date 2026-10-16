# Brand — getproperty (placeholder until the brand kit exists, D-100)

| | Value | Where |
|---|---|---|
| Name | **getproperty** — lower-case wordmark, Latin name kept in Thai copy (D-001) | `BRAND_NAME`, `src/ui/brand/config.ts` |
| Tagline | **บิลทำเอง เก็บเงินเอง ถูกกฎหมาย** | `BRAND_TAGLINE`; `shared.brand.tagline` in `src/i18n` |
| Company | **Collective Group (Thailand)** | `BRAND_COMPANY` |
| Domain | `getproperty.co` | `BRAND_DOMAIN` |
| Mark | a building outline with one lit "meter" dot — the reading that becomes a bill. Drawn in-house, 32-px grid, `currentColor` | `src/ui/brand/Mark.tsx`, `public/brand/wordmark.svg`, `src/app/icon.svg` |
| Wordmark | mark + "getproperty" in Anuphan 600, tracking −0.02em | `src/ui/brand/Wordmark.tsx` |

## Hues (OKLCH, `src/ui/tokens/primitives.ts`)

| Palette | Hue | Peak chroma | Meaning |
|---|---|---|---|
| `teal` | 172 | 0.11 | **primary** — actions, links, focus ring, the mark. Calm, trustworthy, not a bank's navy and not a fintech's violet |
| `neutral` | 75 | 0.012 | chrome: borders, muted text, neutral badges — warm, so the page never reads clinical |
| paper (`PAPER`) | 80 | 0.006–0.012 | the owner's page (`bg` L 0.978), band, borders, ink (L 0.22) |
| `green` | 145 | 0.15 | **success** — paid, synced, healthy (kept yellower than the teal) |
| `amber` | 72 | 0.16 | **warning / attention** — due soon, estimated reading, slip waiting. Never for money that is merely due |
| `red` | 27 | 0.19 | **danger** — overdue, compliance refusal, device offline, destructive actions |
| `blue` | 255 | 0.17 | **info** |

Light theme: `primary` = teal-700 (`#1f7a66`-ish), `fg` = warm ink, `surface` = white on warm paper.
Dark: teal-400 on a warm near-black. High contrast: teal-900 / black on white, heavy borders.

Every pair the components use is checked at WCAG 2.2 AA in all three themes by `pnpm contrast`
(42 pairs × 3 themes).

## When the brand kit lands

1. Paste its hex values into `primitives.ts` through `hexToOklch` (and `PAPER` for the surfaces).
2. `pnpm tokens && pnpm contrast` — the gate says what may carry text.
3. Replace `Mark.tsx`, `public/brand/wordmark.svg`, `src/app/icon.svg`.
4. Nothing else changes: components only name semantic tokens.

Never copy another product's colours, type or marks (CLAUDE.md); getpack's palette is not a reference (D-003).
