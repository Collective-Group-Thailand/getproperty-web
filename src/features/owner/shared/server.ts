import "server-only";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";

import { BUILDING_COOKIE } from "@/features/shared/shell/building";
import { getOperatorActor } from "@/lib/auth/actor";
import { unwrap, type ApiClient } from "@/lib/api/client";
import { serverApi } from "@/lib/api/server";
import type { OwnerMe, Schemas } from "@/lib/api/types";
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
  if (!actor) throw new Error("ownerContext outside the signed-in console");
  const [buildings, properties] = await Promise.all([
    unwrap(api.GET("/v1/owner/buildings")).catch(() => [] as Schemas["BuildingDto"][]),
    unwrap(api.GET("/v1/owner/properties")).catch(() => [] as Schemas["PropertyDto"][]),
  ]);
  const focus = jar.get(BUILDING_COOKIE)?.value;
  return {
    api,
    me: actor.me,
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

/** A page's `searchParams` value as one string (`?a=1&a=2` → the first). */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A 1-based page number from the URL, never below 1. */
export function pageParam(value: string | string[] | undefined): number {
  const page = Number(param(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Runs an API read for a section of a page; a failure becomes `{ error }` for the section's error state. */
export async function section<T>(read: Promise<T>): Promise<{ data: T; error: null } | { data: null; error: unknown }> {
  try {
    return { data: await read, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
