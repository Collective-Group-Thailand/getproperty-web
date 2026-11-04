import "server-only";

import { cache } from "react";

import { unwrap } from "@/lib/api/client";

import type { OwnerContext } from "./server";

const PERIOD = /^\d{4}-\d{2}$/;

/** A `YYYY-MM` search parameter, or `undefined` when it is not one. */
export function periodParam(value: string | undefined): string | undefined {
  return value && PERIOD.test(value) ? value : undefined;
}

/**
 * The months a list can be filtered by (G3 `PeriodPicker`): the API's billing-cycle periods, newest first, plus the
 * ones the page must offer (the chosen one, a default) — never a calendar the page makes up. Needs API: a period
 * list per list endpoint (payments by paid month, documents by issue month); the cycles stand in for it.
 */
export const billingPeriods = cache(async (context: OwnerContext, ...extra: (string | undefined)[]) => {
  const cycles = await unwrap(context.api.GET("/v1/owner/billing-cycles", { params: { query: { perPage: 36 } } }))
    .then((page) => page.data.map((cycle) => cycle.periodKey))
    .catch(() => [] as string[]);
  return [...new Set([...cycles, ...extra].filter((key): key is string => Boolean(key && PERIOD.test(key))))].sort(
    (a, b) => b.localeCompare(a),
  );
});
