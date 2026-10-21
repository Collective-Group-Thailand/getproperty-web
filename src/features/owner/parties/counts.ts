import "server-only";

import { TM30_OPEN } from "@/domain/status/tm30";
import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/** Phone sign-ins waiting for the Owner to confirm (D-226); `undefined` when unreadable. */
export function linkRequestsPending(api: ApiClient): Promise<number | undefined> {
  return unwrap(api.GET("/v1/owner/party-link-requests", { params: { query: { state: "pending", perPage: 1 } } }))
    .then((page) => page.meta.total)
    .catch(() => undefined);
}

/**
 * TM30 notifications still to be submitted (`due`, `generated`, `downloaded` — D-052, D-216), soonest deadline
 * first. The list filters one status at a time, so the three open statuses are read side by side (100 each).
 */
export async function openTm30(api: ApiClient, buildingId?: string): Promise<Schemas["Tm30ExportDto"][]> {
  const pages = await Promise.all(
    TM30_OPEN.map((status) =>
      unwrap(api.GET("/v1/owner/tm30-exports", { params: { query: { status, building: buildingId, perPage: 100 } } })),
    ),
  );
  return pages.flatMap((page) => page.data).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
