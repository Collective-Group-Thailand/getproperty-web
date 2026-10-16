/**
 * WCAG 2.2 AA contrast gate for the semantic tokens (ADR-0003, design-system.md §2/§6).
 *
 * Every text and UI pair a component is allowed to put together is declared here once and checked
 * in all three themes. Adding a semantic colour is therefore not a design decision a reviewer has
 * to eyeball — the gate decides.
 *
 * Runs two ways:
 *   pnpm contrast                       prints the full table, exits 1 on a failure
 *   src/ui/tokens/contrast.test.ts      so `pnpm test` covers it, as ADR-0003 says
 */

import { contrastRatio } from "../src/ui/tokens/color";
import { SEMANTIC_KEYS, THEME_NAMES, THEMES, type SemanticKey, type ThemeName } from "../src/ui/tokens/semantic";

/** 4.5 for text (WCAG 1.4.3), 3 for large text, icons, borders and focus rings (1.4.11). */
type Minimum = 4.5 | 3;

interface Pair {
  fg: SemanticKey;
  bg: SemanticKey;
  min: Minimum;
  why: string;
}

/**
 * `subtle` is checked at 3:1, not 4.5:1, because it is only ever placeholders, disabled labels and
 * decorative meta text — the cases 1.4.3 exempts. Body and secondary text use `fg` and `muted`,
 * which are held to 4.5:1 on every background they may sit on.
 */
export const PAIRS: Pair[] = [
  { fg: "fg", bg: "bg", min: 4.5, why: "body text on the page" },
  { fg: "fg", bg: "bg-subtle", min: 4.5, why: "body text on a section band" },
  { fg: "fg", bg: "surface", min: 4.5, why: "body text on a card, panel or menu" },
  { fg: "fg", bg: "surface-subtle", min: 4.5, why: "body text on a quiet panel" },
  { fg: "fg", bg: "surface-raised", min: 4.5, why: "menu item and popover text" },
  { fg: "muted", bg: "bg", min: 4.5, why: "secondary text on the page" },
  { fg: "muted", bg: "bg-subtle", min: 4.5, why: "secondary text on a section band" },
  { fg: "muted", bg: "surface", min: 4.5, why: "secondary text on a card" },
  { fg: "muted", bg: "surface-subtle", min: 4.5, why: "secondary text on a quiet panel" },
  { fg: "muted", bg: "surface-raised", min: 4.5, why: "secondary text in a menu or popover" },
  { fg: "subtle", bg: "bg", min: 3, why: "placeholder and disabled text" },
  { fg: "subtle", bg: "surface", min: 3, why: "placeholder and disabled text on a card" },
  { fg: "primary", bg: "bg", min: 4.5, why: "link and icon-only button on the page" },
  { fg: "primary", bg: "surface", min: 4.5, why: "link inside a card" },
  { fg: "primary", bg: "bg-subtle", min: 4.5, why: "link on a section band" },
  { fg: "primary-hover", bg: "bg", min: 4.5, why: "hovered link stays legible" },
  { fg: "border-strong", bg: "bg", min: 3, why: "input outline, table rule (1.4.11)" },
  { fg: "border-strong", bg: "surface", min: 3, why: "input outline on a card" },
  { fg: "border-strong", bg: "bg-subtle", min: 3, why: "input outline on a section band" },
  { fg: "focus-ring", bg: "bg", min: 3, why: "focus indicator on the page (2.4.11)" },
  { fg: "focus-ring", bg: "surface", min: 3, why: "focus indicator on a card" },
  { fg: "focus-ring", bg: "surface-subtle", min: 3, why: "focus indicator on a quiet panel" },
  { fg: "focus-ring", bg: "bg-subtle", min: 3, why: "focus indicator on a section band" },
  { fg: "primary-fg", bg: "primary", min: 4.5, why: "label on a primary button" },
  { fg: "primary-fg", bg: "primary-hover", min: 4.5, why: "label on a hovered primary button" },
  { fg: "success-fg", bg: "success", min: 4.5, why: "label on a solid success fill" },
  { fg: "warning-fg", bg: "warning", min: 4.5, why: "label on a solid attention fill" },
  { fg: "danger-fg", bg: "danger", min: 4.5, why: "label on a destructive button" },
  { fg: "danger-fg", bg: "danger-hover", min: 4.5, why: "label on a hovered destructive button" },
  { fg: "info-fg", bg: "info", min: 4.5, why: "label on a solid info fill" },
  { fg: "neutral-fg", bg: "neutral", min: 4.5, why: "label on a solid neutral fill" },
  { fg: "primary-subtle-fg", bg: "primary-subtle", min: 4.5, why: "primary badge / callout" },
  { fg: "success-subtle-fg", bg: "success-subtle", min: 4.5, why: "success badge / callout" },
  { fg: "warning-subtle-fg", bg: "warning-subtle", min: 4.5, why: "attention badge / callout" },
  { fg: "danger-subtle-fg", bg: "danger-subtle", min: 4.5, why: "danger badge / callout" },
  { fg: "info-subtle-fg", bg: "info-subtle", min: 4.5, why: "info badge / callout" },
  { fg: "neutral-subtle-fg", bg: "neutral-subtle", min: 4.5, why: "neutral badge / callout" },
  // Status dots and badge outlines sit on cards: the solid tones must read as UI components (3:1).
  { fg: "success", bg: "surface", min: 3, why: "status dot / icon on a card" },
  { fg: "warning", bg: "surface", min: 3, why: "attention dot / icon on a card" },
  { fg: "danger", bg: "surface", min: 3, why: "danger dot / icon on a card" },
  { fg: "info", bg: "surface", min: 3, why: "info dot / icon on a card" },
  { fg: "fg-inverse", bg: "neutral", min: 4.5, why: "text on an inverse (toast) surface" },
];

