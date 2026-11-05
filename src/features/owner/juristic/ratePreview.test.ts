import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { compareAmounts, previewDisplay, suggestedSplit } from "./ratePreview";

function preview(patch: Partial<Schemas["RatePreviewDto"]> = {}): Schemas["RatePreviewDto"] {
  return {
    budgetId: "b",
    buildingId: "bl",
    kind: "common_fee",
    splitBy: "ownership_ratio",
    frequency: "quarterly",
    annualAmount: "1234567.89",
    cycleAmount: "308641.97",
    min: "2104.11",
    median: "3968.74",
    max: "7920.00",
    sum: "308641.97",
    sumMatches: true,
    unitsCount: 5,
    missingUnitIds: [],
    ratePlanId: null,
    units: [
      { unitId: "1", unitNo: "A-101", weight: "0.1", amount: "3968.74" },
      { unitId: "2", unitNo: "A-102", weight: "0.05", amount: "2104.11" },
      { unitId: "3", unitNo: "A-201", weight: "0.2", amount: "7920.00" },
      { unitId: "4", unitNo: "A-202", weight: "0.1", amount: "3968.74" },
      { unitId: "5", unitNo: "A-301", weight: "0.15", amount: "10000.00" },
    ],
    ...patch,
  };
}

describe("compareAmounts", () => {
  it("compares decimal strings without floats", () => {
    expect(compareAmounts("10000.00", "7920.00")).toBeGreaterThan(0);
    expect(compareAmounts("999.99", "1200.5")).toBeLessThan(0);
    expect(compareAmounts("0.10", "0.1")).toBe(0);
    expect(compareAmounts("-5.00", "1.00")).toBeLessThan(0);
    expect(compareAmounts("-5.00", "-1.00")).toBeLessThan(0);
  });
});

describe("previewDisplay", () => {
  it("shows the API's min / median / max as given", () => {
    const display = previewDisplay(preview());
    expect(display.rows).toEqual([
      { key: "min", amount: "2104.11" },
      { key: "median", amount: "3968.74" },
      { key: "max", amount: "7920.00" },
    ]);
    expect(display.check).toEqual({ state: "match", sum: "308641.97", cycleAmount: "308641.97" });
    expect(display.canDraft).toBe(true);
  });

  it("names the units at both ends by amount", () => {
    const display = previewDisplay(preview(), 2);
    expect(display.lowest.map((unit) => unit.unitNo)).toEqual(["A-102", "A-101"]);
    expect(display.highest.map((unit) => unit.unitNo)).toEqual(["A-301", "A-201"]);
  });

  it("blocks the draft while units lack the weight", () => {
    const display = previewDisplay(preview({ missingUnitIds: ["x", "y"], sumMatches: false }));
    expect(display.check).toMatchObject({ state: "missing", missing: 2 });
    expect(display.canDraft).toBe(false);
  });

  it("shows a mismatch the API reports instead of hiding it", () => {
    const display = previewDisplay(preview({ sumMatches: false, sum: "308641.96" }));
    expect(display.check).toMatchObject({ state: "mismatch", sum: "308641.96" });
    expect(display.canDraft).toBe(false);
  });

  it("has no ends when there are no units", () => {
    const display = previewDisplay(preview({ units: [], unitsCount: 0 }));
    expect(display.lowest).toEqual([]);
    expect(display.highest).toEqual([]);
  });
});

describe("suggestedSplit", () => {
  it("suggests the ratio for a condo and the land for an estate", () => {
    expect(suggestedSplit("condo")).toBe("ownership_ratio");
    expect(suggestedSplit("village")).toBe("land_area_sqwa");
    expect(suggestedSplit("office")).toBe("area_sqm");
    expect(suggestedSplit(null)).toBe("area_sqm");
  });
});
