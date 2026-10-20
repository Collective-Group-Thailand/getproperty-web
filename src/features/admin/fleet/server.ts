import "server-only";

import { unwrap } from "@/lib/api/client";

import type { AdminContext } from "../shared/server";
import type { BuildingOption } from "./DeviceActions";

/**
 * Buildings the platform can assign a device to. The admin surface has no building list, so the
 * options are the buildings the API names elsewhere — the fleet counts (buildings with devices) and the
 * install orders (buildings being equipped); one is otherwise typed by id in the assign dialog.
 */
export async function knownBuildings(context: AdminContext): Promise<BuildingOption[]> {
  const { api } = context;
  const [fleet, orders] = await Promise.all([
    unwrap(api.GET("/v1/admin/devices/fleet")).catch(() => null),
    unwrap(api.GET("/v1/admin/install-orders", { params: { query: { perPage: 100 } } })).catch(() => null),
  ]);
  const byId = new Map<string, BuildingOption>();
  for (const row of fleet?.byBuilding ?? []) {
    byId.set(row.buildingId, {
      id: row.buildingId,
      tenantId: row.tenantId,
      label: row.tenantName ? `${row.buildingName} · ${row.tenantName}` : row.buildingName,
    });
  }
  for (const order of orders?.data ?? []) {
    if (!byId.has(order.buildingId))
      byId.set(order.buildingId, { id: order.buildingId, tenantId: order.tenantId, label: order.buildingName });
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}
