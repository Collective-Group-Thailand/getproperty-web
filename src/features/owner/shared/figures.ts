import "server-only";

import { cache } from "react";

import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import { focusedBuilding, type OwnerContext } from "./server";

/**
 * The month's figures of the focused building (or all) as the API counts them (`GET /v1/owner/dashboard`): the
 * figures rows of the money lists read them from here, once per request. `null` when the API cannot say — the row
 * is then left out, never filled in by the page.
 */
export const monthFigures = cache(async (context: OwnerContext): Promise<Schemas["DashboardDto"] | null> =>
  unwrap(
    context.api.GET("/v1/owner/dashboard", { params: { query: { buildingId: focusedBuilding(context)?.id } } }),
  ).catch(() => null),
);
