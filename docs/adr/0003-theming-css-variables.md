# ADR-0003 — Theming through generated CSS variables (light / dark / high-contrast), cookie-persisted

**Status:** Accepted (2026-10-16, F0 0.2) · Proposed 2026-10-16 (F0 0.1)

## Context
design-system.md §2 requires primitive → semantic → component token tiers, OKLCH with CI contrast
validation, light + dark themes (owner/admin default light, tenant follows the system, staff offers high
contrast), stored in a cookie so the server can render the right theme with no flash.

## Decision
- Tokens are TypeScript (`src/ui/tokens`). `scripts/build-tokens.ts` emits
  `src/ui/generated/tokens.css` (committed; `pnpm tokens:check` in CI): a Tailwind v4 `@theme` block
  (primitive palettes, radius, shadows, motion, type scale, containers, and semantic *aliases*
  `--color-<name>: var(--sem-<name>)`) plus `--sem-*` blocks for `:root` (light),
  `@media (prefers-color-scheme: dark) :root:not([data-theme])`, `[data-theme="dark"]` and
  `[data-theme="hc"]`. Tailwind's own palette, radii, shadows and fonts are reset (`--color-*: initial`)
  so `bg-slate-500` stops resolving.
- Utilities such as `bg-primary`, `text-muted`, `border-border`, `ring-focus-ring` therefore switch
  theme at runtime without rebuilding CSS or duplicating it per theme.
- **Semantic keys**: `bg`, `bg-subtle`, `surface`, `surface-subtle`, `surface-raised`, `overlay`,
  `border`, `border-strong`, `fg`, `muted`, `subtle`, `fg-inverse`, `focus-ring`, `primary-hover`,
  `danger-hover`, and for each tone in `primary | success | warning | danger | info | neutral` the four
  slots `<tone>`, `<tone>-fg`, `<tone>-subtle`, `<tone>-subtle-fg`. The spec's `text` / `text-muted` is
  spelled `fg` / `muted` so Tailwind does not generate `text-text-muted`.
- **Contrast gate**: `scripts/check-contrast.ts` converts OKLCH → sRGB (gamut-mapping by chroma
  reduction, as a browser does) and asserts WCAG 2.2 AA for 42 declared pairs in all three themes —
  126 checks, 4.5:1 for text, 3:1 for `subtle`, borders, focus rings and status dots. It runs inside
  `pnpm test` (`src/ui/tokens/contrast.test.ts`), and a semantic key no pair mentions fails it too.
  `opacity-*` must not be used to de-emphasise text: it compounds and defeats the gate silently.
- **Cookie `gp_theme`** (`system | light | dark | hc`, host-only, JS-readable, no identity): the root
  layout reads it (`src/ui/theme/server.ts`) and stamps `<html data-theme>`; `ThemeProvider` /
  `ThemeToggle` write it and flip the attribute without a round trip. Per-zone defaults:
  owner/staff/admin `light`, tenant `system`; only the staff zone offers `hc`.
- **Hues (D-100 placeholders)**: teal-green `primary` (hue 172), warm neutrals (hue 75–80), amber
  `warning` for attention, red `danger`, green `success`, blue `info`. See `docs/ui/brand.md`. A brand kit
  arrives as hex and is pasted into `primitives.ts` via `hexToOklch`; the gate decides what it may do.

## Consequences
- Adding a semantic colour = add it to `SemanticTheme` (all three themes must define it), declare its
  pairs in `scripts/check-contrast.ts`, `pnpm tokens`, and the gate decides.
- A solid amber fill needs the 800 step to carry white text and read at 3:1 as an icon; the quiet badge
  (`warning-subtle`, amber-100 / amber-900) carries the amber look. Recorded in `semantic.ts`.
- Zones never set colour outside the semantic utilities; `warning`/`danger` utilities are reached only
  through `src/ui` components (ESLint), which is where "amber = attention, never merely-due money" is kept true.
