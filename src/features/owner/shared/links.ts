import type { Locale } from "@/i18n/routing";

/**
 * A console path with the owner zone's locale prefix (`/en/invoices` in English, `/invoices` in Thai —
 * `localePrefix: "as-needed"`), for plain links rendered on the server.
 */
export function ownerPath(locale: Locale, path: string): string {
  return locale === "th" ? path : `/${locale}${path === "/" ? "" : path}`;
}

/** A path with search parameters; empty values are left out. */
export function withQuery(path: string, query: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}
