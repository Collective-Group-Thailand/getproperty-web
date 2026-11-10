// @vitest-environment node
import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readDevice } from "../auth/guard-cookies";
import { resetRefreshCache } from "../auth/refresh";
import { createGuardBffHandler } from "./guard";

const API = "http://api.test";
const HOST = "localhost:3000";
const DEVICE = "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11";
const SECRET = "s3cr3t-device-secret-0123456789abcdef";

type Call = { url: string; method: string; headers: Headers; body: string | null };

function pair(n: number) {
  return {
    accessToken: `gat-${n}`,
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: `grt-${n}`,
    refreshTokenExpiresAt: new Date(Date.now() + 12 * 3600_000).toISOString(),
    subject: { id: "g", type: "user", audience: "guard", roles: ["guard"], permissions: [], scopes: [] },
  };
}

function fakeApi() {
  const calls: Call[] = [];
  const valid = new Set(["gat-1"]);
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const raw = init?.body;
    const body = raw == null ? null : typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer);
    calls.push({ url, method: init?.method ?? "GET", headers, body });
    if (url === `${API}/v1/auth/guard/devices/enrol`) {
      const code = (JSON.parse(body ?? "{}") as { code?: string }).code;
      if (code !== "ENROL-1234") {
        return Response.json({ code: "gate.enrol_code_invalid", status: 422 }, { status: 422 });
      }
      return Response.json({
        deviceId: DEVICE,
        deviceSecret: SECRET,
        gateId: "g1",
        gateName: "ป้อม 1",
        propertyId: "p1",
        propertyName: "หมู่บ้าน",
        tenantId: "t1",
        tenantName: "นิติ",
      });
    }
    if (url === `${API}/v1/auth/guard/roster`) {
      const input = JSON.parse(body ?? "{}") as { deviceSecret?: string };
      if (input.deviceSecret !== SECRET) {
        return Response.json({ code: "gate.device_unknown", status: 401 }, { status: 401 });
      }
      return Response.json({ gateName: "ป้อม 1", propertyName: "หมู่บ้าน", guards: [] });
    }
    if (url === `${API}/v1/auth/guard/sign-in`) {
      const input = JSON.parse(body ?? "{}") as { pin?: string };
      if (input.pin === "0000") {
        return Response.json(
          { code: "gate.pin_locked", status: 423, lockedUntil: "2026-11-05T16:00:00Z" },
          { status: 423 },
        );
      }
      return Response.json(pair(1));
    }
    if (url === `${API}/v1/auth/refresh`) {
      valid.add("gat-2");
      return Response.json(pair(2));
    }
    const token = headers.get("authorization")?.replace("Bearer ", "");
    if (!token || !valid.has(token)) return Response.json({ code: "auth.unauthenticated" }, { status: 401 });
    return Response.json({ ok: true, token });
  });
  return { calls, fetchImpl };
}

