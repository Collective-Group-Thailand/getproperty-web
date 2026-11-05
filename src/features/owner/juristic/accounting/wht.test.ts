import { describe, expect, it } from "vitest";

import { anyUnverified, checkWhtRates, lineWht, parseWhtRates, percentText, whtRateLabel } from "./wht";

const RATES = parseWhtRates([
  {
    key: "service",
    labelTh: "ค่าบริการ / ค่าจ้างทำของ",
    labelEn: "Services",
    incomeType: "3 เตรส",
    ratePct: "3.00",
    verified: false,
  },
  { key: "rent", labelTh: "ค่าเช่า", labelEn: "Rent", incomeType: "40(5)", ratePct: "5.00", verified: true },
  { nonsense: true },
]);

describe("withholding tax display", () => {
  it("reads the setting and drops malformed rows", () => {
    expect(RATES.map((rate) => rate.key)).toEqual(["service", "rent"]);
    expect(parseWhtRates(null)).toEqual([]);
  });
  it("writes the rate without trailing zeros, with its label", () => {
    expect(percentText("3.00")).toBe("3");
    expect(percentText("1.50")).toBe("1.5");
    expect(whtRateLabel(RATES[0]!, "th")).toBe("3% · ค่าบริการ / ค่าจ้างทำของ");
    expect(whtRateLabel(RATES[1]!, "en")).toBe("5% · Rent");
  });
  it("shows a line's snapshotted rate and whether it is confirmed", () => {
    expect(lineWht({ whtKey: null, whtRatePct: null, whtIncomeType: null }, RATES)).toBeNull();
    expect(lineWht({ whtKey: "service", whtRatePct: "3.00", whtIncomeType: "3 เตรส" }, RATES)).toMatchObject({
      ratePct: "3.00",
      verified: false,
    });
    expect(lineWht({ whtKey: "rent", whtRatePct: "5.00", whtIncomeType: "40(5)" }, RATES)?.verified).toBe(true);
    expect(lineWht({ whtKey: "gone", whtRatePct: "2.00", whtIncomeType: null }, RATES)?.verified).toBe(false);
    expect(anyUnverified(RATES)).toBe(true);
  });
  it("checks edited rates like the API", () => {
    expect(checkWhtRates(RATES).ok).toBe(true);
    const bad = checkWhtRates([
      { ...RATES[0]!, key: "Service" },
      { ...RATES[1]!, key: "rent_a", ratePct: "0" },
      { ...RATES[1]!, key: "rent_b", labelEn: " " },
      { ...RATES[1]! },
      { ...RATES[1]! },
    ]);
    expect(bad.rows.map((row) => row[0] ?? null)).toEqual(["key", "rate", "label", null, "duplicate"]);
  });
});
