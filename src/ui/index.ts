/**
 * The design system (ADR-0002). Zones import from `@/ui`; nothing here knows about a zone, the API
 * or a route. Server-safe: the client components carry their own "use client".
 */
export * from "./brand";
export * from "./components";
export { Icon, type IconGlyph, type IconProps } from "./icons";
export { cn } from "./lib/cn";
export { ThemeProvider, ThemeToggle, useTheme, type Theme, type ThemeChoice } from "./theme";
