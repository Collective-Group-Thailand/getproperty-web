import { NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { resolveZone, ZONE_HEADER, ZONE_SEGMENT, zoneHosts, type Zone } from "@/lib/zones";

/**
 * Next 16 replaces `middleware.ts` with `proxy.ts`. F0 ships the smallest version that makes the
 * three hosts render their own shells: map the `Host` to a zone and rewrite the path onto that
 * zone's internal route segment. F1 1.1 adds, in this order: unknown-host 404, refusal of the
 * internal prefixes from outside, token refresh, next-intl on the owner host, the per-zone CSP
 * and the security headers (00-master-plan.md §2, ADR-0004).
 */

/** Next's metadata file conventions are served from the app root and belong to no zone. */
const ROOT_ASSETS = new Set(["/favicon.ico", "/icon.svg", "/brand/wordmark.svg", "/robots.txt"]);

export function zoneRewrite(url: URL, host: string | null, hosts = zoneHosts()): { zone: Zone; url: URL } {
  // An unknown host is served as the owner zone in F0 (preview URLs); F1 turns this into a 404.
  const zone = resolveZone(host, hosts) ?? "owner";
  const segment = ZONE_SEGMENT[zone];
  const rewritten = new URL(url);
  if (ROOT_ASSETS.has(url.pathname)) return { zone, url: rewritten };
  if (segment) {
    rewritten.pathname = url.pathname === "/" ? segment : `${segment}${url.pathname}`;
  } else {
    // Owner zone: its pages live under `[locale]`. Until F1 runs next-intl's middleware here, an
    // unprefixed path is Thai (`localePrefix: "as-needed"`, Thai at the root).
    const first = url.pathname.split("/")[1] ?? "";
    const hasLocale = (routing.locales as readonly string[]).includes(first);
    if (!hasLocale) rewritten.pathname = `/${routing.defaultLocale}${url.pathname === "/" ? "" : url.pathname}`;
  }
  return { zone, url: rewritten };
}

export function proxy(request: NextRequest) {
  const { zone, url } = zoneRewrite(request.nextUrl, request.headers.get("host"));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ZONE_HEADER, zone);

  const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  response.headers.set(ZONE_HEADER, zone);
  return response;
}

export const config = {
  // Everything except Next's own assets and static files with an extension.
  matcher: ["/((?!_next/|.*\\..*).*)", "/favicon.ico", "/icon.svg", "/brand/wordmark.svg"],
};
