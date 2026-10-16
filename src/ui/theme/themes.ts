import type { Zone } from "@/lib/zones";

/**
 * Theme selection (ADR-0003). Shared by the server stamp and the client provider, so it must stay
 * free of both `next/headers` and browser globals.
 */

/** The three palettes the tokens define. */
export const THEMES = ["light", "dark", "hc"] as const;
export type Theme = (typeof THEMES)[number];

/** What the user chose. `system` means "no `data-theme`, follow prefers-color-scheme". */
export const THEME_CHOICES = ["system", ...THEMES] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/**
 * Host-only, JS-readable on purpose: the toggle writes it without a round trip, and it carries no
 * identity. Session tokens never go in a cookie like this (CLAUDE.md).
 */
export const THEME_COOKIE = "gp_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Per-zone default when the visitor has not chosen (00-master-plan.md §2): owner and admin are
 * light-first consoles and the staff PWA starts light with high contrast one tap away. (The resident
 * LINE Mini App, which follows the phone, is `getproperty-liff` since D-154.)
 */
export const ZONE_DEFAULT_THEME = {
  owner: "light",
  staff: "light",
  admin: "light",
} as const satisfies Record<Zone, ThemeChoice>;

export type { Zone };

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

/** The value to stamp on `<html data-theme>`: `undefined` for `system`, so the CSS media query takes over. */
export function dataThemeAttribute(choice: ThemeChoice): Theme | undefined {
  return choice === "system" ? undefined : choice;
}

/** Whether a zone offers the high-contrast palette in its toggle (design-system.md §5). */
export function themeChoicesFor(zone: Zone): readonly ThemeChoice[] {
  return zone === "staff" ? THEME_CHOICES : (["system", "light", "dark"] as const);
}
