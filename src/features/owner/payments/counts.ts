import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/** Slips waiting for a person — the count on the Money tabs. */
export async function slipsToReview(api: ApiClient): Promise<number | undefined> {
  return unwrap(api.GET("/v1/owner/slip-reviews", { params: { query: { status: "pending_review", perPage: 1 } } }))
    .then((page) => page.meta.total)
    .catch(() => undefined);
}

/**
 * Held payments (D-220): `GET /v1/owner/payments?status=pending` and those of them the API held as a
 * possible duplicate (`heldReason`). The list endpoint has no `held` filter, so the first 100 pending payments
 * are read and the held ones kept — CONTRACT-REQUEST (docs/contract-requests.md) for a filter and a dashboard
 * count; until then more than 100 waiting payments show the first 100.
 */
export async function heldPayments(api: ApiClient, buildingId?: string): Promise<Schemas["PaymentDto"][]> {
  const page = await unwrap(
    api.GET("/v1/owner/payments", { params: { query: { status: "pending", perPage: 100, buildingId } } }),
  );
  return page.data.filter((payment) => payment.heldReason !== null);
}

/** How many held payments wait — the count on the Money tabs and the dashboard; `undefined` when unreadable. */
export function heldCount(api: ApiClient, buildingId?: string): Promise<number | undefined> {
  return heldPayments(api, buildingId).then(
    (list) => list.length,
    () => undefined,
  );
}
