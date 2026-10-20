import "server-only";

import { unwrap } from "@/lib/api/client";

import type { StaffScope } from "../shared/server";

export interface StaffUnitChoice {
  id: string;
  unitNo: string;
  floorName: string | null;
}

/**
 * The focused building's units for the parcel intake. The staff surface lists no units (contract request
 * `GET /v1/staff/buildings/{buildingId}/units`), so they are the units of the building's meter points
 * (`GET /v1/staff/buildings/{id}/meters`) — every rented unit has its meters.
 */
export async function intakeUnits(scope: StaffScope): Promise<StaffUnitChoice[] | null> {
  if (!scope.buildingId) return [];
  const points = await unwrap(
    scope.api.GET("/v1/staff/buildings/{buildingId}/meters", { params: { path: { buildingId: scope.buildingId } } }),
  )
    .then((body) => body.data)
    .catch(() => null);
  if (!points) return null;
  const units = new Map<string, StaffUnitChoice>();
  for (const point of points)
    if (point.unitId && point.unitNo && !units.has(point.unitId))
      units.set(point.unitId, { id: point.unitId, unitNo: point.unitNo, floorName: point.floorName });
  return [...units.values()].sort((a, b) => a.unitNo.localeCompare(b.unitNo));
}