export interface Result {
  theme: ThemeName;
  fg: SemanticKey;
  bg: SemanticKey;
  min: number;
  ratio: number;
  passed: boolean;
  why: string;
}

export function checkContrast(): Result[] {
  const results: Result[] = [];
  for (const theme of THEME_NAMES) {
    for (const pair of PAIRS) {
      const ratio = contrastRatio(THEMES[theme][pair.fg], THEMES[theme][pair.bg]);
      results.push({ theme, ...pair, ratio, passed: ratio + 0.005 >= pair.min });
    }
  }
  return results;
}

/** Guards against a semantic colour that exists but no pair ever checks. */
export function uncheckedKeys(): SemanticKey[] {
  const seen = new Set<SemanticKey>(PAIRS.flatMap((p) => [p.fg, p.bg]));
  // Alpha scrims and the hairline border have no fixed partner to measure against.
  const exempt = new Set<SemanticKey>(["overlay", "border"]);
  return SEMANTIC_KEYS.filter((key) => !seen.has(key) && !exempt.has(key));
}

function main(): void {
  const results = checkContrast();
  const failures = results.filter((r) => !r.passed);

  for (const theme of THEME_NAMES) {
    process.stdout.write(`\n${theme}\n`);
    for (const r of results.filter((x) => x.theme === theme)) {
      const mark = r.passed ? "ok  " : "FAIL";
      process.stdout.write(`  ${mark} ${r.ratio.toFixed(2).padStart(5)}:1 (min ${r.min})  ${r.fg} on ${r.bg}\n`);
    }
  }

  const unchecked = uncheckedKeys();
  if (unchecked.length) process.stdout.write(`\nNot covered by any pair: ${unchecked.join(", ")}\n`);

  if (failures.length || unchecked.length) {
    process.stdout.write(`\n${failures.length} failing pair(s), ${unchecked.length} unchecked key(s)\n`);
    process.exit(1);
  }
  process.stdout.write(`\nAll ${results.length} pairs pass in ${THEME_NAMES.length} themes\n`);
}

if (process.argv[1]?.endsWith("check-contrast.ts")) main();
