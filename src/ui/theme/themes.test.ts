import { describe, expect, it } from "vitest";

import { dataThemeAttribute, isThemeChoice, themeChoicesFor, ZONE_DEFAULT_THEME } from "./themes";

describe("theme selection", () => {
  it("validates the cookie value", () => {
    expect(isThemeChoice("dark")).toBe(true);
    expect(isThemeChoice("hc")).toBe(true);
    expect(isThemeChoice("sepia")).toBe(false);
    expect(isThemeChoice(undefined)).toBe(false);
  });
  it("stamps nothing for `system` so prefers-color-scheme decides", () => {
    expect(dataThemeAttribute("system")).toBeUndefined();
    expect(dataThemeAttribute("dark")).toBe("dark");
  });
  it("offers high contrast to the staff zone only", () => {
    expect(themeChoicesFor("staff")).toContain("hc");
    expect(themeChoicesFor("owner")).not.toContain("hc");
    expect(themeChoicesFor("admin")).not.toContain("hc");
  });
  it("defaults every zone to light (the resident app that follows the phone is getproperty-liff)", () => {
    expect(ZONE_DEFAULT_THEME).toEqual({ owner: "light", staff: "light", admin: "light" });
  });
});
