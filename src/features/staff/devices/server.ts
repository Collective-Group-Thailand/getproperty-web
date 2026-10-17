import "server-only";

import { unwrap } from "@/lib/api/client";
import type { StaffMeterPoint } from "@/lib/api/pending";
import { getPending } from "@/lib/api/pending-client";
import type { Schemas } from "@/lib/api/types";

import type { StaffScope } from "../shared/server";

export interface BuildingDevices {
  devices: Schemas["FleetDeviceDto"][];
  /** `null` while `GET /v1/staff/buildings/{id}/meters` is a contract request the API does not answer. */
  points: StaffMeterPoint[] | null;
}

/** The focused building's devices and meter points (F4 4.3). */
export async function buildingDevices(scope: StaffScope): Promise<BuildingDevices> {
  if (!scope.buildingId) return { devices: [], points: [] };
  const [devices, points] = await Promise.all([
    unwrap(scope.api.GET("/v1/staff/devices", { params: { query: { buildingId: scope.buildingId, perPage: 100 } } }))
      .then((page) => page.data)
      .catch(() => [] as Schemas["FleetDeviceDto"][]),
    getPending<{ data: StaffMeterPoint[] }>(
      scope.api,
      `/v1/staff/buildings/${encodeURIComponent(scope.buildingId)}/meters`,
    )
      .then((body) => body.data)
      .catch(() => null),
  ]);
  return { devices, points };
}

export const isGateway = (device: Schemas["FleetDeviceDto"]) => device.kind === "gateway";
export const USABLE_GATEWAY = new Set<Schemas["DeviceStatus"]>(["online", "degraded", "provisioned"]);
