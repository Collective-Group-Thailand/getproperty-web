import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A page renders next to its layout's guard, so a signed-out visit reaches `ownerContext` / `adminContext` too.
 * They redirect like the guard (to the localised login) instead of throwing — the throw logged a server error
 * ("ownerContext outside the signed-in console") for every signed-out visit in the e2e run.
 */
const redirected = new Error("NEXT_REDIRECT");
const requireOperator = vi.fn(async (..._args: unknown[]) => {
  throw redirected;
});
const requirePlatform = vi.fn(async (..._args: unknown[]) => {
  throw redirected;
});
let operator: unknown = null;
let platform: unknown = null;

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }));
vi.mock("@/i18n/navigation", () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => (locale === "th" ? href : `/${locale}${href}`),
}));
vi.mock("@/lib/api/server", () => ({ serverApi: async () => ({ GET: async () => ({ data: [] }) }) }));
vi.mock("@/lib/api/client", () => ({ unwrap: async () => [] }));
vi.mock("@/lib/auth/actor", () => ({
  getOperatorActor: async () => operator,
  getPlatformActor: async () => platform,
}));
vi.mock("@/lib/auth/guards", () => ({ requireOperator, requirePlatform }));

beforeEach(() => {
  operator = null;
  platform = null;
  requireOperator.mockClear();
  requirePlatform.mockClear();
});

describe("console contexts when signed out", () => {
  it("ownerContext redirects to the localised login instead of throwing its own error", async () => {
    const { ownerContext } = await import("@/features/owner/shared/server");
    await expect(ownerContext()).rejects.toBe(redirected);
    expect(requireOperator).toHaveBeenCalledWith("owner", { login: "/en/login", selectTenant: "/en/select-tenant" });
  });

  it("adminContext redirects to the admin login instead of throwing its own error", async () => {
    const { adminContext } = await import("@/features/admin/shared/server");
    await expect(adminContext()).rejects.toBe(redirected);
    expect(requirePlatform).toHaveBeenCalledWith("/login");
  });

  it("signed in, neither guard runs", async () => {
    operator = { me: { user: { id: "u1" } } };
    platform = { me: { user: { id: "p1" } } };
    const { ownerContext } = await import("@/features/owner/shared/server");
    const { adminContext } = await import("@/features/admin/shared/server");
    await expect(ownerContext()).resolves.toMatchObject({ me: { user: { id: "u1" } }, locale: "en" });
    await expect(adminContext()).resolves.toMatchObject({ me: { user: { id: "p1" } }, locale: "en" });
    expect(requireOperator).not.toHaveBeenCalled();
    expect(requirePlatform).not.toHaveBeenCalled();
  });
});
