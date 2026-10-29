// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Review M1 (G): a sign-up through Google / Apple / LINE keeps the `next` it started with — a getbuild buyer who
 * signs up from the invitation lands on the claim page, not on an empty portfolio. `next` travels in the attempt
 * cookie (the OAuth state) and is validated with `safeNextPath` (web-kit `safeReturnTo`) on the way in and out.
 */
const jar = new Map<string, string>();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  }),
}));

const signups: string[] = [];

beforeEach(async () => {
  jar.clear();
  signups.length = 0;
  vi.stubEnv("API_INTERNAL_URL", "http://api.test");
  vi.stubEnv("OAUTH_MODE", "fake");
  vi.stubEnv("OWNER_HOST", "owner.example.com");
  const { resetServerEnv } = await import("@/lib/env/server");
  resetServerEnv();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.url.includes("/v1/public/signup/")) {
        signups.push(new URL(request.url).pathname);
        return Response.json(
          {
            tokens: { accessToken: "at-1", refreshToken: "rt-1", expiresIn: 900 },
            tenant: { id: "7e0a0000-0000-4000-8000-000000000001" },
          },
          { status: 201 },
        );
      }
      return Response.json({}, { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function signUpThroughFakeProvider(next: string | undefined, signUpAs?: "agency"): Promise<URL> {
  const { finishAttempt, startAttempt } = await import("./flow");
  const { encodeFakeCode } = await import("./providers");
  const authorize = new URL(
    await startAttempt({ provider: "line", intent: "signup", locale: "en", next, displayName: "Somchai", signUpAs }),
  );
  const state = authorize.searchParams.get("state");
  const code = encodeFakeCode({ uid: "U-buyer-1", name: "Somchai" });
  return new URL(await finishAttempt("line", { code, state }));
}

describe("OAuth sign-up keeps next (review M1)", () => {
  it("a landlord who signed up from an invitation lands on the claim page", async () => {
    const next = "/en/listings/handoffs/claim?token=q3K8xF0bW2yR9mT4vN6pL1sA7dE5gH0j";
    const url = await signUpThroughFakeProvider(next);
    expect(signups).toEqual(["/v1/public/signup/landlord"]);
    expect(`${url.pathname}${url.search}`).toBe(next);
  });

  it("without next, the landlord starts at the portfolio (agency at its mandated units)", async () => {
    expect((await signUpThroughFakeProvider(undefined)).pathname).toBe("/en/portfolio");
    const agency = await signUpThroughFakeProvider(undefined, "agency");
    expect(`${agency.pathname}${agency.search}`).toBe("/en/mandated-units?welcome=1");
  });

  it("an off-site next is dropped (safeReturnTo), never followed", async () => {
    const url = await signUpThroughFakeProvider("//evil.example.com/x");
    expect(url.host).toBe("owner.example.com");
    expect(url.pathname).toBe("/en/portfolio");
  });
});
