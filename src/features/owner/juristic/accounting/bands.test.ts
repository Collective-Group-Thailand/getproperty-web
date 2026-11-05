import { describe, expect, it } from "vitest";

import {
  approvalProgress,
  approveBlock,
  bandIndexFor,
  bandRange,
  checkBands,
  parseBands,
  snapshotRange,
} from "./bands";

const BANDS = parseBands([
  { upTo: "10000.00", roles: ["owner", "manager", "committee"], approvals: 1 },
  { upTo: "100000.00", roles: ["owner", "manager", "committee"], approvals: 2 },
  { upTo: null, roles: ["owner", "committee", "janitor"], approvals: 3 },
]);

describe("approval bands", () => {
  it("parses the setting defensively", () => {
    expect(BANDS[2]!.roles).toEqual(["owner", "committee"]);
    expect(parseBands("nope")).toEqual([]);
  });
  it("finds the band of an amount, limits inclusive", () => {
    expect(bandIndexFor("10000.00", BANDS)).toBe(0);
    expect(bandIndexFor("10000.01", BANDS)).toBe(1);
    expect(bandIndexFor("100000.00", BANDS)).toBe(1);
    expect(bandIndexFor("250000.00", BANDS)).toBe(2);
    expect(bandIndexFor("abc", BANDS)).toBe(-1);
  });
  it("explains each band by its limits", () => {
    expect(bandRange(BANDS, 0)).toEqual({ kind: "upTo", upTo: "10000.00" });
    expect(bandRange(BANDS, 1)).toEqual({ kind: "between", above: "10000.00", upTo: "100000.00" });
    expect(bandRange(BANDS, 2)).toEqual({ kind: "above", above: "100000.00" });
    expect(snapshotRange({ key: "gt:100000.00", upTo: null })).toEqual({ kind: "above", above: "100000.00" });
    expect(snapshotRange({ key: "le:10000.00", upTo: "10000.00" })).toEqual({ kind: "upTo", upTo: "10000.00" });
  });
  it("shows approval progress from the API's counts", () => {
    expect(approvalProgress({ approvalsGiven: 1, approvalsRequired: 2, band: null })).toEqual({
      given: 1,
      required: 2,
      share: 0.5,
      complete: false,
    });
    expect(approvalProgress({ approvalsGiven: 0, approvalsRequired: null, band: null }).share).toBe(0);
  });
  it("says why the viewer cannot approve (maker ≠ checker first)", () => {
    const request = {
      state: "submitted",
      requestedBy: "u-maker",
      nextActions: [] as string[],
      approvals: [{ approverUserId: "u-done" }],
      band: { roles: ["owner", "committee"] },
    };
    const viewer = (userId: string, roles: string[]) => ({ userId, roles, canApprove: true });
    expect(approveBlock(request, viewer("u-maker", ["owner"]))).toBe("requester");
    expect(approveBlock(request, viewer("u-done", ["owner"]))).toBe("decided");
    expect(approveBlock(request, viewer("u-staff", ["manager"]))).toBe("role");
    expect(approveBlock({ ...request, state: "approved" }, viewer("u-x", ["owner"]))).toBe("state");
    expect(approveBlock({ ...request, nextActions: ["approve"] }, viewer("u-x", ["owner"]))).toBeNull();
    expect(approveBlock({ ...request, band: null }, { userId: "u-x", roles: [], canApprove: false })).toBe(
      "permission",
    );
  });
  it("checks edited bands before sending", () => {
    const ok = checkBands([
      { upTo: "10,000", roles: ["owner"], approvals: 1 },
      { upTo: "", roles: ["owner"], approvals: 2 },
    ]);
    expect(ok.ok).toBe(true);
    const bad = checkBands([
      { upTo: "50000", roles: ["owner"], approvals: 1 },
      { upTo: "40000", roles: [], approvals: 6 },
      { upTo: "", roles: ["owner"], approvals: 1 },
    ]);
    expect(bad.rows[1]).toEqual(["order", "roles", "approvals"]);
    expect(bad.ok).toBe(false);
    expect(checkBands([]).problems).toEqual(["count"]);
  });
});
