import { describe, expect, it } from "vitest";

import { kioskClasses } from "./Kiosk";

describe("kioskClasses", () => {
  it("lets the caller's height, padding, text size and border width replace the defaults", () => {
    expect(kioskClasses("h-14 px-8 text-lg border bg-surface", "h-16 text-xl border-2 flex-1")).toBe(
      "px-8 bg-surface h-16 text-xl border-2 flex-1",
    );
  });
  it("keeps the defaults when the caller only adds layout", () => {
    expect(kioskClasses("h-12 px-6 text-base", "flex-1 min-w-48")).toBe("h-12 px-6 text-base flex-1 min-w-48");
    expect(kioskClasses("text-fg text-base", "text-xl")).toBe("text-fg text-xl");
  });
});
