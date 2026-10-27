import { describe, expect, it } from "vitest";

import { storageBannerKind } from "./StorageBanner";

describe("storageBannerKind (G1, D-276 notices)", () => {
  it("shows nothing while unmetered or below the first threshold", () => {
    expect(storageBannerKind(null)).toBeNull();
    expect(storageBannerKind({ level: null })).toBeNull();
    expect(storageBannerKind({ level: "ok" })).toBeNull();
  });

  it("warns at the API's warning level and says full at or over the quota", () => {
    expect(storageBannerKind({ level: "warning" })).toBe("warning");
    expect(storageBannerKind({ level: "full" })).toBe("full");
    expect(storageBannerKind({ level: "over" })).toBe("full");
  });
});
