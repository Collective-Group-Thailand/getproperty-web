import { NextResponse, type NextRequest } from "next/server";

import { CSRF_HEADER, IDEMPOTENCY_HEADER, REQUEST_ID_HEADER } from "@/lib/api/headers";
import { requiresIdempotencyKey } from "@/lib/api/idempotency";
import { serverEnv } from "@/lib/env/server";
import { clientIpFrom, FORWARDED_FOR_HEADER, requestIdFrom } from "@/lib/http/edge";

import type { CookieSpec } from "../auth/cookies";
import {
  clearedGuardCookies,
  deviceCookie,
  GUARD_ACCESS_COOKIE,
  GUARD_DEVICE_COOKIE,
  GUARD_REFRESH_COOKIE,
  guardSessionCookies,
  readDevice,
} from "../auth/guard-cookies";
import { refreshTokens } from "../auth/refresh";
import { matchesPrefix } from "../auth/zones";
import { sameOrigin, upstreamPath } from "./handler";

/**
 * The gate tablet's BFF (JW4, D-320), `/bff/guard/*` on the owner host. Same rules as every zone BFF (ADR-0004,
 * `handler.ts`) with the guard's own cookies:
 *
 * - `/bff/guard/v1/guard/...` → the API's guard surface only (nothing else is forwarded); `Authorization` from
 *   `__Host-gp_gat`, one refresh with `__Host-gp_grt` before the call (no access cookie) or after a 401; a refused
 *   refresh clears the guard cookies (the device stays enrolled);
 * - unsafe methods need a same-origin `Origin` and `x-getproperty-csrf: 1`;
 * - bodies up to 3 MB: the visit photo travels inline (≤ 2 MB of image, base64), the only upload of the surface;
 * - SSE (`/v1/guard/events`) streams through with `Last-Event-ID`;
 * - session actions under `/bff/guard/session/*` hold the device secret server-side: `enrol` stores it in the
 *   httpOnly device cookie, `roster` and `sign-in` read it from there, `sign-out` ends the shift, `forget` drops the
 *   device. No token or secret ever reaches the page.
 */

export const GUARD_BFF_MAX_BODY_BYTES = 3 * 1024 * 1024;
const GUARD_UPSTREAM = "/v1/guard";

const FORWARD_REQUEST_HEADERS = ["accept", "accept-language", "content-type", "idempotency-key", "last-event-id"];

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
  "content-encoding",
  "content-length",
]);

/** Problems the device answers with when it is no longer enrolled: the cookie is dropped so the tablet re-enrols. */
const DEVICE_GONE = new Set(["gate.device_unknown", "gate.enrol_code_invalid"]);

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

