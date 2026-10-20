import "server-only";

import { unwrap } from "@/lib/api/client";

import type { StaffScope } from "../shared/server";

export interface StaffUnitChoice {
  id: string;
  unitNo: string;
  floorName: string | null;
}

/**
 * The focused building's units for the parcel intake (`GET /v1/staff/buildings/{buildingId}/units`, my
 * buildings only, D-090), in the API's order (floor level, then unit number). An inactive unit receives no
 * parcels, so it is not offered.
 */
export async function intakeUnits(scope: StaffScope): Promise<StaffUnitChoice[] | null> {
  if (!scope.buildingId) return [];
  const units = await unwrap(
    scope.api.GET("/v1/staff/buildings/{buildingId}/units", { params: { path: { buildingId: scope.buildingId } } }),
  )
    .then((body) => body.data)
    .catch(() => null);
  if (!units) return null;
  return units
    .filter((unit) => unit.status !== "inactive")
    .map((unit) => ({ id: unit.id, unitNo: unit.unitNo, floorName: unit.floorName }));
}
