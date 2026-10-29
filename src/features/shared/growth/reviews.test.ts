import { describe, expect, it } from "vitest";

import { ratingBars, reviewTenure, reviewsPage } from "./reviews";

describe("review helpers", () => {
  it("shows tenure as months only", () => {
    expect(reviewTenure({ from: "2025-01", to: "2026-03" }, "en")).toEqual({ from: "Jan 2025", to: "Mar 2026" });
    expect(reviewTenure({ from: "2025-01", to: null }, "th").to).toBe("");
  });

  it("orders the distribution 5 stars first, scaled to the largest bar", () => {
    expect(ratingBars([0, 1, 1, 4, 6])).toEqual([
      { stars: 5, count: 6, width: 100 },
      { stars: 4, count: 4, width: 67 },
      { stars: 3, count: 1, width: 17 },
      { stars: 2, count: 1, width: 17 },
      { stars: 1, count: 0, width: 0 },
    ]);
    expect(ratingBars([]).every((bar) => bar.width === 0)).toBe(true);
  });

  it("reads the public page number defensively", () => {
    expect(reviewsPage("3")).toBe(3);
    expect(reviewsPage(undefined)).toBe(1);
    expect(reviewsPage("0")).toBe(1);
    expect(reviewsPage("-2")).toBe(1);
    expect(reviewsPage(["2", "5"])).toBe(2);
  });
});
