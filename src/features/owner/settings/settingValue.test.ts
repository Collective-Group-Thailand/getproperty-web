import { describe, expect, it } from "vitest";

import { bangkokInstant, parseSettingValue } from "@/features/shared/console/SettingEditor";

import { settingValueFrom } from "./OwnerSettingEditor";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("settingValueFrom", () => {
  it("builds the cut-off from the mode, day and time", () => {
    const current = { day: "end_of_month", time: "23:59", timezone: "Asia/Bangkok" };
    expect(settingValueFrom("billing.cutoff", "json", form({ mode: "end_of_month", time: "22:00" }), current)).toEqual({
      day: "end_of_month",
      time: "22:00",
      timezone: "Asia/Bangkok",
    });
    expect(
      settingValueFrom("billing.cutoff", "json", form({ mode: "day", day: "25", time: "23:59" }), current),
    ).toEqual({
      day: 25,
      time: "23:59",
      timezone: "Asia/Bangkok",
    });
    expect(
      settingValueFrom("billing.cutoff", "json", form({ mode: "day", day: "31", time: "23:59" }), current),
    ).toBeUndefined();
    expect(
      settingValueFrom("billing.cutoff", "json", form({ mode: "day", day: "5", time: "25:00" }), current),
    ).toBeUndefined();
  });

  it("sorts and de-duplicates reminder days", () => {
    expect(settingValueFrom("reminders.schedule", "json", form({ days: "7, 1 3,3" }), [1, 3, 7])).toEqual([1, 3, 7]);
    expect(settingValueFrom("reminders.schedule", "json", form({ days: "" }), [1])).toBeUndefined();
    expect(settingValueFrom("reminders.schedule", "json", form({ days: "1, x" }), [1])).toBeUndefined();
  });

  it("keeps the time zone of quiet hours", () => {
    expect(
      settingValueFrom("notifications.quiet_hours", "json", form({ start: "22:00", end: "07:30" }), {
        start: "21:00",
        end: "08:00",
        timezone: "Asia/Bangkok",
      }),
    ).toEqual({ start: "22:00", end: "07:30", timezone: "Asia/Bangkok" });
  });

  it("reads auto-issue from the checkbox and the hours", () => {
    expect(
      settingValueFrom("billing.auto_issue", "json", form({ enabled: "on", afterHours: "12" }), {
        enabled: false,
        afterHours: 24,
      }),
    ).toEqual({
      enabled: true,
      afterHours: 12,
    });
    expect(settingValueFrom("billing.auto_issue", "json", form({ afterHours: "-1" }), {})).toBeUndefined();
  });

  it("falls back to the typed value for other keys", () => {
    expect(settingValueFrom("deposit.refund_days", "int", form({ value: "7" }), 7)).toBe(7);
    expect(settingValueFrom("late_fee.amount", "money", form({ value: "50.00" }), "0.00")).toBe("50.00");
    expect(settingValueFrom("payments.allow_partial", "bool", form({ value: "true" }), false)).toBe(true);
  });
});

describe("setting editor helpers", () => {
  it("parses typed values", () => {
    expect(parseSettingValue("int", "12")).toBe(12);
    expect(parseSettingValue("int", "1.5")).toBeUndefined();
    expect(parseSettingValue("decimal", "0.07")).toBe("0.07");
    expect(parseSettingValue("json", "[1,3]")).toEqual([1, 3]);
    expect(parseSettingValue("json", "{")).toBeUndefined();
  });

  it("reads a datetime-local value as Bangkok time", () => {
    expect(bangkokInstant("2026-11-01T09:00")).toBe("2026-11-01T02:00:00.000Z");
    expect(bangkokInstant("")).toBeUndefined();
    expect(bangkokInstant(undefined)).toBeUndefined();
  });
});
