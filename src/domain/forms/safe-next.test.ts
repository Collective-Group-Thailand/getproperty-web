import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-next";

/**
 * Review H3: `?next=` reaches `redirect()` and `window.location.assign()` on all three zones. Search params arrive
 * decoded once (`?next=/%09/evil` is `"/\t/evil"`), so both the decoded and the still-encoded forms are refused.
 */
const ZONE_ORIGINS = ["https://my.getproperty.co", "https://staff.getproperty.co", "https://admin.getproperty.co"];

const ATTACKS = [
  "/\t/evil.example/login", // ?next=/%09/evil.example/login — the reported bypass
  "/%09/evil.example/login", // ?next=/%2509/…
  "/\n/evil.example",
  "/%0a/evil.example",
  "/%0A/evil.example",
  "/\r/evil.example",
  "/%0d/evil.example",
  "/\\evil.example",
  "/\\/evil.example",
  "/%5cevil.example",
  "/%5C/evil.example",
  "\\/evil.example",
  "//evil.example",
  "//evil.example/path",
  "/%2F/evil.example",
  "/%2f%2fevil.example",
  "/%252F%252Fevil.example",
  "/ /evil.example",
  "/ /evil.example",
  "/\u0000/evil.example",
  "/%00/evil.example",
  "/\u007f/evil.example",
  "https://evil.example",
  "javascript:alert(1)",
  "/x?next=%0d%0aSet-Cookie:a=b",
  "dashboard",
  "",
];

describe("safeNextPath (review H3)", () => {
  it.each(ATTACKS)("refuses %j", (attack) => {
    expect(safeNextPath(attack)).toBeUndefined();
  });

  it.each(ZONE_ORIGINS)("never resolves off-origin on %s", (origin) => {
    for (const attack of ATTACKS) {
      const safe = safeNextPath(attack);
      if (safe !== undefined) expect(new URL(safe, origin).origin).toBe(origin);
    }
  });

  it("refuses non-strings and oversized values", () => {
    expect(safeNextPath(undefined)).toBeUndefined();
    expect(safeNextPath(3)).toBeUndefined();
    expect(safeNextPath(`/${"a".repeat(5000)}`)).toBeUndefined();
  });

  it("keeps ordinary console paths, normalised", () => {
    expect(safeNextPath("/dashboard?x=1")).toBe("/dashboard?x=1");
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/en/units?q=a%20b&page=2")).toBe("/en/units?q=a%20b&page=2");
    expect(safeNextPath("/work-orders/3b241101-e2bb-4255-8caf-4136c566a962")).toBe(
      "/work-orders/3b241101-e2bb-4255-8caf-4136c566a962",
    );
    expect(safeNextPath("/a/../dashboard")).toBe("/dashboard");
    expect(safeNextPath("/%E0%B8%AB%E0%B9%89%E0%B8%AD%E0%B8%87")).toBe("/%E0%B8%AB%E0%B9%89%E0%B8%AD%E0%B8%87");
  });
});
