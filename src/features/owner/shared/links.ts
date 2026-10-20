import type { Locale } from "@/i18n/routing";

/**
 * A console path with the owner zone's locale prefix (`/en/invoices` in English, `/invoices` in Thai —
 * `localePrefix: "as-needed"`), for plain links rendered on the server.
 */
export function ownerPath(locale: Locale, path: string): string {
  return locale === "th" ? path : `/${locale}${path === "/" ? "" : path}`;
}

export { withQuery } from "@/features/shared/console/params";
