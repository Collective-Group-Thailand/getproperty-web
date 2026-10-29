import type { Schemas } from "@/lib/api/types";

/** D-294: the days before a lease ends on which the office is reminded — a setting a tenant may change; `[]` = off. */
export const REMIND_DAYS_KEY = "lease.renewal.remind_days";

export type RenewalReminder = { kind: "days"; days: number[] } | { kind: "off" } | { kind: "unknown" };

/**
 * What the renewals page may say about reminders (review L6): only what the API's settings say — the days in force,
 * "off" for an empty list, and nothing about days when the setting was not sent or could not be read.
 */
export function renewalReminder(settings: Schemas["SettingDto"][] | null | undefined): RenewalReminder {
  const value = settings?.find((setting) => setting.key === REMIND_DAYS_KEY)?.value;
  if (!Array.isArray(value)) return { kind: "unknown" };
  const days = value.filter((day): day is number => typeof day === "number" && Number.isInteger(day) && day > 0);
  if (value.length === 0) return { kind: "off" };
  if (days.length !== value.length) return { kind: "unknown" };
  return { kind: "days", days: [...days].sort((a, b) => b - a) };
}
