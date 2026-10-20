import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import { buildingUnits } from "../service/server";

/** A building with its floors and units — the audience choices of an announcement. */
export async function audienceChoices(api: ApiClient, buildings: Schemas["BuildingDto"][]) {
  return Promise.all(
    buildings.map(async (building) => {
      const [floors, units] = await Promise.all([
        unwrap(
          api.GET("/v1/owner/buildings/{buildingId}/floors", { params: { path: { buildingId: building.id } } }),
        ).catch(() => [] as Schemas["FloorDto"][]),
        buildingUnits(api, building.id),
      ]);
      return {
        id: building.id,
        name: building.name,
        floors: [...floors].sort((a, b) => a.level - b.level).map((floor) => ({ id: floor.id, name: floor.name })),
        units: units.map((unit) => ({ id: unit.id, unitNo: unit.unitNo })),
      };
    }),
  );
}

/** Draft, published or archived — the announcement's state from its timestamps (the API has no enum for it). */
export function announcementState(
  announcement: Pick<Schemas["AnnouncementDto"], "publishedAt" | "archivedAt">,
): "draft" | "published" | "archived" {
  if (announcement.archivedAt) return "archived";
  return announcement.publishedAt ? "published" : "draft";
}
