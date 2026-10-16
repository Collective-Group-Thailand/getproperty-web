import { defineRouting } from "next-intl/routing";

/**
 * Owner zone only. Thai is the default and carries no prefix (`/dashboard`), English lives under
 * `/en`. The tenant, staff and admin zones have no locale segment — their URLs are tools, not indexed
 * pages — so their locale lives in a host-only cookie instead (D-064: th/en in R1; the tenant zone
 * adds my/km/lo/zh in R2).
 */
export const routing = defineRouting({
  locales: ["th", "en"],
  defaultLocale: "th",
  localePrefix: "as-needed",
  // `/` is always Thai; a language switcher navigates to /en explicitly.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

/** JS-readable on purpose, like `gp_theme`: it carries no identity and the switcher writes it without a round trip. */
export const LOCALE_COOKIE = "gp_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value);
}