function request(
  path: string,
  init: { method?: string; cookies?: Record<string, string>; body?: unknown; headers?: Record<string, string> } = {},
) {
  const cookie = Object.entries(init.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  const write = init.method && init.method !== "GET";
  return new NextRequest(`http://${HOST}/bff/guard${path}`, {
    method: init.method ?? "GET",
    headers: {
      host: HOST,
      ...(cookie ? { cookie } : {}),
      ...(write ? { origin: `http://${HOST}`, "x-getproperty-csrf": "1", "content-type": "application/json" } : {}),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function call(path: string, init: Parameters<typeof request>[1] = {}, api = fakeApi()) {
  const handler = createGuardBffHandler({
    fetch: api.fetchImpl as unknown as typeof fetch,
    apiUrl: () => API,
    trustedHops: () => 0,
  });
  const method = (init.method ?? "GET") as "GET" | "POST";
  const response = (await handler[method](request(path, init), {
    params: Promise.resolve({ path: path.split("?")[0]!.split("/").filter(Boolean) }),
  })) as NextResponse;
  return { response, api };
}

const device = { "__Host-gp_gdev": `${DEVICE}.${SECRET}` };

beforeEach(() => resetRefreshCache());

describe("guard BFF session actions", () => {
  it("enrols: the secret goes into the httpOnly device cookie, never into the page", async () => {
    const { response } = await call("/session/enrol", {
      method: "POST",
      body: { code: "ENROL-1234", name: "แท็บเล็ต" },
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(SECRET);
    expect(JSON.parse(text)).toEqual({
      gateId: "g1",
      gateName: "ป้อม 1",
      propertyName: "หมู่บ้าน",
      tenantName: "นิติ",
    });
    const cookie = response.cookies.get("__Host-gp_gdev");
    expect(cookie?.httpOnly).toBe(true);
    expect(readDevice(cookie?.value)).toEqual({ deviceId: DEVICE, deviceSecret: SECRET });
  });

  it("passes an enrolment refusal through and sets nothing", async () => {
    const { response } = await call("/session/enrol", { method: "POST", body: { code: "nope" } });
    expect(response.status).toBe(422);
    expect(response.cookies.get("__Host-gp_gdev")).toBeUndefined();
  });

  it("reads the roster with the device from the cookie", async () => {
    const { response, api } = await call("/session/roster", { method: "POST", cookies: device });
    expect(response.status).toBe(200);
    expect(JSON.parse(api.calls[0]!.body!)).toEqual({ deviceId: DEVICE, deviceSecret: SECRET });
  });

  it("drops the device cookie when the API no longer knows the tablet", async () => {
    const { response } = await call("/session/roster", {
      method: "POST",
      cookies: { "__Host-gp_gdev": `${DEVICE}.revoked-secret-0123456789` },
    });
    expect(response.status).toBe(401);
    expect(response.cookies.get("__Host-gp_gdev")?.value).toBe("");
  });

  it("refuses the roster without an enrolled device, before calling the API", async () => {
    const { response, api } = await call("/session/roster", { method: "POST" });
    expect(response.status).toBe(401);
    expect(api.calls).toHaveLength(0);
  });

  it("signs in: token cookies set, only the subject returned; a lockout keeps lockedUntil", async () => {
    const ok = await call("/session/sign-in", { method: "POST", cookies: device, body: { guardId: "g", pin: "1234" } });
    expect(ok.response.status).toBe(200);
    const text = await ok.response.text();
    expect(text).not.toContain("gat-1");
    expect(ok.response.cookies.get("__Host-gp_gat")?.value).toBe("gat-1");
    expect(ok.response.cookies.get("__Host-gp_grt")?.value).toBe("grt-1");
    const locked = await call("/session/sign-in", {
      method: "POST",
      cookies: device,
      body: { guardId: "g", pin: "0000" },
    });
    expect(locked.response.status).toBe(423);
    expect(await locked.response.json()).toMatchObject({
      code: "gate.pin_locked",
      lockedUntil: "2026-11-05T16:00:00Z",
    });
  });

  it("refuses a cross-site session action", async () => {
    const { response } = await call("/session/sign-in", {
      method: "POST",
      cookies: device,
      body: { guardId: "g", pin: "1234" },
      headers: { origin: "https://evil.example" },
    });
    expect(response.status).toBe(403);
  });

  it("ends the shift on sign-out and keeps the device", async () => {
    const { response, api } = await call("/session/sign-out", {
      method: "POST",
      cookies: { ...device, "__Host-gp_gat": "gat-1" },
    });
    expect(api.calls[0]!.url).toBe(`${API}/v1/guard/shift/actions/end`);
    expect(response.cookies.get("__Host-gp_gat")?.value).toBe("");
    expect(response.cookies.get("__Host-gp_gdev")).toBeUndefined();
  });
});

describe("guard BFF proxy", () => {
  it("forwards only the guard surface", async () => {
    const owner = await call("/v1/owner/me", { cookies: { "__Host-gp_gat": "gat-1" } });
    expect(owner.response.status).toBe(404);
    expect(owner.api.calls).toHaveLength(0);
    const guard = await call("/v1/guard/me", { cookies: { "__Host-gp_gat": "gat-1" } });
    expect(await guard.response.json()).toEqual({ ok: true, token: "gat-1" });
  });

  it("refreshes once with the guard refresh cookie and rotates both cookies", async () => {
    const { response, api } = await call("/v1/guard/me", { cookies: { "__Host-gp_grt": "grt-1" } });
    expect(response.status).toBe(200);
    expect(api.calls.map((c) => c.url)).toEqual([`${API}/v1/auth/refresh`, `${API}/v1/guard/me`]);
    expect(response.cookies.get("__Host-gp_gat")?.value).toBe("gat-2");
  });

  it("forwards Last-Event-ID to the stream and adds an Idempotency-Key to flagged operations", async () => {
    const stream = await call("/v1/guard/events", {
      cookies: { "__Host-gp_gat": "gat-1" },
      headers: { "last-event-id": "e7" },
    });
    expect(stream.api.calls[0]!.headers.get("last-event-id")).toBe("e7");
    const create = await call("/v1/guard/visits", {
      method: "POST",
      cookies: { "__Host-gp_gat": "gat-1" },
      body: { clientRef: "x", kind: "guest" },
    });
    expect(create.api.calls[0]!.headers.get("idempotency-key")).toMatch(/[0-9a-f-]{36}/);
  });

  it("clears the guard cookies when the API refuses the session", async () => {
    const { response } = await call("/v1/guard/me", { cookies: { "__Host-gp_gat": "stale" } });
    expect(response.status).toBe(401);
    expect(response.cookies.get("__Host-gp_gat")?.value).toBe("");
  });
});

/** Review W1: the kiosk lock lives in an httpOnly cookie, so a reload cannot skip the PIN. */
describe("guard BFF kiosk lock (review W1)", () => {
  const signedIn = { ...device, "__Host-gp_gat": "gat-1", "__Host-gp_grt": "grt-1" };
  const locked = { ...signedIn, "__Host-gp_glock": "1" };

  it("locking sets an httpOnly lock cookie and keeps the device and the shift's tokens", async () => {
    const { response, api } = await call("/session/lock", { method: "POST", cookies: signedIn });
    expect(response.status).toBe(200);
    const cookie = response.cookies.get("__Host-gp_glock");
    expect(cookie?.value).toBe("1");
    expect(cookie?.httpOnly).toBe(true);
    expect(response.cookies.get("__Host-gp_gat")).toBeUndefined();
    expect(response.cookies.get("__Host-gp_gdev")).toBeUndefined();
    expect(api.calls).toHaveLength(0);
  });

  it("a locked tablet reads (lists, stream) but writes nothing except answering an SOS", async () => {
    const read = await call("/v1/guard/visits?view=waiting", { cookies: locked });
    expect(read.response.status).toBe(200);
    const write = await call("/v1/guard/visits", {
      method: "POST",
      cookies: locked,
      body: { clientRef: "x", kind: "guest" },
    });
    expect(write.response.status).toBe(423);
    expect(await write.response.json()).toMatchObject({ code: "gate.locked" });
    expect(write.api.calls).toHaveLength(0);
    const open = await call("/v1/guard/gates/g1/actions/open", { method: "POST", cookies: locked, body: {} });
    expect(open.response.status).toBe(423);
    const sos = await call("/v1/guard/incidents/i1/actions/acknowledge", { method: "POST", cookies: locked, body: {} });
    expect(sos.response.status).toBe(200);
  });

  it("the PIN sign-in, sign-out and forget lift the lock", async () => {
    const pin = await call("/session/sign-in", {
      method: "POST",
      cookies: locked,
      body: { guardId: "g", pin: "1234" },
    });
    expect(pin.response.cookies.get("__Host-gp_glock")?.value).toBe("");
    const wrong = await call("/session/sign-in", {
      method: "POST",
      cookies: locked,
      body: { guardId: "g", pin: "0000" },
    });
    expect(wrong.response.cookies.get("__Host-gp_glock")).toBeUndefined();
    const out = await call("/session/sign-out", { method: "POST", cookies: locked });
    expect(out.response.cookies.get("__Host-gp_glock")?.value).toBe("");
    const forget = await call("/session/forget", { method: "POST", cookies: locked });
    expect(forget.response.cookies.get("__Host-gp_glock")?.value).toBe("");
  });
});
