import "server-only";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";

import { BUILDING_COOKIE } from "@/features/shared/shell/building";
import { getOperatorActor } from "@/lib/auth/actor";
import { requireOperator } from "@/lib/auth/guards";
import { unwrap, type ApiClient } from "@/lib/api/client";
import { serverApi } from "@/lib/api/server";
import type { OwnerMe, Schemas } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export interface OwnerContext {
  api: ApiClient;
  me: OwnerMe;
  locale: Locale;
  /** Every building the tenant sees (as owner, operator or through a grant, D-152). */
  buildings: Schemas["BuildingDto"][];
  properties: Schemas["PropertyDto"][];
  /** The building the top-bar switcher is focused on; `null` = all buildings. */
  building: Schemas["BuildingDto"] | null;
}

/**
 * What every owner page starts from (F2): the API client of this request, `me`, the tenant's buildings
 * and properties, and the switcher's focus (`gp_building`, a view preference — the API checks every
 * id itself). Cached per request so the shell, the page and its sections share one round trip.
 */
export const ownerContext = cache(async (): Promise<OwnerContext> => {
  const [api, actor, jar, locale] = await Promise.all([
    serverApi("owner"),
    getOperatorActor("owner"),
    cookies(),
    getLocale(),
  ]);
  // Signed out (or the session ended) while the page renders next to the layout's guard: redirect the same way
  // rather than throw — a throw here logged a server error for every signed-out visit.
  const me = actor
    ? actor.me
    : (
        await requireOperator("owner", {
          login: getPathname({ href: "/login", locale: locale as Locale }),
          selectTenant: getPathname({ href: "/select-tenant", locale: locale as Locale }),
        })
      ).me;
  const [buildings, properties] = await Promise.all([
    unwrap(api.GET("/v1/owner/buildings")).catch(() => [] as Schemas["BuildingDto"][]),
    unwrap(api.GET("/v1/owner/properties")).catch(() => [] as Schemas["PropertyDto"][]),
  ]);
  const focus = jar.get(BUILDING_COOKIE)?.value;
  return {
    api,
    me,
    locale: locale as Locale,
    buildings,
    properties,
    building: buildings.find((building) => building.id === focus) ?? null,
  };
});

/** The focused building, or the only one when the tenant has a single building. */
export function focusedBuilding(context: OwnerContext): Schemas["BuildingDto"] | null {
  return context.building ?? (context.buildings.length === 1 ? context.buildings[0]! : null);
}

export { pageParam, param, section } from "@/features/shared/console/params";

/**
 * Tenant permissions (docs/rbac.md, D-090) as `/v1/owner/me` lists them. The console hides what the
 * member cannot do; the API stays the enforcement point. Prefer an aggregate's `nextActions`.
 */
export function ownerCan(me: OwnerMe, permission: string): boolean {
  return me.permissions.includes(permission);
}

/** Whether the tenant's subscription is read-only (suspended, D-082): mutations are not rendered. */
export function readOnly(me: OwnerMe): boolean {
  return me.subscription?.readOnly ?? false;
}
