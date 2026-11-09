import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import {
  assignableMembers,
  assignmentWindow,
  boardBuildings,
  budgetTone,
  contractEndingSoon,
  contractProblem,
  contractTab,
  juristicContractTab,
  offerExpired,
  shareOfPct,
  staffProblemField,
  terminateWindow,
} from "./pm";

const board: Schemas["StaffBoardDto"] = {
  asOf: "2026-11-10",
  buildings: [
    {
      buildingId: "b1",
      buildingName: "อาคาร A",
      juristicName: "นิติ A",
      contractId: "c1",
      staff: [
        { userId: "u1", displayName: "อรุณี", role: "building_manager", shift: null },
        { userId: "u2", displayName: "สมพงษ์", role: "technician", shift: "จ.–ส." },
      ],
    },
    { buildingId: "b2", buildingName: "อาคาร B", juristicName: "นิติ B", contractId: "c2", staff: [] },
  ],
  members: [
    {
      userId: "u1",
      displayName: "อรุณี",
      tenantRole: "staff",
      assignments: [
        {
          assignmentId: "a1",
          buildingId: "b1",
          buildingName: "อาคาร A",
          role: "building_manager",
          shift: null,
          startsOn: "2026-01-01",
          endsOn: null,
        },
      ],
    },
  ],
  unassigned: [{ userId: "u3", displayName: "กัญญา", tenantRole: "staff" }],
};

describe("PM company console (JW3b, D-334)", () => {
  it("draws a percent string as a clamped share and never invents one", () => {
    expect(shareOfPct("94.00")).toBeCloseTo(0.94);
    expect(shareOfPct("120.5")).toBe(1);
    expect(shareOfPct(null)).toBe(0);
    expect(shareOfPct("abc")).toBe(0);
    expect(budgetTone("91.00")).toBe("warning");
    expect(budgetTone("83.40")).toBe("neutral");
    expect(budgetTone(null)).toBe("neutral");
  });

  it("opens contracts on the offers when some wait", () => {
    expect(contractTab(undefined, 1)).toBe("offered");
    expect(contractTab(undefined, 0)).toBe("active");
    expect(contractTab("all", 3)).toBe("all");
    expect(juristicContractTab("draft")).toBe("draft");
    expect(juristicContractTab("x")).toBe("active");
  });

  it("places an assignment on a day with an exclusive end", () => {
    expect(assignmentWindow({ startsOn: "2026-01-01", endsOn: null }, "2026-11-10")).toBe("current");
    expect(assignmentWindow({ startsOn: "2026-12-01", endsOn: null }, "2026-11-10")).toBe("scheduled");
    expect(assignmentWindow({ startsOn: "2026-01-01", endsOn: "2026-11-10" }, "2026-11-10")).toBe("ended");
    expect(assignmentWindow({ startsOn: "2026-01-01", endsOn: "2026-11-11" }, "2026-11-10")).toBe("current");
  });

  it("joins the board's people with their assignment ids and lists everyone assignable once", () => {
    const [a, b] = boardBuildings(board);
    expect(a!.people.map((p) => p.assignmentId)).toEqual(["a1", null]);
    expect(b!.people).toEqual([]);
    expect(
      assignableMembers(board)
        .map((m) => m.userId)
        .sort(),
    ).toEqual(["u1", "u3"]);
  });

  it("knows an expired offer, the termination window and a contract ending inside the window", () => {
    expect(offerExpired({ state: "offered", startsOn: "2026-11-07" }, "2026-11-10")).toBe(true);
    expect(offerExpired({ state: "offered", startsOn: "2026-11-10" }, "2026-11-10")).toBe(false);
    expect(offerExpired({ state: "active", startsOn: "2026-11-07" }, "2026-11-10")).toBe(false);
    expect(terminateWindow({ endsOn: "2027-01-31" }, "2026-11-10")).toEqual({ min: "2026-11-10", max: "2027-01-31" });
    expect(terminateWindow({ endsOn: "2026-11-01" }, "2026-11-10")).toEqual({ min: "2026-11-10", max: "2026-11-10" });
    expect(contractEndingSoon(65, 90)).toBe(true);
    expect(contractEndingSoon(120, 90)).toBe(false);
  });

  it("maps refusals: contracts to words, staff to their field", () => {
    expect(contractProblem("management_contract.offer_expired")).toEqual({ key: "offerExpired", next: "juristic" });
    expect(contractProblem("management_contract.invalid_state")?.next).toBe("reload");
    expect(contractProblem("management_contract.overlap")?.next).toBeNull();
    expect(contractProblem("http.not_found")).toBeNull();
    expect(staffProblemField("pm_staff.not_member")).toEqual({ field: "userId", key: "notMember" });
    expect(staffProblemField("pm_staff.outside_term")?.field).toBe("startsOn");
    expect(staffProblemField("pm_staff.overlap")?.key).toBe("overlap");
    expect(staffProblemField("pm_staff.ended")?.field).toBe("endsOn");
    expect(staffProblemField("validation.failed")).toBeNull();
  });
});
