import { describe, expect, it } from "vitest";

import { meterUnit, ratioToPercent, readingUnit } from "./units";

describe("staff units", () => {
  it("maps utilities and API units to the formatter's", () => {
    expect(meterUnit("electric")).toBe("kWh");
    expect(meterUnit("water")).toBe("m3");
    expect(readingUnit("kwh")).toBe("kWh");
    expect(readingUnit("m3")).toBe("m3");
  });

  it("turns a 0–1 ratio string into a percentage without float arithmetic", () => {
    expect(ratioToPercent("0.950")).toBe("95");
    expect(ratioToPercent("0.9")).toBe("90");
    expect(ratioToPercent("1.000")).toBe("100");
    expect(ratioToPercent("0.0725")).toBe("7.2");
    expect(ratioToPercent("0")).toBe("0");
    expect(ratioToPercent("n/a")).toBeNull();
  });
});
