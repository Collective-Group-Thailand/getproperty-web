import type { Schemas } from "@/lib/api/types";

export const SERIES_BUCKETS: Schemas["SeriesBucket"][] = ["15m", "1h", "1d"];

/**
 * The window the meter page asks `GET /v1/owner/meters/{assetItemId}/series` for, per bucket, ending now: a day of
 * 15-minute points, a week of hours, a month of days.
 *
 * D-241 (T-14): 15-minute points are computed from raw points, which are kept for 24 months; hourly and daily
 * rollups for 5 years. Same response shape, so the chart needs no change — but a 15-minute window must stay
 * inside raw retention (`seriesWindowFits`), and anything older is asked for in `1h` / `1d`.
 */
export const SERIES_RANGE_MS: Record<Schemas["SeriesBucket"], number> = {
  "15m": 86_400_000,
  "1h": 7 * 86_400_000,
  "1d": 30 * 86_400_000,
};

/** How far back each bucket's data exists (D-241): 15-minute = raw retention 24 months, hourly / daily 5 years. */
export const SERIES_RETENTION_MONTHS: Record<Schemas["SeriesBucket"], number> = {
  "15m": 24,
  "1h": 60,
  "1d": 60,
};

/** Whether a window starting at `from` still has data in `bucket` at `now` (calendar months, Bangkok-agnostic). */
export function seriesWindowFits(bucket: Schemas["SeriesBucket"], from: Date, now: Date): boolean {
  const oldest = new Date(now);
  oldest.setUTCMonth(oldest.getUTCMonth() - SERIES_RETENTION_MONTHS[bucket]);
  return from.getTime() >= oldest.getTime();
}

/** The bucket to ask for a window starting at `from`: the requested one, or the next coarser one that still has data. */
export function seriesBucketFor(bucket: Schemas["SeriesBucket"], from: Date, now: Date): Schemas["SeriesBucket"] {
  const order = SERIES_BUCKETS.slice(SERIES_BUCKETS.indexOf(bucket));
  return order.find((candidate) => seriesWindowFits(candidate, from, now)) ?? "1d";
}
