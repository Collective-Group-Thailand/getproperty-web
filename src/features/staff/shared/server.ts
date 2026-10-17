import "server-only";

import { cookies } from "next/headers";

import { BUILDING_COOKIE } from "@/features/shared/shell/building";
import { unwrap, type ApiClient } from "@/lib/api/client";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export interface StaffScope {
  api: ApiClient;
  /** The buildings of my scope (Staff: `currentTenant.buildingIds`, D-090). */
  buildings: Pick<Schemas["StaffBuildingDto"], "id" | "name">[];
  /** The building the PWA is focused on (switcher cookie, else the first one). */
  buildingId: string | null;
  /** The reading round of every building, read once for the scope; `null` when the API did not answer. */
  rounds: Schemas["RoundBuildingDto"][] | null;
}

/**
 * The staff member's buildings (`GET /v1/staff/buildings`, limited to my buildings when my membership
 * is, D-090) and the focused one. Should that read fail the list falls back to the reading round,
 * which answers per building of the same scope.
 */
export async function staffScope(): Promise<StaffScope> {
  const api = await serverApi("staff");
  const [rounds, listed, jar] = await Promise.all([
    unwrap(api.GET("/v1/staff/reading-rounds/current", { params: { query: {} } })).catch(() => null),
    unwrap(api.GET("/v1/staff/buildings"))
      .then((body) => body.data)
      .catch(() => null),
    cookies(),
  ]);
  const buildings = listed ?? (rounds ?? []).map((round) => ({ id: round.buildingId, name: round.buildingName }));
  const wanted = jar.get(BUILDING_COOKIE)?.value;
  const buildingId = buildings.find((building) => building.id === wanted)?.id ?? buildings[0]?.id ?? null;
  return { api, buildings, buildingId, rounds };
}
