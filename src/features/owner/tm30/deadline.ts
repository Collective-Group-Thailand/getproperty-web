import type { Schemas } from "@/lib/api/types";

/** Notifications still to be submitted to the Immigration Bureau. */
const OPEN = new Set<Schemas["Tm30Status"]>(["due", "generated", "downloaded"]);

export interface Tm30Deadline {
  open: boolean;
  /** The API's `overdue` (it compares with its own clock); never recomputed into "not overdue" here. */
  overdue: boolean;
  /** Whole hours left until `dueAt` (0 once it has passed) — for the "due in 6 h" hint only. */
  hoursLeft: number;
  /** Due within the last quarter of the 24-hour window (the API reminds 6 h before). */
  soon: boolean;
}

/**
 * The 24-hour TM30 deadline of one notification (Immigration Act B.E. 2522 s.38, D-052, D-216) as the
 * console shows it. `dueAt` and `overdue` are the API's; this only says how close it is.
 */
export function tm30Deadline(
  row: Pick<Schemas["Tm30ExportDto"], "status" | "dueAt" | "overdue">,
  now: number,
): Tm30Deadline {
  const open = OPEN.has(row.status);
  const left = Date.parse(row.dueAt) - now;
  const hoursLeft = Number.isFinite(left) ? Math.max(0, Math.floor(left / 3_600_000)) : 0;
  return { open, overdue: open && row.overdue, hoursLeft, soon: open && !row.overdue && left <= 6 * 3_600_000 };
}

/** The required fields the API says are missing (`missing`), in the order the Immigration file lists them. */
export const TM30_FIELDS = [
  "passportNo",
  "nationality",
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "arrivalDate",
] as const;

export function missingFields(missing: readonly string[]): string[] {
  const known = TM30_FIELDS.filter((field) => missing.includes(field));
  return [...known, ...missing.filter((field) => !(TM30_FIELDS as readonly string[]).includes(field))];
}
