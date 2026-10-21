// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRefreshCache } from "../auth/refresh";
import { BFF_MAX_BODY_BYTES, createBffHandler, STREAM_TOKEN_COOKIE, upstreamPath } from "./handler";

const API = "http://api.test";
const HOST = "localhost:3000";
const TENANT = "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11";

type Call = { url: string; method: string; headers: Headers; body: string | null };

function pair(n: number) {
  const soon = new Date(Date.now() + 15 * 60_000).toISOString();
  const later = new Date(Date.now() + 30 * 86_400_000).toISOString();
  return {
    accessToken: `at-${n}`,
    accessTokenExpiresAt: soon,
    refreshToken: `rt-${n}`,
    refreshTokenExpiresAt: later,
    subject: { id: "u", type: "user", audience: "operator", roles: [], permissions: [], scopes: [] },
  };
}

/** A fake getproperty-api: `/v1/auth/refresh` rotates; other paths answer by the bearer. */
function fakeApi(options: { validTokens?: string[]; refresh?: "ok" | "invalid" | "down" } = {}) {
  const calls: Call[] = [];
  const valid = new Set(options.validTokens ?? ["at-1"]);
  let n = 1;
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const raw = init?.body;
    const body = raw == null ? null : typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer);
    calls.push({ url, method: init?.method ?? "GET", headers, body });
    if (url === `${API}/v1/auth/refresh`) {
      if (options.refresh === "down") throw new Error("ECONNREFUSED");
      if (options.refresh === "invalid") {
        return Response.json({ code: "auth.refresh_reused", status: 401 }, { status: 401 });
      }
      n += 1;
      valid.add(`at-${n}`);
      return Response.json(pair(n));
    }
    if (url === `${API}/v1/auth/operator/otp/verify`) return Response.json(pair(9));
    const token = headers.get("authorization")?.replace("Bearer ", "");
    if (!token || !valid.has(token)) {
      return new Response(JSON.stringify({ code: "auth.unauthenticated", status: 401 }), {
        status: 401,
        headers: { "content-type": "application/problem+json" },
      });
    }
    if (url.includes("/stream")) {
      return new Response("event: ready\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } });
    }
    return new Response(JSON.stringify({ ok: true, token }), {
      headers: { "content-type": "application/json", "content-encoding": "gzip", "set-cookie": "upstream=1" },
    });
  });
  return { calls, fetchImpl };
}

