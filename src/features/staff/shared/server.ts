import "server-only";

import { cookies } from "next/headers";

import { BUILDING_COOKIE } from "@/features/shared/shell/building";
import { unwrap, type ApiClient } from "@/lib/api/client";
import type { StaffBuilding } from "@/lib/api/pending";
import { getPending } from "@/lib/api/pending-client";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export interface StaffScope {
  api: ApiClient;
  /** The buildings of my scope (Staff: `currentTenant.buildingIds`, D-090). */
  buildings: Pick<StaffBuilding, "id" | "name">[];
  /** The building the PWA is focused on (switcher cookie, else the first one). */
  buildingId: string | null;
  /** The reading round of every building, read once for the scope (and reused by the pages). */
  rounds: Schemas["RoundBuildingDto"][];
}

/**
 * The staff member's buildings and the focused one. `GET /v1/staff/buildings` is a contract request;
 * until the API publishes it the list comes from the reading round, which answers per building of the
 * staff member's scope (B3.3) — so the switcher works against the real API today.
 */
export async function staffScope(): Promise<StaffScope> {
  const api = await serverApi("staff");
  const [rounds, listed, jar] = await Promise.all([
    unwrap(api.GET("/v1/staff/reading-rounds/current", { params: { query: {} } })).catch(
      () => [] as Schemas["RoundBuildingDto"][],
    ),
    getPending<{ data: StaffBuilding[] }>(api, "/v1/staff/buildings")
      .then((body) => body.data)
      .catch(() => null),
    cookies(),
  ]);
  const buildings = listed ?? rounds.map((round) => ({ id: round.buildingId, name: round.buildingName }));
  const wanted = jar.get(BUILDING_COOKIE)?.value;
  const buildingId = buildings.find((building) => building.id === wanted)?.id ?? buildings[0]?.id ?? null;
  return { api, buildings, buildingId, rounds };
}
