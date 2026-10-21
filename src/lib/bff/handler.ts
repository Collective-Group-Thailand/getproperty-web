import { NextResponse, type NextRequest } from "next/server";

import { CSRF_HEADER, REQUEST_ID_HEADER, TENANT_HEADER } from "@/lib/api/headers";
import { serverEnv } from "@/lib/env/server";
import { clientIpFrom, FORWARDED_FOR_HEADER, requestIdFrom } from "@/lib/http/edge";
import type { Zone } from "@/lib/zones";

import {
  ACCESS_COOKIE,
  clearedSessionCookies,
  REFRESH_COOKIE,
  sessionCookies,
  TENANT_COOKIE,
  validTenantId,
  type CookieSpec,
} from "../auth/cookies";
import { refreshTokens } from "../auth/refresh";
import { isAllowedUpstream, zoneHasTenant } from "../auth/zones";

/**
 * `createBffHandler(zone)` — the zone's backend-for-frontend (ADR-0004, F1 1.2). Browser code calls
 * `/bff/v1/...` on its own host; this handler:
 *
 * 1. forwards only the zone's allow-listed upstream prefixes (`/v1/resident`, `/v1/technician` and
 *    `/v1/device` never, whatever the list says);
 * 2. on every non-GET request demands a same-origin `Origin` (and `Sec-Fetch-Site` when present) and
 *    the header `x-getproperty-csrf: 1` — a cross-site form or fetch cannot set it;
 * 3. limits request bodies to `BFF_MAX_BODY_BYTES` (photos and slips go to object storage by presign,
 *    never through here);
 * 4. attaches `Authorization: Bearer` from the httpOnly access cookie and `X-Tenant-Id` from
 *    `__Host-gp_tenant` (owner/staff); client-sent `Authorization`, `Cookie` and `X-Tenant-Id` are
 *    dropped;
 * 5. refreshes once — before the call when the access cookie is gone, or after an upstream `401` —
 *    rotating both cookies; a refused refresh clears the session and returns the `401`;
 * 6. streams the upstream body back (PDF downloads, SSE) with `Cache-Control: no-store`;
 * 7. never lets a token pair reach the browser: a sign-in answered through here sets the cookies and
 *    returns only `{ subject }`;
 * 8. sends the API the end-user address its own edge saw — the `X-Forwarded-For` entry `TRUSTED_HOPS` from the
 *    right, as the only value — never the client's header as is, and a fresh request id unless the inbound one is
 *    a UUID (review H1, L1; api RUNBOOK §11, D-229);
 * 9. keeps the realtime stream token out of every browser-visible URL: `realtime/auth` answers it in the
 *    httpOnly `__Host-gp_sst` cookie (≤ 60 s) and a `streamUrl` without it; the stream request gets it back into
 *    the API's query string here, and the cookie is cleared as the stream opens (review L6).
 */

export const BFF_MAX_BODY_BYTES = 1024 * 1024;

const FORWARD_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "idempotency-key",
  "if-match",
  "if-none-match",
  "last-event-id",
];

/** httpOnly cookie carrying the 60-second realtime stream token from `realtime/auth` to `realtime/stream`. */
export const STREAM_TOKEN_COOKIE = "__Host-gp_sst";
const REALTIME_AUTH = /^\/v1\/(owner|staff|admin)\/realtime\/auth$/;
const REALTIME_STREAM = /^\/v1\/(owner|staff|admin)\/realtime\/stream$/;
const STREAM_TOKEN_MAX_AGE = 60;

function streamTokenCookie(value: string, maxAge: number): CookieSpec {
  return {
    name: STREAM_TOKEN_COOKIE,
    value,
    options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge },
  };
}

const DROP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "set-cookie",
  // undici already decoded the body; passing these on would make the browser decode it twice.
  "content-encoding",
  "content-length",
]);

/** Paths whose 200 is a `TokenPairDto` (contract §4) — turned into cookies here. */
const TOKEN_ISSUING = new Set([
  "/v1/auth/operator/otp/verify",
  "/v1/auth/operator/login",
  "/v1/auth/platform/login",
  "/v1/auth/platform/totp/activate",
]);

