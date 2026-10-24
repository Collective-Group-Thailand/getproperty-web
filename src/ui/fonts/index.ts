import localFont from "next/font/local";

/**
 * Self-hosted Thai-first typography (ADR-0001, one typeface since 2026-10-24). No runtime Google Fonts in any zone;
 * the three woff2 files come from the `@fontsource-variable/*` npm packages through `scripts/copy-fonts.ts`.
 *
 * Each family is split by script, and the stacks in `src/ui/tokens/scale.ts` put Latin first: ASCII
 * comes from the Latin companion, and Thai codepoints fall through to the Thai file. That ordering is
 * what replaces `unicode-range` — `next/font/local` applies its `declarations` to every `src` entry of
 * a call, so it cannot give two files in one family different ranges.
 *
 * None of these declarations names a generic fallback: `next/font/local` would splice it into that
 * family's own variable, ahead of the Thai family in the stack, and `system-ui` on a Thai system
 * *does* have Thai glyphs — so Thai text would never reach Anuphan's Thai file. The generics belong at
 * the end of `--font-sans` / `--font-display` / `--font-mono` instead.
 */

/**
 * Anuphan variable (wght 100–700) — the ONE typeface of the whole system (founder 2026-10-24, as getpack): body,
 * labels, tables and headlines. `--font-sans` and `--font-display` both point here (src/ui/tokens/scale.ts).
 */
const displayLatin = localFont({
  src: "./files/anuphan-latin.woff2",
  weight: "100 700",
  style: "normal",
  display: "swap",
  variable: "--font-gp-display-latin",
  preload: true,
});

const displayThai = localFont({
  src: "./files/anuphan-thai.woff2",
  weight: "100 700",
  style: "normal",
  display: "swap",
  variable: "--font-gp-display-thai",
  preload: true,
});

/**
 * Mono — JetBrains Mono variable, for bill numbers, receipt numbers and meter registers (tabular).
 * Latin only: a register is never Thai script.
 */
const mono = localFont({
  src: "./files/jetbrains-mono-latin.woff2",
  weight: "100 800",
  style: "normal",
  display: "swap",
  variable: "--font-gp-mono",
  preload: false,
});

/**
 * Applied to `<html>` by each zone's root layout. The class only carries the CSS variables; what
 * actually selects a family is `--font-sans` / `--font-display` / `--font-mono` in the tokens.
 */
export const fontClassNames = [displayLatin, displayThai, mono].map((font) => font.variable).join(" ");
