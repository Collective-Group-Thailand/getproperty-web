import { describe, expect, it } from "vitest";

import { contractTab, expiryBadge, renewalWindow, renewalWindows, slaRows, slaTerms } from "./contracts";

const today = "2026-11-06";
const active = (daysLeft: number, noticeBy: string, renewalId: string | null = null) => ({
  state: "active",
  daysLeft,
  noticeBy,
  renewalId,
});

describe("renewal queue", () => {
  it("reads the alert thresholds as windows, largest first, ignoring junk", () => {
    expect(renewalWindows([30, 90, 60, 90])).toEqual([90, 60, 30]);
    expect(renewalWindows([0, -5, 400, "30", 45.5, 60])).toEqual([60]);
    expect(renewalWindows("90")).toEqual([]);
  });

  it("uses the window asked for when the setting has it, else the largest", () => {
    expect(renewalWindow([90, 60, 30], "30")).toBe(30);
    expect(renewalWindow([90, 60, 30], "45")).toBe(90);
    expect(renewalWindow([90, 60, 30], undefined)).toBe(90);
    expect(renewalWindow([], "30")).toBeNull();
  });

  it("opens on the renewal queue only when it has contracts", () => {
    expect(contractTab(undefined, 2)).toBe("renewal");
    expect(contractTab(undefined, 0)).toBe("all");
    expect(contractTab(undefined, undefined)).toBe("all");
    expect(contractTab("draft", 5)).toBe("draft");
    expect(contractTab("nonsense", 5)).toBe("renewal");
  });
});

describe("expiry badge", () => {
  it("warns once the notice date has come, with the date and the days left", () => {
    expect(expiryBadge(active(25, "2026-11-01"), today, 90)).toEqual({
      kind: "notice",
      tone: "warning",
      noticeBy: "2026-11-01",
      daysLeft: 25,
    });
    expect(expiryBadge(active(60, today), today, 90)).toMatchObject({ kind: "notice" });
  });

  it("counts down inside the window before the notice date", () => {
    expect(expiryBadge(active(75, "2026-11-21"), today, 90)).toEqual({ kind: "ending", tone: "info", daysLeft: 75 });
    expect(expiryBadge(active(120, "2027-01-05"), today, 90)).toBeNull();
    expect(expiryBadge(active(75, "2026-11-21"), today, 30)).toBeNull();
  });

  it("names a renewal draft before anything else", () => {
    expect(expiryBadge(active(25, "2026-11-01", "renewal-id"), today, 90)).toEqual({ kind: "renewing", tone: "info" });
  });

  it("says ended for an expired contract or one past its end, and nothing for drafts or terminated ones", () => {
    expect(
      expiryBadge({ state: "expired", daysLeft: -20, noticeBy: "2026-09-17", renewalId: null }, today, 90),
    ).toEqual({ kind: "ended", tone: "neutral" });
    expect(expiryBadge(active(-1, "2026-09-01"), today, 90)).toMatchObject({ kind: "ended" });
    expect(
      expiryBadge({ state: "draft", daysLeft: 10, noticeBy: "2026-10-01", renewalId: null }, today, 90),
    ).toBeNull();
    expect(
      expiryBadge({ state: "terminated", daysLeft: 10, noticeBy: "2026-10-01", renewalId: null }, today, 90),
    ).toBeNull();
  });
});

describe("SLA table", () => {
  it("keeps the rows with both hours and reports the half-filled, out-of-range and inverted ones", () => {
    const { terms, problems } = slaTerms([
      { priority: "urgent", responseHours: "2", resolveHours: "24" },
      { priority: "high", responseHours: "4", resolveHours: "" },
      { priority: "normal", responseHours: "0", resolveHours: "72" },
      { priority: "low", responseHours: "48", resolveHours: "24" },
    ]);
    expect(terms).toEqual([{ priority: "urgent", responseHours: 2, resolveHours: 24 }]);
    expect(problems).toEqual({ high: "both", normal: "range", low: "order" });
  });

  it("ignores empty rows and rebuilds every priority from a contract", () => {
    expect(slaTerms(slaRows([])).terms).toEqual([]);
    const rows = slaRows([{ priority: "high", responseHours: 4, resolveHours: 48 }]);
    expect(rows.map((row) => row.priority)).toEqual(["urgent", "high", "normal", "low"]);
    expect(rows[1]).toEqual({ priority: "high", responseHours: "4", resolveHours: "48" });
  });
});
