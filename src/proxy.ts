import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/lib/env/server";
import { createNonce, securityHeaders, sentryOriginFromDsn } from "@/lib/security/headers";
import {
  isReservedPath,
  isZoneEnabled,
  resolveZone,
  ZONE_HEADER,
  ZONE_SEGMENT,
  zoneHosts,
  type Zone,
} from "@/lib/zones";
import { isMarketingPath } from "@/lib/zones/marketing";
import { routing } from "@/i18n/routing";

/**
 * The request gate of every zone (Next 16 `proxy.ts`, ADR-0004, F1 1.1), in this order:
 *
 * 1. `Host` → zone; an unknown host, or a zone this deployment does not serve (`ZONES`), is a 404.
 * 2. Another zone's internal segment (`/staff`, `/admin`) and the retired resident segments
 *    (`/tenant`, `/resident`, D-154) are a 404 on every host.
 * 3. A per-request CSP nonce; the request carries the zone and the CSP (Next stamps the nonce on its
 *    own scripts from the request's CSP header).
 * 4. Access-token refresh before rendering (`refreshSession`, F1 1.2) so a Server Component never
 *    renders a signed-out page for a user whose refresh token is still good.
 * 5. Routing: the owner host goes through next-intl (`th` at `/`, `en` at `/en`); the staff and admin
 *    hosts are rewritten onto their segment. `/bff/*` is each zone's own BFF — the owner's lives at
 *    `/bff`, the others at `/<zone>/bff` — so a BFF is only reachable on its own host.
 * 6. Security headers on the response: CSP, `Permissions-Policy` (camera on staff only), HSTS,
 *    `Referrer-Policy`, `X-Robots-Tag: noindex` on everything except the owner marketing pages.
 */

/** Next's metadata files and the brand asset are served from the app root on every host. */
const ROOT_ASSETS = new Set(["/favicon.ico", "/icon.svg", "/brand/wordmark.svg"]);

const intl = createIntlMiddleware(routing);

/** A path no page answers, under the zone's own root layout, so the 404 is that zone's not-found page. */
export const NOT_FOUND_PATH = "/_not-found-zone";

export interface ZoneRoute {
  zone: Zone;
  /** `rewrite`: serve this internal URL · `intl`: hand to next-intl (owner pages) · `asset`: as is. */
  kind: "rewrite" | "intl" | "asset" | "not-found";
  url: URL;
}

/** Where a request goes, without side effects (unit-tested). `null` = unknown or disabled host. */
export function routeRequest(
  url: URL,
  host: string | null,
  hosts: Record<Zone, string> = zoneHosts(),
  enabled: readonly Zone[] = ["owner", "staff", "admin"],
): ZoneRoute | null {
  const zone = resolveZone(host, hosts);
  if (!zone || !isZoneEnabled(zone, enabled)) return null;

  const rewritten = new URL(url);
  if (ROOT_ASSETS.has(url.pathname)) return { zone, kind: "asset", url: rewritten };

  const segment = ZONE_SEGMENT[zone];
  if (isReservedPath(url.pathname)) {
    rewritten.pathname = segment ? `${segment}${NOT_FOUND_PATH}` : `/${routing.defaultLocale}${NOT_FOUND_PATH}`;
    rewritten.search = "";
    return { zone, kind: "not-found", url: rewritten };
  }

  if (segment) {
    rewritten.pathname = url.pathname === "/" ? segment : `${segment}${url.pathname}`;
    return { zone, kind: "rewrite", url: rewritten };
  }

  // Owner: the BFF and the robots/sitemap files live at the app root, outside `[locale]`.
  if (url.pathname === "/bff" || url.pathname.startsWith("/bff/") || isRootFile(url.pathname)) {
    return { zone, kind: "asset", url: rewritten };
  }
  return { zone, kind: "intl", url: rewritten };
}

function isRootFile(pathname: string): boolean {
  return pathname === "/robots.txt" || pathname === "/sitemap.xml";
}

function notFoundResponse(): NextResponse {
  return new NextResponse("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
  });
}

export async function proxy(request: NextRequest) {
  const env = serverEnv();
  const route = routeRequest(
    request.nextUrl,
    request.headers.get("host"),
    zoneHosts({ OWNER_HOST: env.OWNER_HOST, STAFF_HOST: env.STAFF_HOST, ADMIN_HOST: env.ADMIN_HOST }),
    env.ZONES,
  );
  if (!route) return notFoundResponse();

  const { zone } = route;
  const nonce = createNonce();
  const dev = env.NODE_ENV === "development";
  const headers = securityHeaders({
    zone,
    nonce,
    dev,
    assetOrigin: env.NEXT_PUBLIC_ASSET_BASE_URL,
    sentryOrigin: sentryOriginFromDsn(env.NEXT_PUBLIC_SENTRY_DSN),
    indexable: route.kind !== "not-found" && isMarketingPath(zone, request.nextUrl.pathname),
    hsts: env.NODE_ENV === "production",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ZONE_HEADER, zone);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", headers["Content-Security-Policy"]!);

  let response: NextResponse;
  if (route.kind === "intl") {
    response = intl(new NextRequest(request, { headers: requestHeaders }));
  } else if (route.kind === "asset") {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    response = NextResponse.rewrite(route.url, { request: { headers: requestHeaders } });
  }

  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  response.headers.set(ZONE_HEADER, zone);
  return response;
}

export const config = {
  // Everything except Next's own assets and static files with an extension, plus the root files
  // the proxy routes per zone (robots, sitemap, the staff service worker and manifest).
  matcher: [
    "/((?!_next/|.*\\..*).*)",
    "/favicon.ico",
    "/icon.svg",
    "/brand/wordmark.svg",
    "/robots.txt",
    "/sitemap.xml",
    "/sw.js",
    "/manifest.webmanifest",
  ],
};
