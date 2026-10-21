import { describe, expect, it } from "vitest";

import { missingFields, tm30Deadline } from "./deadline";

const NOW = Date.parse("2026-11-01T12:00:00+07:00");
const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

describe("tm30Deadline", () => {
  it("counts whole hours left of an open notification", () => {
    expect(tm30Deadline({ status: "due", dueAt: at(18.5), overdue: false }, NOW)).toEqual({
      open: true,
      overdue: false,
      hoursLeft: 18,
      soon: false,
    });
  });

  it("marks the last six hours as soon", () => {
    expect(tm30Deadline({ status: "generated", dueAt: at(5), overdue: false }, NOW).soon).toBe(true);
  });

  it("takes overdue from the API and never shows negative hours", () => {
    const deadline = tm30Deadline({ status: "downloaded", dueAt: at(-3), overdue: true }, NOW);
    expect(deadline).toMatchObject({ overdue: true, hoursLeft: 0, soon: false });
  });

  it("is closed once submitted or cancelled, whatever the clock says", () => {
    expect(tm30Deadline({ status: "submitted_manually", dueAt: at(-30), overdue: false }, NOW)).toMatchObject({
      open: false,
      overdue: false,
      soon: false,
    });
    expect(tm30Deadline({ status: "cancelled", dueAt: at(2), overdue: false }, NOW).open).toBe(false);
  });
});

describe("missingFields", () => {
  it("orders the API's missing fields as the Immigration file does and keeps unknown ones last", () => {
    expect(missingFields(["arrivalDate", "visaType", "passportNo"])).toEqual(["passportNo", "arrivalDate", "visaType"]);
  });
});
