/**
 * Monthly vendor evaluations (D-331): the criteria of `juristic.vendor_evaluation_criteria`, the months of a contract
 * that still wait for an evaluation, and the points of the score trend. Scores and their average are the API's.
 */

export interface Criterion {
  key: string;
  labelTh: string;
  labelEn: string;
}

/** The setting's value as criteria, defensively (an unexpected value → none, the form says so). */
export function parseCriteria(value: unknown): Criterion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Criterion[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.key !== "string" || !item.key) return [];
    const labelTh = typeof item.labelTh === "string" ? item.labelTh : item.key;
    const labelEn = typeof item.labelEn === "string" ? item.labelEn : labelTh;
    return [{ key: item.key, labelTh, labelEn }];
  });
}

/** `YYYY-MM` moved by whole months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Every month of a term from its start month to its end month, capped at `until` (this month); oldest first. */
export function termMonths(startsOn: string, endsOn: string, until: string): string[] {
  const first = startsOn.slice(0, 7);
  const last = endsOn.slice(0, 7) < until ? endsOn.slice(0, 7) : until;
  const out: string[] = [];
  for (let month = first; month <= last && out.length < 240; month = shiftMonth(month, 1)) out.push(month);
  return out;
}

/**
 * Months of the term up to this month with no evaluation yet, newest first — the months the office can still
 * evaluate (the API refuses future months and months outside the term).
 */
export function monthsToEvaluate(
  contract: { startsOn: string; endsOn: string },
  evaluated: readonly { month: string }[],
  thisMonth: string,
): string[] {
  const done = new Set(evaluated.map((entry) => entry.month));
  return termMonths(contract.startsOn, contract.endsOn, thisMonth)
    .filter((month) => !done.has(month))
    .reverse();
}

/** The month an evaluation opens on: the latest finished month still open, else the current one. */
export function defaultEvaluationMonth(open: readonly string[], thisMonth: string): string | null {
  return open.find((month) => month < thisMonth) ?? open[0] ?? null;
}

/**
 * The trend line's points: one per month from the first evaluation to the last, oldest first; a month without an
 * evaluation is a gap (`null`), never a zero. Values stay the API's strings.
 */
export function trendPoints(
  evaluations: readonly { month: string; score: string }[],
  label: (month: string) => string,
  limit = 12,
): { key: string; label: string; value: string | null }[] {
  if (evaluations.length === 0) return [];
  const sorted = [...evaluations].sort((a, b) => a.month.localeCompare(b.month));
  const last = sorted.at(-1)!.month;
  const first = sorted[0]!.month < shiftMonth(last, -(limit - 1)) ? shiftMonth(last, -(limit - 1)) : sorted[0]!.month;
  const byMonth = new Map(sorted.map((entry) => [entry.month, entry.score]));
  const out: { key: string; label: string; value: string | null }[] = [];
  for (let month = first; month <= last; month = shiftMonth(month, 1))
    out.push({ key: month, label: label(month), value: byMonth.get(month) ?? null });
  return out;
}

/** A 1–5 score as words for the scale's ends (the form shows them under 1 and 5). */
export const SCORES = [1, 2, 3, 4, 5] as const;
