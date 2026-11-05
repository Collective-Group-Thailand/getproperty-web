import { describe, expect, it } from "vitest";

import { groupByUnit, recentMonths } from "./statement";

const invoice = (id: string, unitNo: string | null, periodStart: string) => ({
  id,
  unitNo,
  number: `INV-${id}`,
  balance: "100.00",
  dueDate: null,
  periodStart,
  periodEnd: periodStart,
});

describe("paper statement grouping (J-DESIGN §4)", () => {
  it("groups open invoices by the statement's units, oldest period first", () => {
    const groups = groupByUnit({
      units: [
        { id: "u1", unitNo: "A-201", building: "อาคาร A" },
        { id: "u2", unitNo: "A-302", building: "อาคาร A" },
      ],
      openInvoices: [
        invoice("3", "A-302", "2026-10-01"),
        invoice("1", "A-201", "2026-10-01"),
        invoice("2", "A-201", "2026-07-01"),
      ],
    });
    expect(groups.map((group) => [group.unitNo, group.invoices.map((i) => i.id)])).toEqual([
      ["A-201", ["2", "1"]],
      ["A-302", ["3"]],
    ]);
  });

  it("lists a unit with nothing open and never drops an invoice of an unnamed unit", () => {
    const groups = groupByUnit({
      units: [{ id: "u1", unitNo: "A-201", building: "อาคาร A" }],
      openInvoices: [invoice("9", null, "2026-10-01")],
    });
    expect(groups.map((group) => [group.key, group.invoices.length])).toEqual([
      ["u1", 0],
      ["other", 1],
    ]);
  });

  it("offers this month and the eleven before it", () => {
    const months = recentMonths("2026-02-14");
    expect(months.slice(0, 3)).toEqual(["2026-02", "2026-01", "2025-12"]);
    expect(months).toHaveLength(12);
  });
});