function request(
  path: string,
  init: {
    method?: string;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    body?: string;
    host?: string;
  } = {},
) {
  const host = init.host ?? HOST;
  const cookie = Object.entries(init.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(`http://${host}/bff${path}`, {
    method: init.method ?? "GET",
    headers: { host, ...(cookie ? { cookie } : {}), ...init.headers },
    body: init.body,
  });
}

const segments = (path: string) => ({ params: Promise.resolve({ path: path.split("/").filter(Boolean) }) });

async function call(
  zone: "owner" | "staff" | "admin",
  path: string,
  init: Parameters<typeof request>[1],
  api = fakeApi(),
  trustedHops = 0,
) {
  const handler = createBffHandler(zone, {
    fetch: api.fetchImpl as unknown as typeof fetch,
    apiUrl: () => API,
    trustedHops: () => trustedHops,
  });
  const method = (init?.method ?? "GET") as "GET" | "POST";
  const [pathname, search] = path.split("?");
  const response = await handler[method](request(path, init), segments(pathname!));
  void search;
  return { response, api };
}

const signedIn = { "__Host-gp_at": "at-1", "__Host-gp_rt": "rt-1" };
const writeHeaders = { origin: `http://${HOST}`, "x-getproperty-csrf": "1", "content-type": "application/json" };

beforeEach(() => resetRefreshCache());

describe("upstreamPath", () => {
  it("joins and re-encodes segments", () => {
    expect(upstreamPath(["v1", "owner", "me"])).toBe("/v1/owner/me");
    expect(upstreamPath(["v1", "owner", "a b"])).toBe("/v1/owner/a%20b");
  });
  it("refuses traversal and empty segments", () => {
    expect(upstreamPath(["v1", "owner", "..", "admin"])).toBeNull();
    expect(upstreamPath(["v1", "", "x"])).toBeNull();
    expect(upstreamPath(["v1", "owner%2F..", "x"])).not.toBeNull();
    expect(upstreamPath(["v1", "owner/../admin"])).toBeNull();
    expect(upstreamPath(undefined)).toBeNull();
  });
});

describe("allow-list", () => {
  it.each([
    ["owner", "/v1/owner/me", 200],
    ["owner", "/v1/auth/operator/otp/request", 200],
    ["owner", "/v1/admin/me", 404],
    ["owner", "/v1/staff/me", 404],
    ["owner", "/v1/ownerx/me", 404],
    ["owner", "/v1/auth/refresh", 404],
    ["owner", "/v1/auth/platform/login", 404],
    ["staff", "/v1/staff/me", 200],
    ["staff", "/v1/owner/me", 200],
    ["staff", "/v1/owner/invoices", 404],
    ["admin", "/v1/admin/me", 200],
    ["admin", "/v1/auth/platform/login", 200],
    ["admin", "/v1/owner/me", 404],
  ] as const)("%s %s → %i", async (zone, path, status) => {
    const { response } = await call(zone, path, { cookies: signedIn });
    expect(response.status).toBe(status);
  });

  // The API routes case-sensitively (release fix, triage F7 #3): the BFF forwards the path exactly as the
  // browser sent it and matches its allow-list exactly, so an upper-case variant is refused here instead of
  // reaching the API as another (404) path — and never lower-cased into an allowed one.
  it.each([
    ["owner", "/V1/OWNER/me"],
    ["owner", "/v1/Owner/me"],
    ["staff", "/v1/Staff/me"],
    ["admin", "/V1/ADMIN/me"],
    ["owner", "/v1/RESIDENT/me"],
  ] as const)("%s refuses %s without calling the API (case-sensitive routes)", async (zone, path) => {
    const { response, api } = await call(zone, path, { cookies: signedIn });
    expect(response.status).toBe(404);
    expect(api.calls).toHaveLength(0);
  });

  it("forwards the path with its case unchanged (ids and keys are case-sensitive upstream)", async () => {
    const { response, api } = await call("owner", "/v1/owner/settings/payments.duplicate_window_hours/AbC", {
      cookies: signedIn,
    });
    expect(response.status).toBe(200);
    expect(api.calls[0]!.url).toBe(`${API}/v1/owner/settings/payments.duplicate_window_hours/AbC`);
  });

  it.each(["owner", "staff", "admin"] as const)(
    "%s refuses the resident and technician surfaces (D-154)",
    async (zone) => {
      for (const path of ["/v1/resident/me", "/v1/resident/invoices", "/v1/technician/me", "/v1/device/config"]) {
        const { response, api } = await call(zone, path, { cookies: signedIn });
        expect(response.status).toBe(404);
        expect(api.calls).toHaveLength(0);
      }
    },
  );
});

describe("CSRF", () => {
  it("refuses a write without the CSRF header", async () => {
    const { response, api } = await call("owner", "/v1/owner/settings/x", {
      method: "POST",
      cookies: signedIn,
      headers: { origin: `http://${HOST}` },
      body: "{}",
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("bff.csrf_rejected");
    expect(api.calls).toHaveLength(0);
  });

  it("refuses a write from another origin, even with the header", async () => {
    for (const origin of ["http://evil.test", "http://admin.localhost:3000", "null"]) {
      const { response } = await call("owner", "/v1/owner/settings/x", {
        method: "POST",
        cookies: signedIn,
        headers: { ...writeHeaders, origin },
        body: "{}",
      });
      expect(response.status).toBe(403);
    }
  });

  it("refuses a write with a cross-site Sec-Fetch-Site or no Origin", async () => {
    const crossSite = await call("owner", "/v1/owner/settings/x", {
      method: "POST",
      cookies: signedIn,
      headers: { ...writeHeaders, "sec-fetch-site": "same-site" },
      body: "{}",
    });
    expect(crossSite.response.status).toBe(403);
    const noOrigin = await call("owner", "/v1/owner/settings/x", {
      method: "POST",
      cookies: signedIn,
      headers: { "x-getproperty-csrf": "1" },
      body: "{}",
    });
    expect(noOrigin.response.status).toBe(403);
  });

  it("forwards a same-origin write with the header, body and idempotency key", async () => {
    const { response, api } = await call("owner", "/v1/owner/settings/x", {
      method: "POST",
      cookies: signedIn,
      headers: { ...writeHeaders, "idempotency-key": "k-1" },
      body: '{"a":1}',
    });
    expect(response.status).toBe(200);
    expect(api.calls[0]!.body).toBe('{"a":1}');
    expect(api.calls[0]!.headers.get("idempotency-key")).toBe("k-1");
  });

  it("does not need the header for reads", async () => {
    const { response } = await call("owner", "/v1/owner/me", { cookies: signedIn });
    expect(response.status).toBe(200);
  });
});

describe("upstream request", () => {
  it("attaches the bearer and X-Tenant-Id from cookies, drops what the client sent", async () => {
    const { api } = await call("owner", "/v1/owner/me", {
      cookies: { ...signedIn, "__Host-gp_tenant": TENANT },
      headers: { authorization: "Bearer forged", "x-tenant-id": "forged" },
    });
    const sent = api.calls[0]!.headers;
    expect(sent.get("authorization")).toBe("Bearer at-1");
    expect(sent.get("x-tenant-id")).toBe(TENANT);
    expect(sent.get("cookie")).toBeNull(); // the browser's cookies (the session) never go upstream
    expect(sent.get("x-request-id")).toMatch(/[0-9a-f-]{36}/);
  });

  it("never sends a tenant header from the admin zone or an invalid cookie", async () => {
    const admin = await call("admin", "/v1/admin/me", { cookies: { ...signedIn, "__Host-gp_tenant": TENANT } });
    expect(admin.api.calls[0]!.headers.get("x-tenant-id")).toBeNull();
    const garbage = await call("owner", "/v1/owner/me", { cookies: { ...signedIn, "__Host-gp_tenant": "not-a-uuid" } });
    expect(garbage.api.calls[0]!.headers.get("x-tenant-id")).toBeNull();
  });

  it("limits the body size", async () => {
    const { response, api } = await call("owner", "/v1/owner/settings/x", {
      method: "POST",
      cookies: signedIn,
      headers: { ...writeHeaders, "content-length": String(BFF_MAX_BODY_BYTES + 1) },
      body: "x".repeat(10),
    });
    expect(response.status).toBe(413);
    expect(api.calls).toHaveLength(0);
    const streamed = await call("owner", "/v1/owner/settings/x", {
      method: "POST",
      cookies: signedIn,
      headers: writeHeaders,
      body: "x".repeat(BFF_MAX_BODY_BYTES + 1),
    });
    expect(streamed.response.status).toBe(413);
  });
});

describe("refresh", () => {
  it("refreshes once on 401, replays, and rotates both cookies with the right flags", async () => {
    const api = fakeApi({ validTokens: [] });
    const { response } = await call("owner", "/v1/owner/me", { cookies: signedIn }, api);
    expect(response.status, JSON.stringify(api.calls.map((c) => [c.url, c.headers.get("authorization")]))).toBe(200);
    expect((await response.json()).token).toBe("at-2");
    expect(api.calls.map((c) => c.url)).toEqual([`${API}/v1/owner/me`, `${API}/v1/auth/refresh`, `${API}/v1/owner/me`]);
    const setCookie = response.headers.getSetCookie();
    const access = setCookie.find((c) => c.startsWith("__Host-gp_at=at-2"))!;
    const refresh = setCookie.find((c) => c.startsWith("__Host-gp_rt=rt-2"))!;
    for (const cookie of [access, refresh]) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=lax/i);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).not.toMatch(/Domain=/i);
    }
    expect(Number(/Max-Age=(\d+)/.exec(access)![1])).toBeLessThanOrEqual(15 * 60 - 30);
  });

  it("refreshes before the call when the access cookie is gone", async () => {
    const api = fakeApi({ validTokens: [] });
    const { response } = await call("owner", "/v1/owner/me", { cookies: { "__Host-gp_rt": "rt-1" } }, api);
    expect(response.status).toBe(200);
    expect(api.calls.map((c) => c.url)).toEqual([`${API}/v1/auth/refresh`, `${API}/v1/owner/me`]);
  });

  it("refreshes only once even if the replay is refused again", async () => {
    const api = fakeApi({ validTokens: [] });
    api.fetchImpl.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/v1/auth/refresh")) return Response.json(pair(5));
      return new Response("{}", { status: 401, headers: { "content-type": "application/problem+json" } });
    });
    const { response } = await call("owner", "/v1/owner/me", { cookies: signedIn }, api);
    expect(response.status).toBe(401);
    expect(api.fetchImpl.mock.calls.filter(([input]) => String(input).endsWith("/v1/auth/refresh"))).toHaveLength(1);
  });

  it("clears the session when the refresh is refused", async () => {
    const api = fakeApi({ validTokens: [], refresh: "invalid" });
    const { response } = await call("owner", "/v1/owner/me", { cookies: signedIn }, api);
    expect(response.status).toBe(401);
    const setCookie = response.headers.getSetCookie();
    expect(setCookie.some((c) => /^__Host-gp_at=;/.test(c) && /Max-Age=0/.test(c))).toBe(true);
    expect(setCookie.some((c) => /^__Host-gp_rt=;/.test(c) && /Max-Age=0/.test(c))).toBe(true);
  });

  it("keeps the session when the API is down", async () => {
    const api = fakeApi({ validTokens: [], refresh: "down" });
    const { response } = await call("owner", "/v1/owner/me", { cookies: { "__Host-gp_rt": "rt-1" } }, api);
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie().some((c) => c.startsWith("__Host-gp_rt="))).toBe(false);
  });

  it("exchanges one refresh token once for concurrent requests", async () => {
    const api = fakeApi({ validTokens: [] });
    const handler = createBffHandler("owner", { fetch: api.fetchImpl as unknown as typeof fetch, apiUrl: () => API });
    const responses = await Promise.all(
      [1, 2, 3].map(() =>
        handler.GET(request("/v1/owner/me", { cookies: { "__Host-gp_rt": "rt-1" } }), segments("/v1/owner/me")),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(api.calls.filter((c) => c.url.endsWith("/v1/auth/refresh"))).toHaveLength(1);
  });
});

