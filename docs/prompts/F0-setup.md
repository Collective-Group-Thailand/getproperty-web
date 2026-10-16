# F0 — Set up `getproperty-web` from scratch

> Repo ว่าง (ไม่มี legacy) · อ่าน `CLAUDE.md`, `docs/prompts/00-master-plan.md`, `docs/prompts/design-system.md` ก่อน · ทำ 2 session: **0.1** แล้ว `/clear` แล้ว **0.2**
> ถ้ามี `../getpack-web` ให้ใช้เป็นตัวอย่าง tooling/`src/ui` foundation เท่านั้น (ห้าม copy brand tokens, designer, packaging screens)

---

## Session 0.1 — Fresh app, structure, tooling, CI
1. `pnpm create next-app@latest` (Next.js 16, App Router, TypeScript, Tailwind v4, ESLint flat, `src/`), then restructure to master plan §3: remove `src/app/layout.tsx`, create `src/app/[locale]/layout.tsx` (owner root), `src/app/tenant/layout.tsx`, `src/app/staff/layout.tsx`, `src/app/admin/layout.tsx` with placeholder pages; empty `src/features/{shared,owner,tenant,staff,admin}`, `src/ui`, `src/domain`, `src/i18n`, `src/lib/{api,auth,bff,liff,pwa,observability}` with READMEs. Path aliases `@/ui`, `@/features`, `@/lib`, `@/domain`, `@/i18n`.
2. Tooling: pnpm (`packageManager`), `.nvmrc` = 24, TypeScript strict, ESLint flat + Prettier (+ tailwind plugin), `eslint-rules/` with the zone-boundary rule and a failing fixture test; Vitest + Testing Library; Playwright (+ axe); Storybook 10 (react-vite, a11y addon) skeleton; MSW; Changesets not needed (no packages).
3. Brand constants: `BRAND_NAME=getproperty`, tagline "บิลทำเอง เก็บเงินเอง ถูกกฎหมาย", company "Collective Group (Thailand)"; placeholder wordmark SVG (lower-case, D-100); metadata; favicon placeholder; README for getproperty-web.
4. CI (`.github/workflows/ci.yml`): install → lint → typecheck → test → build → e2e (placeholder shells per host) → build-storybook. Contract-drift and Lighthouse jobs added in F1.
5. Docs: `docs/PROGRESS.md`, `docs/contract-requests.md` (empty table), `docs/performance-budgets.md` (from `design-system.md` §7), ADR-0001…0003 as *proposed* (implemented in 0.2).
6. Acceptance: `pnpm i && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green; four hosts render their placeholder shells locally (`*.localhost:3000`).

## Session 0.2 — Design-system foundation (`src/ui`) per `design-system.md` and ADR-0001…0003
Build only the foundation plus the shells; the rest of the component list is built when F1–F5 first need it.
1. **Tokens** in TypeScript (primitive → semantic → component) → `scripts/build-tokens.ts` generates `src/ui/generated/tokens.css` (Tailwind v4 `@theme` + `--sem-*` blocks for light / dark / high-contrast); `scripts/check-contrast.ts` (OKLCH → sRGB, WCAG 2.2 AA for every semantic pair in all three themes) runs in `pnpm test`. Theme cookie `gp_theme` + `data-theme` stamped server-side. Brand hues: a calm teal-green primary and a warm neutral surface palette as placeholders (D-100) — documented in `docs/ui/brand.md` for the future brand kit.
2. **Fonts** (ADR-0001): Noto Sans Thai (UI), Anuphan (display), JetBrains Mono (bill numbers, meter registers) self-hosted via `next/font/local`, Thai + Latin subsets; test tone-mark rendering and tabular numerals.
3. **Components** (ADR-0002): Button, IconButton, Field/Input/NumberInput (unit)/MoneyInput (display-only formatting)/Textarea, Select, Combobox, Checkbox, RadioCards, Switch, DatePicker (Buddhist era), OTPInput, PhoneInput (+66), Dialog, AlertDialog (typed confirmation), Sheet (bottom sheet for tenant/staff), Popover, DropdownMenu, Tooltip, Tabs, SegmentedControl, Badge/StatusBadge, Skeleton, Spinner, Card, Callout, EmptyState/ErrorState, Toast (sonner), Stat/KPI card, DataTable base, Timeline, AppShell skeleton (sidebar + topbar; bottom nav variant), CameraCapture + ScanButton stubs (built out in F4).
4. **i18n & domain seeds**: `src/i18n` messages th/en for shells, `formatTHB` (decimal strings), `formatUnits` (kWh / m³ with 3 decimals trimmed), Buddhist-era `formatDate`, relative time; `src/domain/status` scaffolding (typed to the contract in F1).
5. **Storybook** docs pages (principles, tokens, voice & tone) and a story + axe test per component; CI job builds Storybook.
6. **Lighthouse CI** config with the budgets in `docs/performance-budgets.md` (owner + tenant URL sets now; staff/admin in F1).
7. Acceptance: `pnpm test` (incl. contrast gate) · `pnpm build-storybook` · `pnpm e2e` green; axe clean on the shells; ADR-0001…0003 accepted; PROGRESS updated.