function withCookies(response: NextResponse, cookies: CookieSpec[]): NextResponse {
  for (const cookie of cookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

async function readBody(request: NextRequest, limit: number): Promise<ArrayBuffer | null | "too-large"> {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const declared = Number(request.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declared) && declared > limit) return "too-large";
  if (!request.body) return null;
  const buffer = await request.arrayBuffer();
  return buffer.byteLength > limit ? "too-large" : buffer;
}

async function jsonOf(buffer: ArrayBuffer | null): Promise<Record<string, unknown>> {
  if (!buffer || buffer.byteLength === 0) return {};
  try {
    const parsed = JSON.parse(new TextDecoder().decode(buffer)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export interface GuardBffOptions {
  fetch?: typeof fetch;
  apiUrl?: () => string;
  trustedHops?: () => number;
}

export function createGuardBffHandler(options: GuardBffOptions = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const apiUrl = options.apiUrl ?? (() => serverEnv().API_INTERNAL_URL);
  const trustedHops = options.trustedHops ?? (() => serverEnv().TRUSTED_HOPS);

  async function handle(request: NextRequest, { params }: Params): Promise<Response> {
    const requestId = requestIdFrom(request.headers);
    const clientIp = clientIpFrom(request.headers, trustedHops());
    const segments = (await params).path ?? [];
    const unsafe = request.method !== "GET" && request.method !== "HEAD";
    if (unsafe && (!sameOrigin(request) || request.headers.get(CSRF_HEADER) !== "1")) {
      return problem(403, "bff.csrf_rejected", "Cross-site request refused", requestId);
    }
    const body = await readBody(request, GUARD_BFF_MAX_BODY_BYTES);
    if (body === "too-large") return problem(413, "bff.body_too_large", "Request body too large", requestId);

    const baseHeaders = () => {
      const headers = new Headers();
      for (const name of FORWARD_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      headers.set(REQUEST_ID_HEADER, requestId);
      if (clientIp) headers.set(FORWARDED_FOR_HEADER, clientIp);
      return headers;
    };

    const callApi = (path: string, init: { method: string; json?: unknown; bearer?: string }) => {
      const headers = baseHeaders();
      if (init.json !== undefined) headers.set("content-type", "application/json");
      if (init.bearer) headers.set("authorization", `Bearer ${init.bearer}`);
      return fetchImpl(`${apiUrl()}${path}`, {
        method: init.method,
        headers,
        body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
        cache: "no-store",
        redirect: "manual",
        signal: request.signal,
      });
    };

    /** An API answer passed through as JSON (problem or body), with cookies. */
    const relay = async (upstream: Response, cookies: CookieSpec[] = [], body?: unknown) => {
      const text = body === undefined ? await upstream.text() : JSON.stringify(body);
      const response = new NextResponse(text || null, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "application/json",
          "cache-control": "no-store, private",
          [REQUEST_ID_HEADER]: upstream.headers.get(REQUEST_ID_HEADER) ?? requestId,
          ...(upstream.headers.get("retry-after") ? { "retry-after": upstream.headers.get("retry-after")! } : {}),
        },
      });
      return withCookies(response, cookies);
    };

    const deviceGone = async (upstream: Response): Promise<CookieSpec[]> => {
      if (upstream.ok) return [];
      const copy = (await upstream
        .clone()
        .json()
        .catch(() => ({}))) as { code?: string };
      return copy.code && DEVICE_GONE.has(copy.code) ? clearedGuardCookies({ device: true }) : [];
    };

    try {
      // ── session actions ────────────────────────────────────────────────────────────────────────────────────────
      if (segments[0] === "session") {
        if (request.method !== "POST" || segments.length !== 2) {
          return problem(404, "http.not_found", "Not Found", requestId);
        }
        const action = segments[1];
        const input = await jsonOf(body);
        const device = readDevice(request.cookies.get(GUARD_DEVICE_COOKIE)?.value);

        if (action === "enrol") {
          const upstream = await callApi("/v1/auth/guard/devices/enrol", {
            method: "POST",
            json: { code: input.code, ...(typeof input.name === "string" && input.name ? { name: input.name } : {}) },
          });
          if (!upstream.ok) return relay(upstream);
          const enrolled = (await upstream.json()) as {
            deviceId: string;
            deviceSecret: string;
            gateId: string;
            gateName: string;
            propertyName: string;
            tenantName: string;
          };
          return relay(upstream, [...clearedGuardCookies(), deviceCookie(enrolled)], {
            gateId: enrolled.gateId,
            gateName: enrolled.gateName,
            propertyName: enrolled.propertyName,
            tenantName: enrolled.tenantName,
          });
        }
        if (action === "forget") {
          return withCookies(NextResponse.json({ ok: true }), clearedGuardCookies({ device: true }));
        }
        if (action === "sign-out") {
          const access = request.cookies.get(GUARD_ACCESS_COOKIE)?.value;
          if (access) {
            await callApi(`${GUARD_UPSTREAM}/shift/actions/end`, { method: "POST", bearer: access })
              .then((r) => r.body?.cancel())
              .catch(() => undefined);
          }
          return withCookies(NextResponse.json({ ok: true }), clearedGuardCookies());
        }
        if (!device) return problem(401, "gate.device_unknown", "This tablet is not enrolled", requestId);
        if (action === "roster") {
          const upstream = await callApi("/v1/auth/guard/roster", { method: "POST", json: device });
          return relay(upstream, await deviceGone(upstream));
        }
        if (action === "sign-in") {
          const upstream = await callApi("/v1/auth/guard/sign-in", {
            method: "POST",
            json: { ...device, guardId: input.guardId, pin: input.pin },
          });
          if (!upstream.ok) return relay(upstream, await deviceGone(upstream));
          const pair = (await upstream.json()) as Parameters<typeof guardSessionCookies>[0] & { subject?: unknown };
          return relay(upstream, guardSessionCookies(pair), { subject: pair.subject });
        }
        return problem(404, "http.not_found", "Not Found", requestId);
      }

      // ── the guard surface ──────────────────────────────────────────────────────────────────────────────────────
      const path = upstreamPath(segments);
      if (!path || !matchesPrefix(path, GUARD_UPSTREAM)) return problem(404, "http.not_found", "Not Found", requestId);

      let access = request.cookies.get(GUARD_ACCESS_COOKIE)?.value;
      const refreshToken = request.cookies.get(GUARD_REFRESH_COOKIE)?.value;
      const setCookies: CookieSpec[] = [];
      let refreshed = false;
      let unavailable = false;
      const refresh = async () => {
        refreshed = true;
        if (!refreshToken) return false;
        const outcome = await refreshTokens(apiUrl(), refreshToken, fetchImpl, clientIp);
        if (outcome.ok) {
          access = outcome.pair.accessToken;
          setCookies.push(...guardSessionCookies(outcome.pair));
          return true;
        }
        if (outcome.reason === "unavailable") {
          unavailable = true;
          return false;
        }
        access = undefined;
        setCookies.push(...clearedGuardCookies());
        return false;
      };
      if (!access && refreshToken) await refresh();

      const idempotency =
        request.headers.get(IDEMPOTENCY_HEADER) ??
        (requiresIdempotencyKey(request.method, path) ? crypto.randomUUID() : null);
      const send = () => {
        const headers = baseHeaders();
        if (idempotency) headers.set(IDEMPOTENCY_HEADER, idempotency);
        if (access) headers.set("authorization", `Bearer ${access}`);
        return fetchImpl(`${apiUrl()}${path}${request.nextUrl.search}`, {
          method: request.method,
          headers,
          body: body ?? undefined,
          cache: "no-store",
          redirect: "manual",
          signal: request.signal,
        });
      };

      let upstream = await send();
      if (upstream.status === 401 && !refreshed && refreshToken) {
        if (await refresh()) {
          await upstream.body?.cancel();
          upstream = await send();
        }
      }
      if (
        upstream.status === 401 &&
        !unavailable &&
        !setCookies.some((cookie) => cookie.name === GUARD_ACCESS_COOKIE)
      ) {
        setCookies.push(...clearedGuardCookies());
      }

      const headers = new Headers();
      upstream.headers.forEach((value, name) => {
        if (!DROP_RESPONSE_HEADERS.has(name.toLowerCase())) headers.set(name, value);
      });
      headers.set("cache-control", "no-store, private");
      headers.set(REQUEST_ID_HEADER, upstream.headers.get(REQUEST_ID_HEADER) ?? requestId);
      if ((upstream.headers.get("content-type") ?? "").includes("text/event-stream"))
        headers.set("x-accel-buffering", "no");
      const response = new NextResponse(request.method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
      return withCookies(response, setCookies);
    } catch (error) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.error("guard bff upstream error", { requestId, error });
      return problem(502, "bff.upstream_unavailable", "API unavailable", requestId);
    }
  }

  return { GET: handle, HEAD: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle };
}