describe("response", () => {
  it("is never cached and never forwards upstream cookies or encodings", async () => {
    const { response } = await call("owner", "/v1/owner/me", { cookies: signedIn });
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.getSetCookie().some((c) => c.startsWith("upstream="))).toBe(false);
  });

  it("streams server-sent events through", async () => {
    const { response } = await call("owner", "/v1/owner/realtime/stream?token=t", { cookies: signedIn });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(await response.text()).toContain("event: ready");
  });

  it("turns a token pair into cookies and returns only the subject", async () => {
    const { response } = await call("owner", "/v1/auth/operator/otp/verify", {
      method: "POST",
      headers: writeHeaders,
      body: '{"challengeId":"c","code":"123456"}',
    });
    const body = await response.json();
    expect(Object.keys(body)).toEqual(["subject"]);
    expect(response.headers.getSetCookie().some((c) => c.startsWith("__Host-gp_at=at-9"))).toBe(true);
  });
});

describe("edge trust (review H1, L1)", () => {
  const spoofed = { "x-forwarded-for": "198.51.100.7, 203.0.113.9", "x-real-ip": "198.51.100.7" };

  it.each(["owner", "staff", "admin"] as const)(
    "%s: sends the entry our edge appended as the only X-Forwarded-For, never the spoofed left-most one",
    async (zone) => {
      const path = zone === "admin" ? "/v1/admin/me" : `/v1/${zone}/me`;
      const { api } = await call(zone, path, { cookies: signedIn, headers: spoofed }, fakeApi(), 1);
      const sent = api.calls.at(-1)!.headers;
      expect(sent.get("x-forwarded-for")).toBe("203.0.113.9");
      expect(sent.get("x-real-ip")).toBeNull();
    },
  );

  it("counts two hops behind the load balancer, and forwards nothing with 0 hops or a short header", async () => {
    const lb = { "x-forwarded-for": "198.51.100.7, 203.0.113.9, 130.211.0.5" };
    const two = await call("owner", "/v1/owner/me", { cookies: signedIn, headers: lb }, fakeApi(), 2);
    expect(two.api.calls.at(-1)!.headers.get("x-forwarded-for")).toBe("203.0.113.9");
    const none = await call("owner", "/v1/owner/me", { cookies: signedIn, headers: lb }, fakeApi(), 0);
    expect(none.api.calls.at(-1)!.headers.get("x-forwarded-for")).toBeNull();
    const short = await call(
      "owner",
      "/v1/owner/me",
      { cookies: signedIn, headers: { "x-forwarded-for": "1.2.3.4" } },
      fakeApi(),
      2,
    );
    expect(short.api.calls.at(-1)!.headers.get("x-forwarded-for")).toBeNull();
    const junk = await call(
      "owner",
      "/v1/owner/me",
      { cookies: signedIn, headers: { "x-forwarded-for": "evil, <x>" } },
      fakeApi(),
      1,
    );
    expect(junk.api.calls.at(-1)!.headers.get("x-forwarded-for")).toBeNull();
  });

  it("forwards the address on anonymous sign-in calls and on the token refresh too", async () => {
    const signIn = await call(
      "owner",
      "/v1/auth/operator/otp/request",
      { method: "POST", headers: { ...writeHeaders, ...spoofed }, body: "{}" },
      fakeApi(),
      1,
    );
    expect(signIn.api.calls.at(-1)!.headers.get("x-forwarded-for")).toBe("203.0.113.9");
    const refreshed = await call(
      "owner",
      "/v1/owner/me",
      { cookies: { "__Host-gp_rt": "rt-1" }, headers: spoofed },
      fakeApi(),
      1,
    );
    const refresh = refreshed.api.calls.find((entry) => entry.url.endsWith("/v1/auth/refresh"))!;
    expect(refresh.headers.get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("replaces a client x-request-id that is not a UUID and keeps one that is", async () => {
    const evil = await call("owner", "/v1/owner/me", {
      cookies: signedIn,
      headers: { "x-request-id": 'evil" injected=1' },
    });
    const sent = evil.api.calls.at(-1)!.headers.get("x-request-id")!;
    expect(sent).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(evil.response.headers.get("x-request-id")).not.toContain("injected");
    const id = "3b241101-e2bb-4255-8caf-4136c566a962";
    const kept = await call("owner", "/v1/owner/me", { cookies: signedIn, headers: { "x-request-id": id } });
    expect(kept.api.calls.at(-1)!.headers.get("x-request-id")).toBe(id);
  });
});

describe("realtime stream token (review L6)", () => {
  function realtimeApi() {
    const api = fakeApi();
    const inner = api.fetchImpl.getMockImplementation()!;
    api.fetchImpl.mockImplementation(async (input, init) => {
      if (String(input).endsWith("/realtime/auth")) {
        await inner(input, init);
        return Response.json({
          streamToken: "st-secret",
          streamUrl: "/v1/staff/realtime/stream?token=st-secret",
          channels: ["user:u"],
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
      }
      return inner(input, init);
    });
    return api;
  }

  it("answers the token in an httpOnly cookie and a streamUrl without it", async () => {
    const { response } = await call(
      "staff",
      "/v1/staff/realtime/auth",
      { method: "POST", cookies: signedIn, headers: writeHeaders },
      realtimeApi(),
    );
    const body = (await response.json()) as { streamToken: string; streamUrl: string };
    expect(body.streamUrl).toBe("/v1/staff/realtime/stream");
    expect(body.streamToken).toBe("");
    expect(JSON.stringify(body)).not.toContain("st-secret");
    const cookie = response.headers.getSetCookie().find((c) => c.startsWith(`${STREAM_TOKEN_COOKIE}=`))!;
    expect(cookie).toContain("st-secret");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Max-Age=(60|59)/);
  });

  it("puts the cookie's token back into the API query, ignores one in the browser URL, and clears the cookie", async () => {
    const { response, api } = await call("staff", "/v1/staff/realtime/stream?token=from-url", {
      cookies: { ...signedIn, [STREAM_TOKEN_COOKIE]: "st-secret" },
    });
    expect(api.calls.at(-1)!.url).toBe(`${API}/v1/staff/realtime/stream?token=st-secret`);
    const cleared = response.headers.getSetCookie().find((c) => c.startsWith(`${STREAM_TOKEN_COOKIE}=`))!;
    expect(cleared).toMatch(/Max-Age=0/);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
  });
});
