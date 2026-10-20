import { describe, expect, it } from "vitest";

import { diffStructures, draftFrom, draftProblems, structureFrom, type StructureDraft } from "./structure";

const draft = (overrides: Partial<StructureDraft> = {}): StructureDraft => ({
  ...draftFrom(null),
  tiers: [
    { toUnits: "150", pricePerUnit: "3.2484" },
    { toUnits: "400", pricePerUnit: "4.2218" },
    { toUnits: "", pricePerUnit: "4.4217" },
  ],
  ftPricePerUnit: "0.3672",
  ftPeriod: "2027-01",
  serviceCharge: "24.62",
  ceilingPerUnit: "4.7889",
  ...overrides,
});

describe("tariff structure editor", () => {
  it("chains tiers by copying each upper bound (strings, nothing computed) and closes the last one", () => {
    const structure = structureFrom(draft(), "kwh");
    expect(structure.tiers).toEqual([
      { fromUnits: "0", toUnits: "150", pricePerUnit: "3.2484" },
      { fromUnits: "150", toUnits: "400", pricePerUnit: "4.2218" },
      { fromUnits: "400", toUnits: null, pricePerUnit: "4.4217" },
    ]);
    expect(structure).toMatchObject({
      kind: "tiered",
      unit: "kwh",
      capBasis: "effective_average_rate",
      ceilingPerUnit: "4.7889",
      ft: { pricePerUnit: "0.3672", period: "2027-01" },
      serviceCharge: { amount: "24.62", basis: "per_month" },
      vat: { rate: "7", included: false },
    });
    expect(draftProblems(draft())).toEqual([]);
  });

  it("names the problems the maker can fix before the API refuses the structure", () => {
    const problems = draftProblems(
      draft({
        tiers: [
          { toUnits: "150", pricePerUnit: "3.2484" },
          { toUnits: "100", pricePerUnit: "x" },
          { toUnits: "500", pricePerUnit: "4.4" },
        ],
        ceilingPerUnit: "",
        ftPeriod: "",
      }),
    );
    expect(problems).toEqual([
      { field: "tiers", index: 1, problem: "price" },
      { field: "tiers", index: 1, problem: "order" },
      { field: "tiers", index: 2, problem: "lastOpen" },
      { field: "ftPeriod", problem: "required" },
      { field: "ceiling", problem: "required" },
    ]);
  });

  it("a flat structure needs its price and sends no tiers", () => {
    expect(draftProblems(draft({ kind: "flat" }))).toEqual([{ field: "flat", problem: "required" }]);
    const structure = structureFrom(draft({ kind: "flat", flatPricePerUnit: "18.00" }), "m3");
    expect(structure).toMatchObject({ kind: "flat", unit: "m3", tiers: null, flatPricePerUnit: "18.00" });
  });

  it("round-trips a published structure into the editor", () => {
    const published = structureFrom(draft({ needsCheck: "ft.pricePerUnit" }), "kwh");
    const again = draftFrom(published);
    expect(structureFrom(again, "kwh")).toEqual(published);
    expect(again.needsCheck).toBe("ft.pricePerUnit");
  });

  it("diffs two versions value by value, by JSON path", () => {
    const before = structureFrom(draft(), "kwh");
    const after = structureFrom(
      draft({ ftPricePerUnit: "0.1972", tiers: [{ toUnits: "", pricePerUnit: "4.00" }] }),
      "kwh",
    );
    expect(diffStructures(before, after)).toEqual([
      { path: "ft.pricePerUnit", before: "0.3672", after: "0.1972" },
      { path: "tiers[0].pricePerUnit", before: "3.2484", after: "4.00" },
      { path: "tiers[0].toUnits", before: "150", after: "—" },
      { path: "tiers[1].fromUnits", before: "150", after: null },
      { path: "tiers[1].pricePerUnit", before: "4.2218", after: null },
      { path: "tiers[1].toUnits", before: "400", after: null },
      { path: "tiers[2].fromUnits", before: "400", after: null },
      { path: "tiers[2].pricePerUnit", before: "4.4217", after: null },
      { path: "tiers[2].toUnits", before: "—", after: null },
    ]);
    expect(diffStructures(before, before)).toEqual([]);
  });
});
