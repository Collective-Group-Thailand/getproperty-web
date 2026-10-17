import { describe, expect, it } from "vitest";

import { fitWithin, qualitySteps } from "./image";

describe("fitWithin", () => {
  it("scales the longer side down to the limit, keeping the ratio", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never upscales", () => {
    expect(fitWithin(640, 480, 1600)).toEqual({ width: 640, height: 480 });
  });
});

describe("qualitySteps", () => {
  it("steps down by 0.08 to the floor", () => {
    expect(qualitySteps(0.82, 0.5)).toEqual([0.82, 0.74, 0.66, 0.58, 0.5]);
    expect(qualitySteps(0.4, 0.5)).toEqual([0.5]);
  });
});
