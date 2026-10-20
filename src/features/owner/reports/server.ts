import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/**
 * CONTRACT-REQUEST: `GET /v1/owner/pilot-kpis?window=30d|90d` — the tenant's own pilot KPIs (D-083,
 * B6.3 "insights") as the admin reads them at `/v1/admin/tenants/{id}/pilot-kpis`
 * (docs/contract-requests.md). Same client, headers and errors as every call; only the path is not typed
 * until the contract publishes it. The answer is the contract's `PilotKpisDto`; a 404 means the tenant
 * has no pilot agreement (or the API does not serve it yet) and the page says so.
 */
export function ownerPilotKpis(api: ApiClient, window: Schemas["KpiWindow"]): Promise<Schemas["PilotKpisDto"]> {
  return unwrap(api.GET("/v1/owner/pilot-kpis" as never, { params: { query: { window } } } as never)) as Promise<
    Schemas["PilotKpisDto"]
  >;
}
