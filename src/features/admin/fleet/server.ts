import "server-only";

import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import type { AdminContext } from "../shared/server";

/**
 * The buildings a tenant owns or operates (`GET /v1/admin/tenants/{tenantId}/buildings`, D-214) — to name a
 * device's building on its page. An empty list when the tenant is unknown or the read fails (the id is shown).
 */
export async function tenantBuildings(
  context: AdminContext,
  tenantId: string | null | undefined,
): Promise<Schemas["AdminBuildingDto"][]> {
  if (!tenantId) return [];
  return unwrap(context.api.GET("/v1/admin/tenants/{tenantId}/buildings", { params: { path: { tenantId } } })).catch(
    () => [],
  );
}
