import { describe, expect, it } from "vitest";

import { penalised, ratioToPercent, scoreArc } from "./energy";

describe("energy insight display", () => {
  it("moves a ratio's decimal point without float math", () => {
    expect(ratioToPercent("0.2400")).toBe("24.00");
    expect(ratioToPercent("0.5259")).toBe("52.59");
    expect(ratioToPercent("1")).toBe("100");
    expect(ratioToPercent("0.05")).toBe("5");
    expect(ratioToPercent("0.123456")).toBe("12.3456");
    expect(ratioToPercent(null)).toBeNull();
    expect(ratioToPercent("abc")).toBeNull();
  });

  it("draws the score arc", () => {
    expect(scoreArc(82, 100)).toBe("82.00 18.00");
    expect(scoreArc(150, 100)).toBe("100.00 0.00");
    expect(scoreArc(-5, 100)).toBe("0.00 100.00");
  });

  it("tells a penalty from none", () => {
    expect(penalised("0.0")).toBe(false);
    expect(penalised("5.3")).toBe(true);
    expect(penalised("0.4")).toBe(true);
  });
});
