import { describe, expect, it } from "vitest";

import { buildTiers, describeTiers } from "./tiers";

describe("buildTiers", () => {
  it("builds a flat price with the utility's unit", () => {
    expect(buildTiers({ mode: "flat", price: "7.0000" }, "power")).toEqual({
      tiers: { kind: "flat", pricePerUnit: "7.0000", unit: "kwh" },
    });
    expect(buildTiers({ mode: "flat", price: "7,00" }, "power")).toEqual({ error: "price" });
  });

  it("chains tiers from 0 with an open-ended last tier", () => {
    expect(
      buildTiers(
        {
          mode: "tiered",
          rows: [
            { upTo: "150", pricePerUnit: "4.0000" },
            { upTo: "", pricePerUnit: "5.0000" },
          ],
        },
        "water",
      ),
    ).toEqual({
      tiers: {
        kind: "tiered",
        unit: "m3",
        tiers: [
          { fromUnits: "0", toUnits: "150", pricePerUnit: "4.0000" },
          { fromUnits: "150", toUnits: null, pricePerUnit: "5.0000" },
        ],
      },
    });
  });

  it("refuses tiers out of order or without prices", () => {
    expect(
      buildTiers(
        {
          mode: "tiered",
          rows: [
            { upTo: "150", pricePerUnit: "4" },
            { upTo: "100", pricePerUnit: "5" },
          ],
        },
        "power",
      ),
    ).toEqual({ error: "order" });
    expect(buildTiers({ mode: "tiered", rows: [{ upTo: "", pricePerUnit: "" }] }, "power")).toEqual({ error: "rows" });
  });

  it("builds a fixed amount", () => {
    expect(buildTiers({ mode: "fixed", amount: "300.00" }, "common_fee")).toEqual({
      tiers: { kind: "fixed", amount: "300.00" },
    });
    expect(buildTiers({ mode: "fixed", amount: "abc" }, "common_fee")).toEqual({ error: "amount" });
  });
});

describe("describeTiers", () => {
  it("reads the API's shapes back", () => {
    expect(describeTiers({ kind: "flat", pricePerUnit: "7.0000" })).toEqual([{ label: "flat", price: "7.0000" }]);
    expect(
      describeTiers({
        kind: "tiered",
        tiers: [
          { fromUnits: "0", toUnits: "150", pricePerUnit: "4.0000" },
          { fromUnits: "150", toUnits: null, pricePerUnit: "5.0000" },
        ],
      }),
    ).toEqual([
      { label: "0–150", price: "4.0000" },
      { label: "150–∞", price: "5.0000" },
    ]);
    expect(describeTiers(null)).toEqual([]);
  });
});
