// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { safeNextPath, otpRequestSchema, passwordLoginSchema } from "@/domain/forms/auth";

import {
  ACCESS_EXPIRY_SKEW_SECONDS,
  clearedSessionCookies,
  sessionCookies,
  tenantCookie,
  validTenantId,
} from "./cookies";
import { refreshBeforeRender, withCookies } from "./proxy-session";
import { refreshTokens, resetRefreshCache } from "./refresh";
import { isAllowedUpstream } from "./zones";

const now = Date.parse("2026-11-01T00:00:00+07:00");
const pair = {
  accessToken: "at",
  accessTokenExpiresAt: "2026-11-01T00:15:00+07:00",
  refreshToken: "rt",
  refreshTokenExpiresAt: "2026-12-01T00:00:00+07:00",
};

describe("cookies", () => {
  it("are host-only, httpOnly, secure, lax; the access cookie dies before the token", () => {
    const [access, refresh] = sessionCookies(pair, now);
    expect(access!.name).toBe("__Host-gp_at");
    expect(access!.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(access!.options.maxAge).toBe(15 * 60 - ACCESS_EXPIRY_SKEW_SECONDS);
    expect(refresh!.name).toBe("__Host-gp_rt");
    expect(refresh!.options.maxAge).toBe(30 * 86_400);
    expect(tenantCookie("x").name).toBe("__Host-gp_tenant");
  });

  it("clears every session cookie, optionally keeping the tenant", () => {
    expect(clearedSessionCookies().map((c) => [c.name, c.options.maxAge])).toEqual([
      ["__Host-gp_at", 0],
      ["__Host-gp_rt", 0],
      ["__Host-gp_tenant", 0],
    ]);
    expect(clearedSessionCookies({ keepTenant: true }).map((c) => c.name)).not.toContain("__Host-gp_tenant");
  });

  it("only a uuid is a tenant id", () => {
    expect(validTenantId("0D0C7A4E-5B0E-4C55-9D7C-3F2B8A1E6C11")).toBe("0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11");
    expect(validTenantId("x; drop")).toBeUndefined();
    expect(validTenantId(undefined)).toBeUndefined();
  });
});

describe("zone allow-lists (ADR-0004)", () => {
  it("match on whole path segments", () => {
    expect(isAllowedUpstream("owner", "/v1/owner")).toBe(true);
    expect(isAllowedUpstream("owner", "/v1/owner/me")).toBe(true);
    expect(isAllowedUpstream("owner", "/v1/owners")).toBe(false);
    expect(isAllowedUpstream("staff", "/v1/owner/me")).toBe(true);
    expect(isAllowedUpstream("staff", "/v1/owner/me/password")).toBe(true);
    expect(isAllowedUpstream("staff", "/v1/owner/invoices")).toBe(false);
    expect(isAllowedUpstream("admin", "/v1/auth/operator/login")).toBe(false);
  });
});

describe("refreshTokens", () => {
  beforeEach(() => resetRefreshCache());

  it("exchanges a refresh token once for concurrent callers and reuses the result briefly", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ...pair, accessToken: "new" }));
    const outcomes = await Promise.all([1, 2, 3].map(() => refreshTokens("http://api", "rt", fetchImpl)));
    expect(outcomes.every((o) => o.ok && o.pair.accessToken === "new")).toBe(true);
    await refreshTokens("http://api", "rt", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports reuse and does not cache a transient failure", async () => {
    const reused = vi.fn(async () => Response.json({ code: "auth.refresh_reused" }, { status: 401 }));
    expect(await refreshTokens("http://api", "a", reused)).toEqual({ ok: false, reason: "reused", status: 401 });
    const down = vi.fn(async () => new Response("", { status: 503 }));
    expect(await refreshTokens("http://api", "b", down)).toMatchObject({ ok: false, reason: "unavailable" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await refreshTokens("http://api", "b", down);
    expect(down).toHaveBeenCalledTimes(2);
  });
});

describe("refreshBeforeRender", () => {
  beforeEach(() => resetRefreshCache());
  const req = (cookie: string) => new NextRequest("http://localhost/dashboard", { headers: { cookie } });

  it("does nothing while the access cookie lives, or without a refresh cookie", async () => {
    const fetchImpl = vi.fn();
    expect(await refreshBeforeRender(req("__Host-gp_at=a; __Host-gp_rt=r"), "http://api", fetchImpl)).toBeNull();
    expect(await refreshBeforeRender(req("other=1"), "http://api", fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("puts the new tokens on the request and the response", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        ...pair,
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        accessToken: "new-at",
        refreshToken: "new-rt",
      }),
    );
    const result = await refreshBeforeRender(req("__Host-gp_rt=old; gp_theme=dark"), "http://api", fetchImpl);
    expect(result!.cookieHeader).toContain("__Host-gp_at=new-at");
    expect(result!.cookieHeader).toContain("__Host-gp_rt=new-rt");
    expect(result!.cookieHeader).toContain("gp_theme=dark");
    expect(result!.cookies.map((c) => c.name)).toEqual(["__Host-gp_at", "__Host-gp_rt"]);
  });

  it("clears the session when the refresh is refused, leaves it when the API is down", async () => {
    const refused = vi.fn(async () => Response.json({ code: "auth.refresh_invalid" }, { status: 401 }));
    const cleared = await refreshBeforeRender(req("__Host-gp_rt=x; __Host-gp_tenant=t"), "http://api", refused);
    expect(cleared!.cookieHeader).toBe("__Host-gp_tenant=t");
    const down = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await refreshBeforeRender(req("__Host-gp_rt=y"), "http://api", down)).toBeNull();
  });

  it("withCookies replaces and removes", () => {
    expect(
      withCookies(req("a=1; b=2"), [
        { name: "a", value: "", options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 } },
        { name: "c", value: "3", options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 1 } },
      ]),
    ).toBe("b=2; c=3");
  });
});

describe("sign-in form schemas", () => {
  it("normalise a Thai mobile number to E.164", () => {
    expect(otpRequestSchema.parse({ phone: "081-000-0001" }).phone).toBe("+66810000001");
    expect(otpRequestSchema.safeParse({ phone: "12" }).error?.issues[0]?.message).toBe("phoneInvalid");
  });

  it("validate email + password + optional TOTP", () => {
    expect(passwordLoginSchema.parse({ email: "a@example.com", password: "x", totpCode: "" }).totpCode).toBeUndefined();
    expect(passwordLoginSchema.safeParse({ email: "a@example.com", password: "x", totpCode: "12" }).success).toBe(
      false,
    );
    expect(passwordLoginSchema.safeParse({ email: "nope", password: "x" }).error?.issues[0]?.message).toBe(
      "emailInvalid",
    );
  });

  it("only allow same-site return paths", () => {
    expect(safeNextPath("/dashboard?x=1")).toBe("/dashboard?x=1");
    for (const bad of ["//evil.test", "https://evil.test", "/\\evil", "dashboard", "/a\r\nb", undefined, 3]) {
      expect(safeNextPath(bad)).toBeUndefined();
    }
  });
});
