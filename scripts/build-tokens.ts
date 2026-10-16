/**
 * Generates src/ui/generated/tokens.css from the TypeScript tokens (ADR-0003).
 *
 *   pnpm tokens         write the file
 *   pnpm tokens:check   fail if the committed file is stale or was hand-edited
 *
 * Shape of the output:
 *   @theme                       primitives + scales + semantic *aliases* for Tailwind v4
 *   :root                        --sem-* for the light theme
 *   @media (prefers-color-scheme: dark) :root:not([data-theme])
 *                                --sem-* for visitors who never chose (no cookie, no flash)
 *   [data-theme="dark"|"hc"]     --sem-* for an explicit choice
 *
 * Because `@theme` only ever maps `--color-<name>` to `var(--sem-<name>)`, utilities such as
 * `bg-surface` or `text-muted` follow the theme at runtime with no rebuild and no duplicate CSS per
 * theme.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { oklchCss } from "../src/ui/tokens/color";
import { PALETTES, STEPS } from "../src/ui/tokens/primitives";
import {
  CONTAINER,
  DURATION,
  EASING,
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LINE_HEIGHT,
  RADIUS,
  SHADOW,
  SPACING_BASE,
  Z_INDEX,
} from "../src/ui/tokens/scale";
import { SEMANTIC_KEYS, THEMES } from "../src/ui/tokens/semantic";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/ui/generated/tokens.css");

const HEADER = `/*
 * GENERATED FILE — do not edit.
 * Source: src/ui/tokens/*.ts · Regenerate: pnpm tokens · Gate: pnpm tokens:check
 * Contrast of every semantic pair is asserted by scripts/check-contrast.ts in pnpm test.
 */`;

function block(selector: string, lines: string[]): string {
  return `${selector} {\n${lines.map((l) => (l === "" ? "" : `  ${l}`)).join("\n")}\n}`;
}

const indent = (text: string) => text.replace(/^(?=.)/gm, "  ");

function semanticVars(theme: keyof typeof THEMES): string[] {
  return SEMANTIC_KEYS.map((key) => `--sem-${key}: ${oklchCss(THEMES[theme][key])};`);
}

function themeBlock(): string {
  const lines: string[] = [];

  lines.push(
    "/*",
    " * Tailwind's own palette, fonts, radii and shadows are replaced, not extended: `bg-teal-600`",
    " * and `text-slate-500` must stop resolving, or the design system is a suggestion.",
    " */",
    "--color-*: initial;",
    "--radius-*: initial;",
    "--shadow-*: initial;",
    "",
    "/* Tier 1 — primitive palette (OKLCH). Do not use directly in components. */",
  );
  for (const [name, palette] of Object.entries(PALETTES)) {
    for (const step of STEPS) lines.push(`--color-${name}-${step}: ${oklchCss(palette[step])};`);
  }
  lines.push("--color-white: oklch(100% 0 0);", "--color-black: oklch(0% 0 0);", "--color-transparent: transparent;");

  lines.push("", "/* Tier 2 — semantic aliases. These are what components name; they follow the theme. */");
  for (const key of SEMANTIC_KEYS) lines.push(`--color-${key}: var(--sem-${key});`);

  lines.push("", "/* Typography (ADR-0001). */");
  lines.push("--font-*: initial;");
  for (const [name, stack] of Object.entries(FONT_FAMILY)) lines.push(`--font-${name}: ${stack};`);
  for (const [name, size] of Object.entries(FONT_SIZE)) lines.push(`--text-${name}: ${size};`);
  for (const [name, value] of Object.entries(LINE_HEIGHT)) lines.push(`--leading-${name}: ${value};`);
  for (const [name, value] of Object.entries(FONT_WEIGHT)) lines.push(`--font-weight-${name}: ${value};`);

  lines.push("", "/* Space, radius, elevation. */");
  lines.push(`--spacing: ${SPACING_BASE};`);
  for (const [name, value] of Object.entries(RADIUS)) lines.push(`--radius-${name}: ${value};`);
  for (const [name, value] of Object.entries(SHADOW)) lines.push(`--shadow-${name}: ${value};`);
  for (const [name, value] of Object.entries(CONTAINER)) lines.push(`--container-${name}: ${value};`);

  lines.push("", "/* Motion (respect prefers-reduced-motion — see src/ui/styles/base.css). */");
  for (const [name, value] of Object.entries(DURATION)) lines.push(`--duration-${name}: ${value};`);
  for (const [name, value] of Object.entries(EASING)) lines.push(`--ease-${name}: ${value};`);

  lines.push("", "/* Stacking order. */");
  for (const [name, value] of Object.entries(Z_INDEX)) lines.push(`--z-${name}: ${value};`);

  return block("@theme", lines);
}

export function buildTokensCss(): string {
  return [
    HEADER,
    themeBlock(),
    "/* Light is the base: no cookie, no OS preference, no surprises. */",
    block(":root", semanticVars("light")),
    "/* Nobody chose yet — follow the OS. Scoped to :root:not([data-theme]) so an explicit\n   choice always wins, and stamped server-side from gp_theme so there is no flash. */",
    `@media (prefers-color-scheme: dark) {\n${indent(block(":root:not([data-theme])", semanticVars("dark")))}\n}`,
    block('[data-theme="dark"]', semanticVars("dark")),
    block('[data-theme="hc"]', semanticVars("hc")),
    "",
  ].join("\n\n");
}

function main(): void {
  const css = buildTokensCss();
  const check = process.argv.includes("--check");

  if (check) {
    let current: string;
    try {
      current = readFileSync(OUT, "utf8");
    } catch {
      process.stderr.write("src/ui/generated/tokens.css is missing — run pnpm tokens\n");
      process.exit(1);
    }
    if (current !== css) {
      process.stderr.write(
        "src/ui/generated/tokens.css is out of date or was hand-edited.\nEdit src/ui/tokens/*.ts and run pnpm tokens.\n",
      );
      process.exit(1);
    }
    process.stdout.write("tokens.css is up to date\n");
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, css);
  process.stdout.write(`wrote ${OUT}\n`);
}

main();
