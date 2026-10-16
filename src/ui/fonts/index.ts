import localFont from "next/font/local";

/**
 * Self-hosted Thai-first typography (ADR-0001). No runtime Google Fonts in any zone; the five woff2
 * files come from the `@fontsource-variable/*` npm packages through `scripts/copy-fonts.ts`.
 *
 * Each family is split by script, and the stacks in `src/ui/tokens/scale.ts` put Latin first: ASCII
 * comes from the Latin companion, and Thai codepoints fall through to the Thai file. That ordering is
 * what replaces `unicode-range` — `next/font/local` applies its `declarations` to every `src` entry of
 * a call, so it cannot give two files in one family different ranges.
 *
 * None of these declarations names a generic fallback: `next/font/local` would splice it into that
 * family's own variable, ahead of the Thai family in the stack, and `system-ui` on a Thai system
 * *does* have Thai glyphs — so Thai text would never reach Noto Sans Thai. The generics belong at
 * the end of `--font-sans` / `--font-display` / `--font-mono` instead.
 */

/** UI — Noto Sans Thai variable (wght 100–900): body, labels, tables. Tone marks stack cleanly at 14 px. */
const sansLatin = localFont({
  src: "./files/noto-sans-thai-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-gp-sans-latin",
  preload: true,
});

const sansThai = localFont({
  src: "./files/noto-sans-thai-thai.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-gp-sans-thai",
  preload: true,
});

/** Display — Anuphan variable (wght 100–700): the page title, the resident's invoice amount hero. */
const displayLatin = localFont({
  src: "./files/anuphan-latin.woff2",
  weight: "100 700",
  style: "normal",
  display: "swap",
  variable: "--font-gp-display-latin",
  preload: false,
});

const displayThai = localFont({
  src: "./files/anuphan-thai.woff2",
  weight: "100 700",
  style: "normal",
  display: "swap",
  variable: "--font-gp-display-thai",
  preload: false,
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
export const fontClassNames = [sansLatin, sansThai, displayLatin, displayThai, mono]
  .map((font) => font.variable)
  .join(" ");
