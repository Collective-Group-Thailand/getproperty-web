import { describe, expect, it } from "vitest";

import { isMarketingPath } from "./marketing";

describe("isMarketingPath", () => {
  it.each([
    "/",
    "/en",
    "/pricing",
    "/en/pricing",
    "/landlords",
    "/en/landlords",
    "/legal/pdpa",
    "/th/legal/terms",
    "/pricing/",
  ])("owner %s is a marketing page", (path) => expect(isMarketingPath("owner", path)).toBe(true));
  it.each(["/dashboard", "/login", "/en/dashboard", "/legal", "/bff/v1/owner/me"])("owner %s is not", (path) =>
    expect(isMarketingPath("owner", path)).toBe(false),
  );
  it("no staff or admin page is a marketing page", () => {
    expect(isMarketingPath("staff", "/")).toBe(false);
    expect(isMarketingPath("admin", "/pricing")).toBe(false);
  });
});
