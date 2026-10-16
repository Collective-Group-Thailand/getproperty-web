# src/ui/tokens

Three tiers (ADR-0003): **primitives** (`primitives.ts`, `scale.ts`) → **semantic** (`semantic.ts`, per
theme) → **component** (CVA variants inside each component, written only in semantic utilities).

- `pnpm tokens` regenerates `src/ui/generated/tokens.css` (committed; `pnpm tokens:check` in CI).
- `pnpm contrast` prints the WCAG 2.2 AA table; `contrast.test.ts` makes it a test.
- Components never import a value from here; they use `bg-primary`, `text-muted`, `border-border`,
  `rounded-control`, `shadow-card`… The ESLint config refuses raw palette steps in `className`.
- Brand hues are placeholders until the brand kit exists (D-100) — see `docs/ui/brand.md`.
