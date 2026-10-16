/**
 * `server.ts` is deliberately absent from this barrel: it imports `next/headers`, which cannot be
 * pulled into a client bundle. Root layouts import it by path.
 */
export { ThemeProvider, useTheme } from "./ThemeProvider";
export { ThemeToggle, type ThemeToggleProps } from "./ThemeToggle";
export {
  dataThemeAttribute,
  isThemeChoice,
  THEME_CHOICES,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  THEMES,
  themeChoicesFor,
  ZONE_DEFAULT_THEME,
  type Theme,
  type ThemeChoice,
  type Zone,
} from "./themes";
