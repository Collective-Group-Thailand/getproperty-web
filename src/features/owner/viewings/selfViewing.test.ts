import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { attention, bangkokDay, byDay, canEndAccess, selfViewingRules, viewingWeek } from "./selfViewing";

const access = (patch: Partial<Schemas["ViewingAccessSummaryDto"]> = {}): Schemas["ViewingAccessSummaryDto"] => ({
  state: "issued",
  validFrom: "2026-11-07T02:55:00.000Z",
  validTo: "2026-11-07T03:30:00.000Z",
  enteredAt: null,
  enteredSource: null,
  exitedAt: null,
  incidentAt: null,
  incidentNote: null,
  closedAt: null,
  closeReason: null,
  workOrderId: null,
  ...patch,
});

describe("self-viewing rules", () => {
  it("reads the settings and treats a missing switch as off", () => {
    expect(selfViewingRules(null)).toEqual({
      enabled: false,
      earlyMinutes: null,
      codeMinutes: null,
      overstayMinutes: null,
    });
    const settings = [
      { key: "viewing.self.enabled", value: true },
      { key: "viewing.self.code_minutes", value: 30 },
      { key: "viewing.self.code_early_minutes", value: 5 },
      { key: "viewing.self.overstay_minutes", value: "30" },
    ] as Schemas["SettingDto"][];
    expect(selfViewingRules(settings)).toEqual({
      enabled: true,
      earlyMinutes: 5,
      codeMinutes: 30,
      overstayMinutes: null,
    });
  });

  it("lets the owner end only an open window", () => {
    expect(canEndAccess(null)).toBe(false);
    expect(canEndAccess(access())).toBe(true);
    expect(canEndAccess(access({ state: "entered", enteredAt: "2026-11-07T03:00:00Z" }))).toBe(true);
    expect(canEndAccess(access({ state: "exited" }))).toBe(false);
    expect(canEndAccess(access({ closedAt: "2026-11-07T03:10:00Z" }))).toBe(false);
  });

  it("orders what needs attention: incident, overstay, inside", () => {
    const inside = access({ state: "entered", enteredAt: "2026-11-07T03:00:00Z" });
    expect(attention(inside, Date.parse("2026-11-07T03:10:00Z"))).toBe("inside");
    expect(attention(inside, Date.parse("2026-11-07T04:00:00Z"))).toBe("overstay");
    expect(attention({ ...inside, incidentAt: "2026-11-07T03:05:00Z" }, Date.parse("2026-11-07T04:00:00Z"))).toBe(
      "incident",
    );
    expect(attention(access(), Date.parse("2026-11-07T03:10:00Z"))).toBeNull();
    expect(attention(null, 0)).toBeNull();
  });
});

describe("viewing week", () => {
  it("starts on Monday in Bangkok and gives the API window", () => {
    // Sunday 8 Nov 2026, 23:30 Bangkok = 16:30 UTC.
    const week = viewingWeek(undefined, Date.parse("2026-11-08T16:30:00Z"));
    expect(week.start).toBe("2026-11-02");
    expect(week.days).toHaveLength(7);
    expect(week.days[6]).toBe("2026-11-08");
    expect(week.from).toBe("2026-11-01T17:00:00.000Z");
    expect(week.to).toBe("2026-11-08T17:00:00.000Z");
    expect(week.previous).toBe("2026-10-26");
    expect(week.next).toBe("2026-11-09");
  });

  it("accepts any day of a week and ignores a malformed one", () => {
    expect(viewingWeek("2026-11-05", 0).start).toBe("2026-11-02");
    expect(viewingWeek("not-a-date", Date.parse("2026-11-05T05:00:00Z")).start).toBe("2026-11-02");
  });

  it("groups viewings by Bangkok day in time order", () => {
    const week = viewingWeek("2026-11-02", 0);
    const grouped = byDay(
      [
        { id: "b", startsAt: "2026-11-02T08:00:00Z" },
        { id: "a", startsAt: "2026-11-02T03:00:00Z" },
        { id: "late", startsAt: "2026-11-02T18:00:00Z" }, // 01:00 Tuesday in Bangkok
      ],
      week.days,
    );
    expect(grouped.get("2026-11-02")?.map((v) => v.id)).toEqual(["a", "b"]);
    expect(grouped.get("2026-11-03")?.map((v) => v.id)).toEqual(["late"]);
    expect(bangkokDay("2026-11-02T17:00:00Z")).toBe("2026-11-03");
  });
});
