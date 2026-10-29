import type { Schemas } from "@/lib/api/types";

/*
 * Self-viewing on the owner side (G7, D-295): pure helpers shared by the availability editor, the enquiry viewings
 * and the viewing calendar. Nothing here decides who may enter — the API issues and revokes door codes; the console
 * only shows what it answers.
 */

export interface SelfViewingRules {
  /** `viewing.self.enabled` for this tenant (off until O-024: insurance partner and visitor terms). */
  enabled: boolean;
  /** `viewing.self.code_early_minutes` — the code opens this many minutes before the slot starts. */
  earlyMinutes: number | null;
  /** `viewing.self.code_minutes` — and keeps opening for this many minutes after the start. */
  codeMinutes: number | null;
  /** `viewing.self.overstay_minutes` — a visitor still inside this long after the window is reported. */
  overstayMinutes: number | null;
}

const int = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** The self-viewing settings in force for the tenant, from `GET /v1/owner/settings` (absent = off). */
export function selfViewingRules(settings: Schemas["SettingDto"][] | null | undefined): SelfViewingRules {
  const value = (key: string) => settings?.find((setting) => setting.key === key)?.value;
  return {
    enabled: value("viewing.self.enabled") === true,
    earlyMinutes: int(value("viewing.self.code_early_minutes")),
    codeMinutes: int(value("viewing.self.code_minutes")),
    overstayMinutes: int(value("viewing.self.overstay_minutes")),
  };
}

type Access = Schemas["ViewingAccessSummaryDto"];

/** Door-code windows the owner can still close early (codes issued or the visitor inside). */
export function canEndAccess(access: Access | null | undefined): boolean {
  return !!access && !access.closedAt && (access.state === "issued" || access.state === "entered");
}

/** The visitor is still inside after the code window (the API alerts once; the console keeps showing it). */
export function overstaying(access: Access | null | undefined, now: number): boolean {
  return !!access && access.state === "entered" && !access.exitedAt && Date.parse(access.validTo) < now;
}

export type Attention = "incident" | "overstay" | "inside" | null;

/** What a self viewing asks of the owner right now: an incident, an overstay, a visitor inside — in that order. */
export function attention(access: Access | null | undefined, now: number): Attention {
  if (!access) return null;
  if (access.incidentAt && !access.closedAt) return "incident";
  if (overstaying(access, now)) return "overstay";
  if (access.state === "entered" && !access.exitedAt) return "inside";
  return null;
}

const DAY = 86_400_000;
const BANGKOK = 7 * 3_600_000;
const isDate = (value: string | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** The Bangkok calendar day (`YYYY-MM-DD`) of an instant. */
export function bangkokDay(instant: string | number): string {
  const time = typeof instant === "number" ? instant : Date.parse(instant);
  return new Date(time + BANGKOK).toISOString().slice(0, 10);
}

export interface Week {
  /** Monday of the week (`YYYY-MM-DD`, Bangkok). */
  start: string;
  /** The seven days, Monday first. */
  days: string[];
  /** `from` / `to` for `GET /v1/owner/listing-viewings` (Bangkok midnight to the next Monday's midnight). */
  from: string;
  to: string;
  previous: string;
  next: string;
}

/** The week (Monday–Sunday, Bangkok) holding `week` (any day of it) or today. */
export function viewingWeek(week: string | undefined, now: number): Week {
  const day = isDate(week) ? week : bangkokDay(now);
  const date = new Date(`${day}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7; // Monday = 0
  const monday = date.getTime() - weekday * DAY;
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  const days = Array.from({ length: 7 }, (_, i) => iso(monday + i * DAY));
  return {
    start: days[0]!,
    days,
    from: new Date(monday - BANGKOK).toISOString(),
    to: new Date(monday + 7 * DAY - BANGKOK).toISOString(),
    previous: iso(monday - 7 * DAY),
    next: iso(monday + 7 * DAY),
  };
}

/** Viewings by Bangkok day, each day sorted by start time. */
export function byDay<T extends { startsAt: string }>(viewings: T[], days: string[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>(days.map((day) => [day, []]));
  for (const viewing of [...viewings].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    grouped.get(bangkokDay(viewing.startsAt))?.push(viewing);
  }
  return grouped;
}
