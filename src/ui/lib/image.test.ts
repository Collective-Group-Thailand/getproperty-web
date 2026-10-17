import { describe, expect, it } from "vitest";

import { fitWithin, shrinkFactor } from "./image";

describe("fitWithin", () => {
  it("scales the longer side down to the limit, keeping the ratio", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never upscales", () => {
    expect(fitWithin(640, 480, 1600)).toEqual({ width: 640, height: 480 });
  });
});

describe("shrinkFactor", () => {
  it("scales by the square root of the overshoot, a little more, within 0.3–0.9", () => {
    expect(shrinkFactor(400, 1600)).toBeCloseTo(0.475);
    expect(shrinkFactor(400, 420)).toBe(0.9);
    expect(shrinkFactor(400, 100_000)).toBe(0.3);
  });
});
