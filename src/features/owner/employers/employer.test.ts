import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { attachable, shiftMonth, statementMonth, validDeductPercent, workerRows, workersBody } from "./employer";

const party = (partyId: string, role: Schemas["LeasePartyRole"], displayName: string | null = partyId) =>
  ({ partyId, role, displayName, isSigner: false, signedAt: null }) as Schemas["LeasePartyViewDto"];

describe("employer housing helpers", () => {
  it("picks the statement month in Bangkok and moves between months", () => {
    // 31 Oct 2026 20:00 UTC = 1 Nov 2026 03:00 in Bangkok.
    expect(statementMonth(undefined, Date.parse("2026-10-31T20:00:00Z"))).toBe("2026-11");
    expect(statementMonth("2026-09", 0)).toBe("2026-09");
    expect(statementMonth("2026-13", Date.parse("2026-10-01T00:00:00Z"))).toBe("2026-10");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("lists everyone staying under the leases once, never a guarantor, and keeps numbered leavers", () => {
    const rows = workerRows(
      [
        {
          unitNo: "A-101",
          parties: [party("p1", "lessee", "Aung"), party("g1", "guarantor"), party("p2", "occupant", "Min")],
        },
        { unitNo: "A-102", parties: [party("p2", "co_tenant", "Min"), party("p3", "lessee", null)] },
      ],
      [
        { partyId: "p1", employeeNo: "E-001" },
        { partyId: "gone", employeeNo: "E-099" },
      ],
      new Map([
        ["p3", "Kyaw"],
        ["gone", "Former worker"],
      ]),
    );
    expect(rows.map((row) => [row.partyId, row.name, row.unitNo, row.employeeNo])).toEqual([
      ["p1", "Aung", "A-101", "E-001"],
      ["p2", "Min", "A-101", ""],
      ["p3", "Kyaw", "A-102", ""],
      ["gone", "Former worker", null, "E-099"],
    ]);
    expect(workersBody([...rows, { partyId: "p9", employeeNo: "  E-9 " }])).toEqual([
      { partyId: "p1", employeeNo: "E-001" },
      { partyId: "gone", employeeNo: "E-099" },
      { partyId: "p9", employeeNo: "E-9" },
    ]);
  });

  it("attaches only to an agreement in force and in its building", () => {
    expect(attachable({ state: "active", buildingId: null }, { buildingId: "b1" })).toBe(true);
    expect(attachable({ state: "active", buildingId: "b1" }, { buildingId: "b1" })).toBe(true);
    expect(attachable({ state: "active", buildingId: "b2" }, { buildingId: "b1" })).toBe(false);
    expect(attachable({ state: "ended", buildingId: null }, { buildingId: "b1" })).toBe(false);
  });

  it("checks the deduct percent like the API", () => {
    for (const ok of ["0", "50", "100", "33.33", "100.00"]) expect(validDeductPercent(ok)).toBe(true);
    for (const bad of ["101", "-1", "50.123", "abc", ""]) expect(validDeductPercent(bad)).toBe(false);
  });
});
