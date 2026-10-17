import type { Zone } from "./index";

/**
 * The only pages any host of this app lets a search engine index (F1 1.3 §7): the owner host's
 * public marketing pages, in both languages. Everything else — every console page, the whole staff
 * and admin hosts, the BFF — carries `X-Robots-Tag: noindex` (set by `src/proxy.ts`) and is left out
 * of the sitemap (`src/app/sitemap.ts`).
 */
export const MARKETING_PATHS = [
  "/",
  "/pricing",
  "/legal/terms",
  "/legal/privacy",
  "/legal/pdpa",
  "/legal/dpa",
] as const;

export type MarketingPath = (typeof MARKETING_PATHS)[number];

export function isMarketingPath(zone: Zone, pathname: string): boolean {
  if (zone !== "owner") return false;
  const withoutLocale = pathname.replace(/^\/(th|en)(?=\/|$)/, "") || "/";
  const normalised = withoutLocale.length > 1 ? withoutLocale.replace(/\/+$/, "") : withoutLocale;
  return (MARKETING_PATHS as readonly string[]).includes(normalised);
}
