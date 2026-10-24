import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { PATH_HEADER } from "@/lib/auth/guards-shared";
import { applyCookies, refreshBeforeRender } from "@/lib/auth/proxy-session";
import { serverEnv } from "@/lib/env/server";
import { clientIpFrom, requestIdFrom } from "@/lib/http/edge";
import { createNonce, securityHeaders, sentryOriginFromDsn } from "@/lib/security/headers";
import {
  hostname,
  isReservedPath,
  isZoneEnabled,
  publicOrigin,
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
 * 4. Access-token refresh before rendering (`refreshBeforeRender`, F1 1.2) so a Server Component never
 *    renders a signed-out page for a user whose refresh token is still good.
 * 5. Routing: the owner host goes through next-intl (`th` at `/`, `en` at `/en`); the staff and admin
 *    hosts are rewritten onto their segment. `/bff/*` is each zone's own BFF — the owner's lives at
 *    `/bff`, the others at `/<zone>/bff` — so a BFF is only reachable on its own host.
 * 6. Security headers on the response: CSP, `Permissions-Policy` (camera on staff only), HSTS,
 *    `Referrer-Policy`, `X-Robots-Tag: noindex` on everything except the owner marketing pages.
 *
 * The platform's public site (`MARKETING_HOST`, e.g. `getproperty.app`) is the owner zone limited to the marketing
 * pages: those (and the root files) are served there with no session, everything else is a 308 to the same path on
 * `OWNER_HOST`. Once it is set the marketing pages on the owner host are `noindex` (their canonical is the public
 * site), so a search engine sees one copy.
 */

/**
 * Icons browsers ask for at the root of every host (`public/`, `pnpm brand`). The rest of the brand kit
 * lives under `/brand/` and `/pwa/`, which the matcher already leaves alone.
 */
const ROOT_ASSETS = new Set(["/favicon.ico", "/apple-touch-icon.png"]);

const intl = createIntlMiddleware(routing);

/** A path no page answers, under the zone's own root layout, so the 404 is that zone's not-found page. */
export const NOT_FOUND_PATH = "/_not-found-zone";

export interface ZoneRoute {
  zone: Zone;
  /**
   * `rewrite`: serve this internal URL · `intl`: hand to next-intl (owner pages) · `asset`: as is ·
   * `redirect`: 308 to `url` (a non-marketing path on the public site → the owner host).
   */
  kind: "rewrite" | "intl" | "asset" | "not-found" | "redirect";
  url: URL;
  /** The request came in on `MARKETING_HOST`. */
  marketing?: true;
}

/** The public site: its host, and the owner host's public origin the rest of the paths move to. */
export interface MarketingSite {
  host: string;
  ownerOrigin: string;
}

/** Where a request goes, without side effects (unit-tested). `null` = unknown or disabled host. */
export function routeRequest(
  url: URL,
  host: string | null,
  hosts: Record<Zone, string> = zoneHosts(),
  enabled: readonly Zone[] = ["owner", "staff", "admin"],
  marketing?: MarketingSite,
): ZoneRoute | null {
  if (marketing && hostname(host) === hostname(marketing.host)) {
    return isZoneEnabled("owner", enabled) ? marketingRoute(url, marketing) : null;
  }
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

function marketingRoute(url: URL, site: MarketingSite): ZoneRoute {
  const zone = "owner" as const;
  if (ROOT_ASSETS.has(url.pathname) || isRootFile(url.pathname)) {
    return { zone, kind: "asset", url: new URL(url), marketing: true };
  }
  if (!isReservedPath(url.pathname) && isMarketingPath(zone, url.pathname)) {
    return { zone, kind: "intl", url: new URL(url), marketing: true };
  }
  return { zone, kind: "redirect", url: new URL(`${url.pathname}${url.search}`, site.ownerOrigin), marketing: true };
}

function isRootFile(pathname: string): boolean {
  return pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/llms.txt";
}

/**
 * The URL the browser asked for. Behind the platform's Caddy (D-230) TLS ends at Caddy and Next's standalone server
 * builds `request.url` from its own listen address (`https://0.0.0.0:3000/…`), so a redirect built from it (next-intl's
 * `/th/x` → `/x`) would send the browser to the container (`publicRedirect`). The `Host` header is the public one (Caddy keeps it; it
 * already chose this zone) and `X-Forwarded-Proto` is set by Caddy for every request; without either the URL is used
 * as it is (local dev, tests).
 */
export function publicUrl(request: Pick<NextRequest, "headers" | "nextUrl">): URL {
  const url = new URL(request.nextUrl.href);
  const host = request.headers.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return url;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const scheme = proto === "https" || proto === "http" ? proto : url.protocol.replace(/:$/, "");
  return new URL(`${scheme}://${host}${url.pathname}${url.search}`);
}

/**
 * A redirect next-intl built from `request.url` (the container's listen address behind Caddy) moved onto the public
 * origin. Only redirects: a rewrite must keep the internal origin, or Next would proxy it to the public host.
 */
export function publicRedirect(
  response: NextResponse,
  request: Pick<NextRequest, "headers" | "nextUrl">,
): NextResponse {
  const location = response.headers.get("location");
  if (!location || response.status < 300 || response.status >= 400) return response;
  let target: URL;
  try {
    target = new URL(location, request.nextUrl.href);
  } catch {
    return response;
  }
  if (target.origin !== request.nextUrl.origin) return response;
  const origin = publicUrl(request);
  response.headers.set("location", `${origin.origin}${target.pathname}${target.search}${target.hash}`);
  return response;
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
    env.MARKETING_HOST ? { host: env.MARKETING_HOST, ownerOrigin: publicOrigin(env.OWNER_HOST) } : undefined,
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
    indexable:
      (route.kind === "intl" || route.kind === "asset") &&
      isMarketingPath(zone, request.nextUrl.pathname) &&
      (!env.MARKETING_HOST || route.marketing === true),
    hsts: env.NODE_ENV === "production",
  });

  const requestHeaders = new Headers(request.headers);
  // A client-chosen request id is not trusted (review L1): only a UUID passes, else this request gets its own.
  const requestId = requestIdFrom(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set(ZONE_HEADER, zone);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", headers["Content-Security-Policy"]!);
  requestHeaders.set(PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);

  // Pages only: the BFF refreshes for itself, assets need no session, and the public site has none (its pages are
  // the same for everyone, and the session cookies belong to the owner host).
  const session =
    (route.kind === "intl" || route.kind === "rewrite") && !route.marketing
      ? await refreshBeforeRender(request, env.API_INTERNAL_URL, fetch, clientIpFrom(request.headers, env.TRUSTED_HOPS))
      : null;
  if (session?.cookieHeader !== undefined) requestHeaders.set("cookie", session.cookieHeader);

  let response: NextResponse;
  if (route.kind === "redirect") {
    response = NextResponse.redirect(route.url, 308);
  } else if (route.kind === "intl") {
    response = publicRedirect(intl(new NextRequest(request, { headers: requestHeaders })), request);
  } else if (route.kind === "asset") {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    response = NextResponse.rewrite(route.url, { request: { headers: requestHeaders } });
  }

  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  response.headers.set(ZONE_HEADER, zone);
  // The BFF answers with the id the API echoed for the same value; pages carry this request's own.
  if (route.kind !== "asset") response.headers.set("x-request-id", requestId);
  if (session) applyCookies(response, session.cookies);
  return response;
}

export const config = {
  // Every request except Next's own internals (`/_next/*`: hashed static chunks, the image optimiser, HMR) and the
  // public folders (`/pwa/*` icons, `/brand/*`), which are the same on every host. Paths with a dot are *not*
  // skipped (review L3): `/admin/bff/v1/admin/x.y`, `/staff/a.b` or `/work-orders/a.b` must meet the reserved-segment
  // 404, the host → zone rewrite, and the CSP / `X-Frame-Options` like any other page. The proxy itself sends the
  // root files (robots, sitemap, `/sw.js`, the manifest, the favicon) to their zone. The platform's container
  // endpoints (D-230) `/api/healthz` and `/api/metrics` are outside every zone: the compose healthcheck and Alloy
  // reach the container by its address (`Host: 127.0.0.1:3000`, `172.30.x.y:3000`), which is no zone's host.
  matcher: ["/((?!_next/|pwa/|brand/|__nextjs|api/healthz$|api/metrics$).*)"],
};
