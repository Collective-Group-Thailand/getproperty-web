import "server-only";

import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import type { StaffScope } from "../shared/server";

export type StaffMeterPoint = Schemas["StaffMeterPointDto"];

export interface BuildingDevices {
  devices: Schemas["FleetDeviceDto"][];
  /** The building's meter points with their open channel; `null` when the API did not answer. */
  points: StaffMeterPoint[] | null;
  /** The edge driver catalogue (D-013); `null` when the API did not answer (the wizard offers the known keys). */
  drivers: Schemas["MeterDriverDto"][] | null;
  /** Platform install orders of the focused building (B6.1, D-205), open ones first. */
  installOrders: Schemas["StaffInstallOrderDto"][];
}

/** The focused building's devices, meter points, driver catalogue and install orders (F4 4.3). */
export async function buildingDevices(scope: StaffScope): Promise<BuildingDevices> {
  if (!scope.buildingId) return { devices: [], points: [], drivers: null, installOrders: [] };
  const buildingId = scope.buildingId;
  const [devices, points, drivers, installOrders] = await Promise.all([
    unwrap(scope.api.GET("/v1/staff/devices", { params: { query: { buildingId, perPage: 100 } } }))
      .then((page) => page.data)
      .catch(() => [] as Schemas["FleetDeviceDto"][]),
    unwrap(scope.api.GET("/v1/staff/buildings/{buildingId}/meters", { params: { path: { buildingId } } }))
      .then((body) => body.data)
      .catch(() => null),
    unwrap(scope.api.GET("/v1/staff/meter-drivers"))
      .then((body) => body.data)
      .catch(() => null),
    unwrap(scope.api.GET("/v1/staff/install-orders"))
      .then((body) => body.data.filter((order) => order.buildingId === buildingId))
      .catch(() => [] as Schemas["StaffInstallOrderDto"][]),
  ]);
  return { devices, points, drivers, installOrders };
}

export const isGateway = (device: Schemas["FleetDeviceDto"]) => device.kind === "gateway";
export const USABLE_GATEWAY = new Set<Schemas["DeviceStatus"]>(["online", "degraded", "provisioned"]);
