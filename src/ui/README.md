# src/ui — the getproperty design system

Standards: `docs/prompts/design-system.md`. Decisions: ADR-0001 (fonts), ADR-0002 (Radix + Tailwind v4

- CVA), ADR-0003 (tokens → generated CSS variables, three themes, `gp_theme` cookie).

```
tokens/      primitives → semantic → (component tier lives in each component's cva)
generated/   tokens.css — `pnpm tokens`; never edit
styles/      base.css (element defaults, focus ring, reduced motion), zones.css (density per zone)
fonts/       the five woff2 files + next/font/local declarations
brand/       BRAND_* constants, Mark, Wordmark
icons/       the curated set (curated.ts) → generated per-icon glyphs (`pnpm icons`) and <Icon icon={…}>
components/  one file per component, Storybook story + axe test beside it
theme/       ThemeProvider / ThemeToggle / server stamp
docs/        Storybook MDX: principles, tokens, voice & tone
test/        axe helper for component tests
```

Initial JS (D-179): icons one glyph at a time (`import { IconCheck } from "@/ui/icons/glyphs/check"`,
`<Icon icon={IconCheck} />`; add a key to `icons/curated.ts`, run `pnpm icons`); zones open overlays through
`components/overlays.tsx` (`LazySheet`, `LazyDialog`, `LazyAlertDialog`, `LazyDropdownMenu`, `LazyPopover`,
built on `lib/lazy.tsx`), and `toast` loads sonner on first use.

Rules: semantic utilities only (`bg-surface`, `text-muted`, `rounded-control`); copy comes in as props;
status tone/icon from `src/domain/status`; every component ships a story and passes axe in `pnpm test`.
