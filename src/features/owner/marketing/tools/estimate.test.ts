import { describe, expect, it } from "vitest";

import { fromHundredths, meterCharge, rentalYield, sum, toHundredths } from "./estimate";

describe("free tools arithmetic (D-271)", () => {
  it("parses and prints decimal strings exactly", () => {
    expect(toHundredths("1,234.5")).toBe(123450n);
    expect(toHundredths("0.1")).toBe(10n);
    expect(toHundredths("-1")).toBeNull();
    expect(toHundredths("1.234")).toBeNull();
    expect(fromHundredths(123450n)).toBe("1234.50");
    expect(sum(["0.1", "0.2", ""])).toBe("0.30");
    expect(sum(["x"])).toBeNull();
  });

  it("charges units × rate with a minimum", () => {
    expect(meterCharge({ previous: "1200", current: "1325", rate: "7", minimum: "" })).toEqual({
      units: "125.00",
      usageCost: "875.00",
      charged: "875.00",
      minimumApplied: false,
    });
    expect(meterCharge({ previous: "10", current: "12", rate: "18", minimum: "100" })).toMatchObject({
      charged: "100.00",
      minimumApplied: true,
    });
    expect(meterCharge({ previous: "10.5", current: "11.75", rate: "4.37", minimum: "" })).toMatchObject({
      units: "1.25",
      usageCost: "5.46",
    });
    expect(meterCharge({ previous: "20", current: "10", rate: "7", minimum: "" })).toEqual({ error: "backwards" });
  });

  it("works out gross and net yield", () => {
    expect(rentalYield({ price: "3000000", monthlyRent: "15000", yearlyCosts: "24000", vacantMonths: "1" })).toEqual({
      yearlyRent: "165000.00",
      netIncome: "141000.00",
      grossYield: "6.00",
      netYield: "4.70",
      paybackYears: "21.28",
    });
    expect(rentalYield({ price: "0", monthlyRent: "1", yearlyCosts: "", vacantMonths: "0" })).toEqual({
      error: "invalid",
    });
    expect(rentalYield({ price: "100", monthlyRent: "1", yearlyCosts: "", vacantMonths: "13" })).toEqual({
      error: "invalid",
    });
  });
});
