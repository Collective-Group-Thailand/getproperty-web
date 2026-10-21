import { describe, expect, it } from "vitest";

import { SERIES_BUCKETS, SERIES_RANGE_MS, seriesBucketFor, seriesWindowFits } from "./series";

describe("meter series windows (D-241)", () => {
  const now = new Date("2026-10-22T05:00:00Z");

  it("asks every bucket for a window its retention still covers", () => {
    for (const bucket of SERIES_BUCKETS)
      expect(seriesWindowFits(bucket, new Date(now.getTime() - SERIES_RANGE_MS[bucket]), now)).toBe(true);
  });

  it("15-minute data exists for 24 months of raw points, hourly and daily for 5 years", () => {
    expect(seriesWindowFits("15m", new Date("2024-11-01T00:00:00Z"), now)).toBe(true);
    expect(seriesWindowFits("15m", new Date("2024-10-01T00:00:00Z"), now)).toBe(false);
    expect(seriesWindowFits("1h", new Date("2024-10-01T00:00:00Z"), now)).toBe(true);
    expect(seriesWindowFits("1d", new Date("2021-10-01T00:00:00Z"), now)).toBe(false);
  });

  it("falls back to a coarser bucket for a window older than 24 months", () => {
    expect(seriesBucketFor("15m", new Date("2026-10-21T05:00:00Z"), now)).toBe("15m");
    expect(seriesBucketFor("15m", new Date("2024-01-01T00:00:00Z"), now)).toBe("1h");
    expect(seriesBucketFor("1h", new Date("2024-01-01T00:00:00Z"), now)).toBe("1h");
  });
});