type Params = { params: Promise<{ path?: string[] }> };

function problem(status: number, code: string, title: string, requestId: string, cookies: CookieSpec[] = []) {
  const response = NextResponse.json(
    { type: `https://errors.getproperty.co/${code}`, title, status, code, detail: title, requestId },
    {
      status,
      headers: {
        "content-type": "application/problem+json",
        "cache-control": "no-store",
        [REQUEST_ID_HEADER]: requestId,
      },
    },
  );
  for (const cookie of cookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

/** `["v1", "owner", "me"]` → `/v1/owner/me`; `null` for anything that could step outside the prefix. */
export function upstreamPath(segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0) return null;
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === ".." || /[\\/\0]/.test(segment)) return null;
  }
  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

/**
 * A same-origin browser request: `Origin` equal to this host (`X-Forwarded-Host` / proto behind a proxy) and
 * `Sec-Fetch-Site: same-origin` when the browser sends it. Every state-changing request needs it.
 */
export function sameOrigin(request: Pick<NextRequest, "headers" | "nextUrl">): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(/:$/, "");
  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === host.toLowerCase() && parsed.protocol === `${proto}:`;
  } catch {
    return false;
  }
}

async function readBody(request: NextRequest): Promise<ArrayBuffer | null | "too-large"> {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const declared = Number(request.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declared) && declared > BFF_MAX_BODY_BYTES) return "too-large";
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BFF_MAX_BODY_BYTES) {
      await reader.cancel();
      return "too-large";
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export interface BffOptions {
  fetch?: typeof fetch;
  apiUrl?: () => string;
  /** `TRUSTED_HOPS` (tests pass it; the deployment reads it from the environment). */
  trustedHops?: () => number;
}

export function createBffHandler(zone: Zone, options: BffOptions = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const apiUrl = options.apiUrl ?? (() => serverEnv().API_INTERNAL_URL);
  const trustedHops = options.trustedHops ?? (() => serverEnv().TRUSTED_HOPS);

  async function handle(request: NextRequest, { params }: Params): Promise<Response> {
    const requestId = requestIdFrom(request.headers);
    const clientIp = clientIpFrom(request.headers, trustedHops());
    const path = upstreamPath((await params).path);
    if (!path || !isAllowedUpstream(zone, path)) {
      return problem(404, "http.not_found", "Not Found", requestId);
    }

    const unsafe = request.method !== "GET" && request.method !== "HEAD";
    if (unsafe && (!sameOrigin(request) || request.headers.get(CSRF_HEADER) !== "1")) {
      return problem(403, "bff.csrf_rejected", "Cross-site request refused", requestId);
    }

    const body = await readBody(request);
    if (body === "too-large") return problem(413, "bff.body_too_large", "Request body too large", requestId);

    let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
    const tenantId = zoneHasTenant(zone) ? validTenantId(request.cookies.get(TENANT_COOKIE)?.value) : undefined;
    const setCookies: CookieSpec[] = [];
    let refreshed = false;
    let refreshUnavailable = false;

    const refresh = async (): Promise<"ok" | "refused" | "unavailable"> => {
      refreshed = true;
      if (!refreshToken) return "refused";
      const outcome = await refreshTokens(apiUrl(), refreshToken, fetchImpl, clientIp);
      if (outcome.ok) {
        accessToken = outcome.pair.accessToken;
        setCookies.push(...sessionCookies(outcome.pair));
        return "ok";
      }
      if (outcome.reason === "unavailable") {
        refreshUnavailable = true;
        return "unavailable";
      }
      setCookies.push(...clearedSessionCookies({ keepTenant: true }));
      accessToken = undefined;
      return "refused";
    };

    if (!accessToken && refreshToken) await refresh();

    // Realtime (review L6): the token never travels in a browser URL; it is put back into the API's query here.
    let search = request.nextUrl.search;
    if (request.method === "GET" && REALTIME_STREAM.test(path)) {
      const query = new URLSearchParams(request.nextUrl.searchParams);
      query.delete("token");
      const token = request.cookies.get(STREAM_TOKEN_COOKIE)?.value;
      if (token) query.set("token", token);
      search = query.size > 0 ? `?${query.toString()}` : "";
      // Single use: the browser forgets it as soon as the stream is asked for.
      setCookies.push(streamTokenCookie("", 0));
    }

    const send = () => {
      const headers = new Headers();
      for (const name of FORWARD_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      headers.set(REQUEST_ID_HEADER, requestId);
      if (clientIp) headers.set(FORWARDED_FOR_HEADER, clientIp);
      if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
      if (tenantId) headers.set(TENANT_HEADER, tenantId);
      return fetchImpl(`${apiUrl()}${path}${search}`, {
        method: request.method,
        headers,
        body: body ?? undefined,
        cache: "no-store",
        redirect: "manual",
        signal: request.signal,
      });
    };

    let upstream: Response;
    try {
      upstream = await send();
      if (upstream.status === 401 && !refreshed && refreshToken && !path.startsWith("/v1/auth/")) {
        const outcome = await refresh();
        if (outcome === "ok") {
          await upstream.body?.cancel();
          upstream = await send();
        }
      }
    } catch (error) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.error("bff upstream error", { zone, path, requestId, error });
      return problem(502, "bff.upstream_unavailable", "API unavailable", requestId, setCookies);
    }

    if (
      upstream.status === 401 &&
      !path.startsWith("/v1/auth/") &&
      !refreshUnavailable &&
      !setCookies.some((cookie) => cookie.name === ACCESS_COOKIE || cookie.name === REFRESH_COOKIE)
    ) {
      // The session is over (refresh refused or absent): make the browser forget it. When the refresh
      // could not be attempted (API unavailable) the refresh cookie stays for the next try.
      setCookies.push(...clearedSessionCookies({ keepTenant: true }));
    }

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, name) => {
      if (!DROP_RESPONSE_HEADERS.has(name.toLowerCase())) responseHeaders.set(name, value);
    });
    responseHeaders.set("cache-control", "no-store, private");
    responseHeaders.set(REQUEST_ID_HEADER, upstream.headers.get(REQUEST_ID_HEADER) ?? requestId);
    if ((upstream.headers.get("content-type") ?? "").includes("text/event-stream")) {
      responseHeaders.set("x-accel-buffering", "no");
    }

    let responseBody: BodyInit | null = upstream.body;
    if (request.method === "POST" && REALTIME_AUTH.test(path) && upstream.ok) {
      const grant = (await upstream.json()) as { streamToken?: unknown; streamUrl?: unknown; expiresAt?: unknown };
      const token = typeof grant.streamToken === "string" ? grant.streamToken : "";
      const expires = typeof grant.expiresAt === "string" ? Date.parse(grant.expiresAt) : Number.NaN;
      const maxAge = Number.isFinite(expires)
        ? Math.max(1, Math.min(STREAM_TOKEN_MAX_AGE, Math.ceil((expires - Date.now()) / 1000)))
        : STREAM_TOKEN_MAX_AGE;
      if (token) setCookies.push(streamTokenCookie(token, maxAge));
      const streamUrl = new URL(typeof grant.streamUrl === "string" ? grant.streamUrl : "", "http://api.invalid");
      streamUrl.searchParams.delete("token");
      responseBody = JSON.stringify({
        ...grant,
        streamToken: "",
        streamUrl: `${streamUrl.pathname}${streamUrl.search}`,
      });
      responseHeaders.set("content-type", "application/json");
    } else if (TOKEN_ISSUING.has(path) && upstream.ok) {
      const pair = (await upstream.json()) as Parameters<typeof sessionCookies>[0] & { subject?: unknown };
      setCookies.push(...sessionCookies(pair));
      responseBody = JSON.stringify({ subject: pair.subject });
      responseHeaders.set("content-type", "application/json");
    }

    const response = new NextResponse(request.method === "HEAD" ? null : responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
    for (const cookie of setCookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  }

  return { GET: handle, HEAD: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle };
}
