import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/**
 * The tenant's own pilot KPIs (`GET /v1/owner/pilot-kpis?window=`, D-083, D-214) — the seven measures the
 * platform admin reads for the tenant, against the pilot agreement's baseline and targets. A 404 means the
 * tenant has no pilot agreement and the page says so.
 */
export function ownerPilotKpis(api: ApiClient, window: Schemas["KpiWindow"]): Promise<Schemas["PilotKpisDto"]> {
  return unwrap(api.GET("/v1/owner/pilot-kpis", { params: { query: { window } } }));
}
