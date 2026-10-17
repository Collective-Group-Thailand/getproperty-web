import "server-only";

import { cache } from "react";

import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import type { AdminMe, OperatorMeByZone } from "@/lib/api/types";
import { unwrap } from "@/lib/api/client";

export type OperatorZone = keyof OperatorMeByZone;
export type OperatorActor<Z extends OperatorZone = OperatorZone> = {
  [K in Z]: { kind: "operator"; me: OperatorMeByZone[K]; zone: K };
}[Z];
export type PlatformActor = { kind: "platform"; me: AdminMe; zone: "admin" };

const TENANT_CONTEXT_CODES = new Set(["tenant.context_invalid", "tenant.context_required", "tenant.not_in_scope"]);

/**
 * Who is signed in to an operator zone, from `/v1/{owner|staff}/me` (cached per request with React
 * `cache`, so the layout, the page and the shell share one call). `null` = not signed in on this
 * host. A stale tenant choice (the cookie names a tenant the user no longer belongs to) is retried
 * without `X-Tenant-Id`, which yields `currentTenant: null` for operators of several tenants — the
 * guard then sends them to the tenant picker.
 */
const fetchOperatorActor = cache(async (zone: OperatorZone): Promise<OperatorActor | null> => {
  const read = async (withoutTenant: boolean): Promise<OperatorActor> => {
    const api = await serverApi(zone, withoutTenant ? { withoutTenant: true } : undefined);
    return zone === "owner"
      ? { kind: "operator", zone, me: await unwrap(api.GET("/v1/owner/me")) }
      : { kind: "operator", zone, me: await unwrap(api.GET("/v1/staff/me")) };
  };
  try {
    return await read(false);
  } catch (error) {
    if (!isApiError(error)) throw error;
    if (error.status === 401 || error.code === "auth.wrong_audience") return null;
    if (TENANT_CONTEXT_CODES.has(error.code)) return read(true);
    throw error;
  }
});

export function getOperatorActor<Z extends OperatorZone>(zone: Z): Promise<OperatorActor<Z> | null> {
  return fetchOperatorActor(zone) as Promise<OperatorActor<Z> | null>;
}

/** Who is signed in to the admin zone, from `/v1/admin/me`; `null` = not signed in on this host. */
export const getPlatformActor = cache(async (): Promise<PlatformActor | null> => {
  try {
    const api = await serverApi("admin");
    return { kind: "platform", zone: "admin", me: await unwrap(api.GET("/v1/admin/me")) };
  } catch (error) {
    if (isApiError(error) && (error.status === 401 || error.code === "auth.wrong_audience")) return null;
    throw error;
  }
});
