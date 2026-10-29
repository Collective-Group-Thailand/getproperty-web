import { formatPeriodKey } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";

/*
 * Verified reviews (G9, D-301): how a review's facts are shown everywhere (owner console, moderators, public page).
 * Tenure is months only — the API never sends exact dates of the reviewer.
 */

/** The tenure as month labels (`from`, and `to` when they moved out). */
export function reviewTenure(tenure: Schemas["ReviewTenureDto"], locale: Locale): { from: string; to: string } {
  return { from: formatPeriodKey(tenure.from, locale), to: tenure.to ? formatPeriodKey(tenure.to, locale) : "" };
}

/**
 * The bars of a rating distribution, 5 stars first: the API sends counts per star (index 0 = 1 star); the width is
 * each count's share of the largest bar (a presentation ratio, not a figure shown as a number).
 */
export function ratingBars(distribution: number[]): { stars: number; count: number; width: number }[] {
  const counts = [1, 2, 3, 4, 5].map((stars) => ({ stars, count: Math.max(0, distribution[stars - 1] ?? 0) }));
  const max = Math.max(1, ...counts.map((row) => row.count));
  return counts.reverse().map((row) => ({ ...row, width: Math.round((row.count / max) * 100) }));
}

/** A `?reviews=` page number for the public listing page (1 when missing or malformed). */
export function reviewsPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = raw && /^\d{1,4}$/.test(raw) ? Number(raw) : 1;
  return page >= 1 ? page : 1;
}
