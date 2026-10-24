# ADR-0001 — Thai-first typography: Noto Sans Thai (UI), Anuphan (display), JetBrains Mono (numbers)

> **Amended 2026-10-24 (founder):** one typeface for the whole system — Anuphan for UI and headlines, as getpack; Noto Sans Thai is no longer loaded. JetBrains Mono stays for tabular figures. Sizes: one scale in `src/ui/tokens/scale.ts` (see design-system.md).

**Status:** Accepted (2026-10-16, F0 0.2) · Proposed 2026-10-16 (F0 0.1)

## Context
design-system.md §2 asks for Thai + Latin open-licence families self-hosted via `next/font/local`: a UI
face whose tone marks and upper vowels stack cleanly at 14–16 px, a display face for the page title and
the tenant's bill amount, and a mono face for bill numbers and meter registers (tabular). Thai body
line-height ≥ 1.6; tenant base 16 px, staff base 18 px. No runtime Google Fonts in any zone (a LIFF
page on 4G cannot afford a third-party font request, and the tenant's privacy posture forbids it).

The build environment cannot reach Google Fonts or GitHub, only the npm registry.

## Decision
- **UI: Noto Sans Thai** (variable, wght 100–900). Tone marks (่ ้ ๊ ๋) and upper vowels render correctly
  at 14 px on Chrome, Safari and Android; the Latin companion is metrically matched, so mixed Thai/English
  lines keep one x-height. Lining tabular figures are available.
- **Display: Anuphan** (variable, wght 100–700) for h1–h4 and the hero amount — a Thai-native geometric that
  reads calmly next to Noto and stays legible at 36 px (`--text-4xl`).
- **Mono: JetBrains Mono** (variable, wght 100–800) for bill/receipt numbers and meter registers; Latin only.
- **Source: npm.** The five woff2 files (Thai + Latin subsets of each) come from
  `@fontsource-variable/{noto-sans-thai,anuphan,jetbrains-mono}` (SIL OFL 1.1) through
  `scripts/copy-fonts.ts` (`pnpm fonts`, also on `postinstall`), into `src/ui/fonts/files/`. The files are
  **committed** so a checkout builds offline; `pnpm fonts --check` in CI fails when they drift from the
  installed packages. Total 152 KB (Noto 58, Anuphan 54, JetBrains 40), each `font-display: swap`,
  `preload` only for the two Noto files.
- `next/font/local` declares each family by script with Latin first in the `--font-sans` /
  `--font-display` / `--font-mono` stacks, so ASCII takes the Latin file and Thai falls through to the
  Thai file (replacing `unicode-range`, which `next/font/local` cannot express per `src`). Storybook
  declares the same five faces by hand in `.storybook/fonts.css`.
- `.tabular-nums` (`lining-nums tabular-nums`) is a utility applied by `MoneyDisplay`, `NumberInput`,
  `DataTable` numeric cells and the DatePicker.

IBM Plex Sans Thai was rejected for the UI role: static weights only (7 files) and wider Thai glyphs that
crowd dense owner tables at 12–13 px. Kanit/Prompt were rejected for display: looped terminals read as
marketing, not as a bill.

## Consequences
- No external font request at build or run time anywhere.
- R2's my/km/lo/zh tenant languages add Noto Sans Myanmar / Khmer / Lao / SC subsets through the same script.
- A font upgrade is `pnpm up "@fontsource-variable/*" && pnpm fonts`, reviewed as a diff of binary files.
