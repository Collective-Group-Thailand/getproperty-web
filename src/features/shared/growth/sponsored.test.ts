import { describe, expect, it } from "vitest";

import { formatPercent } from "@/i18n/format";

import { ratePercent, vatPercent } from "./sponsored";

/** Review L3: a VAT rate is moved two places as text — `Number("0.0725") * 100` is 7.249999… and truncates to 7.24. */
describe("VAT rate as a percentage (review L3)", () => {
  it("never goes through float arithmetic", () => {
    expect(formatPercent(String(Number("0.0725") * 100), "en")).toBe("7.24%"); // the old way, wrong
    expect(ratePercent("0.0725")).toBe("7.25");
    expect(vatPercent("0.0725", "en")).toBe("7.25%");
    expect(vatPercent("0.0700", "th")).toBe("7%");
  });

  it("reads any number of decimals the API sends", () => {
    expect(ratePercent("0.07")).toBe("7");
    expect(ratePercent("0.1")).toBe("10");
    expect(ratePercent("0")).toBe("0");
    expect(ratePercent("1")).toBe("100");
    expect(ratePercent("0.00125")).toBe("0.125");
    expect(ratePercent("abc")).toBe("abc");
  });
});
