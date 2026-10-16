import { cookies } from "next/headers";

import { isThemeChoice, THEME_COOKIE, ZONE_DEFAULT_THEME, type Theme, type ThemeChoice, type Zone } from "./themes";

/**
 * Reads `gp_theme` so a root layout can stamp `<html data-theme>` before the first byte reaches the
 * browser — the whole point of ADR-0003's cookie: no flash, and theming that works with JavaScript
 * disabled. Touching cookies makes the route dynamic; every zone's routes are dynamic anyway once
 * F1 adds the per-request CSP nonce.
 */
export async function readThemeChoice(zone: Zone): Promise<ThemeChoice> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isThemeChoice(value) ? value : ZONE_DEFAULT_THEME[zone];
}

/** `undefined` means "follow the OS" — see dataThemeAttribute. */
export async function readTheme(zone: Zone): Promise<Theme | undefined> {
  const choice = await readThemeChoice(zone);
  return choice === "system" ? undefined : choice;
}
