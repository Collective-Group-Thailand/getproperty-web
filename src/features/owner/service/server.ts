import "server-only";

import type { Locale } from "@/i18n/routing";
import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/** The tenant's service categories in force (platform defaults with the tenant's overrides, D-210). */
export async function serviceCategories(api: ApiClient, includeInactive = false) {
  return unwrap(api.GET("/v1/owner/service-categories", { params: { query: { includeInactive } } }))
    .then((body) => body.data)
    .catch(() => [] as Schemas["ServiceCategoryDto"][]);
}

/** A category's name in the console's language (the API sends both). */
export function categoryName(
  category: Pick<Schemas["ServiceCategoryRefDto"], "nameTh" | "nameEn">,
  locale: Locale,
): string {
  return locale === "th" ? category.nameTh : category.nameEn;
}

/** A unit choice (unit number, floor) for the forms of a building. */
export interface UnitChoice {
  id: string;
  unitNo: string;
  floorLevel: number | null;
}

/**
 * The units of a building for a choice list (new request, parcel, lock, audience): every page of
 * `GET /v1/owner/units?buildingId=` up to 500 units, sorted as the API returns them.
 */
export async function buildingUnits(api: ApiClient, buildingId: string): Promise<UnitChoice[]> {
  const units: UnitChoice[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const body = await unwrap(
      api.GET("/v1/owner/units", { params: { query: { buildingId, page, perPage: 100, sort: "unitNo" } } }),
    ).catch(() => null);
    if (!body) break;
    units.push(...body.data.map((unit) => ({ id: unit.id, unitNo: unit.unitNo, floorLevel: unit.floorLevel })));
    if (page * body.meta.perPage >= body.meta.total) break;
  }
  return units;
}
