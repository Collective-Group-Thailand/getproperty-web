import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REMIND_DAYS_KEY, renewalReminder } from "./reminders";

const setting = (value: unknown) => [{ key: REMIND_DAYS_KEY, value }] as never;

/** Review L6: the renewals empty state names reminder days only as the API's setting sends them (D-294). */
describe("renewal reminder hint (review L6)", () => {
  it("uses the days in force, says off for [], and names no days when the setting is not sent", () => {
    expect(renewalReminder(setting([90]))).toEqual({ kind: "days", days: [90] });
    expect(renewalReminder(setting([30, 60]))).toEqual({ kind: "days", days: [60, 30] });
    expect(renewalReminder(setting([]))).toEqual({ kind: "off" });
    expect(renewalReminder([{ key: "reminders.schedule", value: [1, 3, 7] }] as never)).toEqual({ kind: "unknown" });
    expect(renewalReminder(null)).toEqual({ kind: "unknown" });
    expect(renewalReminder(setting("60,30"))).toEqual({ kind: "unknown" });
  });

  it.each(["th", "en"])("%s copy holds no hard-coded number of days", (locale) => {
    const messages = JSON.parse(
      readFileSync(join(__dirname, "../../../i18n/messages", locale, "owner/contracts.json"), "utf8"),
    ) as { renewals: { emptyHint: unknown } };
    expect(JSON.stringify(messages.renewals.emptyHint)).not.toMatch(/\d/);
    expect(JSON.stringify(messages.renewals.emptyHint)).toContain("{days}");
  });
});
