import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import {
  acceptBlock,
  appliedMatches,
  filterUnits,
  handoverProblem,
  inboxTab,
  notDue,
  problemsByUnit,
  reasonOk,
  registerOnly,
  unitFilter,
  unitNoOf,
} from "./handover";

const unit = (ref: string, no: string, forward = "0.00"): Schemas["HandoverUnitDto"] => ({
  unitRef: ref,
  unitNo: no,
  owners: [{ partyRef: `p-${ref}`, displayName: "ผู้ซื้อ", sharePct: "100.0000" }],
  advanceCommonFees: "14400.00",
  advancePeriodFrom: "2026-11-01",
  advancePeriodTo: "2027-10-31",
  firstFundContribution: "16250.00",
  receivablesBroughtForward: forward,
  receivableItems: forward === "0.00" ? 0 : 1,
});
const NOW = Date.parse("2026-11-10T03:00:00Z");

describe("handover inbox (JW3b, D-333)", () => {
  it("opens on the waiting tab only when something waits", () => {
    expect(inboxTab(undefined, 2)).toBe("pending");
    expect(inboxTab(undefined, 0)).toBe("all");
    expect(inboxTab("rejected", 2)).toBe("rejected");
    expect(inboxTab("nonsense", 0)).toBe("all");
  });

  it("explains why accept is not ready: the date first, then the problems", () => {
    const problems = [{ code: "owner_missing" as const, unitRef: "u-1", ref: null }];
    expect(acceptBlock({ requestedHandoverAt: "2026-11-20T00:00:00+07:00", problems }, NOW)).toEqual({
      reason: "not_due",
      on: "2026-11-20T00:00:00+07:00",
    });
    expect(acceptBlock({ requestedHandoverAt: "2026-11-01T00:00:00+07:00", problems }, NOW)).toEqual({
      reason: "problems",
      count: 1,
    });
    expect(acceptBlock({ requestedHandoverAt: "2026-11-01T00:00:00+07:00", problems: [] }, NOW)).toBeNull();
    expect(notDue("2026-11-20T00:00:00+07:00", NOW)).toBe(true);
  });

  it("groups problems by unit and names units by number, never by ref", () => {
    const units = [unit("u-1", "A-201"), unit("u-2", "A-202", "1200.00")];
    const problems = problemsByUnit([
      { code: "owner_missing", unitRef: "u-1", ref: null },
      { code: "shares_exceeded", unitRef: "u-1", ref: null },
      { code: "duplicate_unit_no", unitRef: null, ref: "x" },
    ]);
    expect(problems.get("u-1")).toEqual(["owner_missing", "shares_exceeded"]);
    expect(problems.size).toBe(1);
    expect(unitNoOf(units, "u-2")).toBe("A-202");
    expect(unitNoOf(units, "u-9")).toBeNull();
    expect(unitNoOf(units, null)).toBeNull();
  });

  it("filters units: debt brought forward (not zero), problems, all — opening on problems when there are any", () => {
    const units = [unit("u-1", "A-201"), unit("u-2", "A-202", "1200.00"), unit("u-3", "A-203", "-0.00")];
    const problems = problemsByUnit([{ code: "owner_missing", unitRef: "u-3", ref: null }]);
    expect(unitFilter(undefined, true)).toBe("problems");
    expect(unitFilter(undefined, false)).toBe("all");
    expect(unitFilter("owed", true)).toBe("owed");
    expect(filterUnits(units, problems, "owed").map((u) => u.unitNo)).toEqual(["A-202"]);
    expect(filterUnits(units, problems, "problems").map((u) => u.unitNo)).toEqual(["A-203"]);
    expect(filterUnits(units, problems, "all")).toHaveLength(3);
  });

  it("says the recorded money equals the payload only when every string matches", () => {
    const totals = {
      advanceCommonFees: "100.00",
      firstFundContributions: "200.00",
      receivablesBroughtForward: "50.00",
    } as Schemas["HandoverTotalsDto"];
    const applied = {
      credits: "100.00",
      fundContributions: "200.00",
      openingInvoices: 1,
      openingInvoicesTotal: "50.00",
    };
    expect(appliedMatches({ totals, applied })).toBe(true);
    expect(appliedMatches({ totals, applied: { ...applied, credits: "99.00" } })).toBe(false);
    expect(appliedMatches({ totals, applied: null })).toBe(false);
  });

  it("maps refusals to words with one next step", () => {
    expect(handoverProblem("handover.invalid_state")).toEqual({ key: "invalidState", next: "reload" });
    expect(handoverProblem("handover.unit_owned")?.next).toBe("register");
    expect(handoverProblem("handover.totals_mismatch")?.next).toBe("developer");
    expect(handoverProblem("handover.not_due")?.next).toBeNull();
    expect(handoverProblem("validation.failed")).toBeNull();
    expect(handoverProblem(undefined)).toBeNull();
  });

  it("checks the reject reason length after trimming and spots register-only payloads", () => {
    expect(reasonOk("  สั้น ")).toBe(false);
    expect(reasonOk("ยอดไม่ตรง")).toBe(true);
    expect(reasonOk("x".repeat(1001))).toBe(false);
    expect(registerOnly({ contractVersion: 1 })).toBe(true);
    expect(registerOnly({ contractVersion: 2 })).toBe(false);
  });
});
