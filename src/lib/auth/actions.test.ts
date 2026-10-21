// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Review H1: Server Actions (sign-in, TOTP, sign-out) and Server Components call the API from this server, so the
 * end user's address has to be put on those calls explicitly — read from the inbound request's `X-Forwarded-For`,
 * `TRUSTED_HOPS` from the right, never the spoofable left-most entry.
 */
const inbound = new Headers();
const jar = new Map<string, string>();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => inbound,
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  }),
}));
vi.mock("next-intl/server", () => ({ getLocale: async () => "th" }));

const sent: Request[] = [];

beforeEach(async () => {
  sent.length = 0;
  jar.clear();
  for (const name of [...inbound.keys()]) inbound.delete(name);
  inbound.set("x-forwarded-for", "198.51.100.7, 203.0.113.9");
  vi.stubEnv("TRUSTED_HOPS", "1");
  vi.stubEnv("API_INTERNAL_URL", "http://api.test");
  const { resetServerEnv } = await import("@/lib/env/server");
  resetServerEnv();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      sent.push(request);
      if (request.url.endsWith("/otp/request")) {
        return Response.json({ challengeId: "c", expiresAt: "2026-11-01T00:15:00+07:00", resendAvailableAt: "x" });
      }
      return Response.json({}, { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("client address on server-side API calls (review H1)", () => {
  it("a Server Action sign-in sends only the entry our edge appended", async () => {
    const { requestOperatorOtp } = await import("./actions");
    const result = await requestOperatorOtp({ phone: "0812345678" });
    expect(result.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.headers.get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("sign-out forwards it too", async () => {
    jar.set("__Host-gp_rt", "rt-1");
    const { signOut } = await import("./actions");
    await signOut();
    const logout = sent.find((request) => request.url.endsWith("/v1/auth/logout"))!;
    expect(logout.headers.get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("the Server Components' client forwards it", async () => {
    jar.set("__Host-gp_at", "at-1");
    const { serverApi } = await import("@/lib/api/server");
    const api = await serverApi("owner");
    await api.GET("/v1/owner/me");
    expect(sent[0]!.headers.get("x-forwarded-for")).toBe("203.0.113.9");
    expect(sent[0]!.headers.get("authorization")).toBe("Bearer at-1");
  });

  it("forwards nothing with TRUSTED_HOPS=0", async () => {
    vi.stubEnv("TRUSTED_HOPS", "0");
    const { resetServerEnv } = await import("@/lib/env/server");
    resetServerEnv();
    const { requestOperatorOtp } = await import("./actions");
    await requestOperatorOtp({ phone: "0812345678" });
    expect(sent[0]!.headers.get("x-forwarded-for")).toBeNull();
  });
});
