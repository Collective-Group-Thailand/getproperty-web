# src/ui/fonts

Three woff2 files (ADR-0001; **one typeface — Anuphan — for the whole system since 2026-10-24**, as getpack), copied from `@fontsource-variable/{anuphan,jetbrains-mono}`
by `pnpm fonts` (also on `postinstall`) and committed, so a checkout builds offline:

| File                         | Family                          | Role                                           |
| ---------------------------- | ------------------------------- | ---------------------------------------------- |
| `anuphan-{thai,latin}.woff2` | Anuphan variable 100–700        | display (titles, the bill hero)                |
| `jetbrains-mono-latin.woff2` | JetBrains Mono variable 100–800 | numbers: bill/receipt numbers, meter registers |

`index.ts` declares them with `next/font/local`; `.storybook/fonts.css` declares the same three faces by
hand because Vite cannot run `next/font`. Keep the two in step. Fonts are licensed under the SIL OFL 1.1
(see each package's LICENSE).
