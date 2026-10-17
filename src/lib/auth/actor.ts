import "server-only";

import { cache } from "react";

import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import type { AdminMe, OperatorMe } from "@/lib/api/types";
import { unwrap } from "@/lib/api/client";

export type OperatorActor = { kind: "operator"; me: OperatorMe; zone: "owner" | "staff" };
export type PlatformActor = { kind: "platform"; me: AdminMe; zone: "admin" };

const TENANT_CONTEXT_CODES = new Set(["tenant.context_invalid", "tenant.context_required", "tenant.not_in_scope"]);

/**
 * Who is signed in to an operator zone, from `/v1/{owner|staff}/me` (cached per request with React
 * `cache`, so the layout, the page and the shell share one call). `null` = not signed in on this
 * host. A stale tenant choice (the cookie names a tenant the user no longer belongs to) is retried
 * without `X-Tenant-Id`, which yields `currentTenant: null` for operators of several tenants — the
 * guard then sends them to the tenant picker.
 */
export const getOperatorActor = cache(async (zone: "owner" | "staff"): Promise<OperatorActor | null> => {
  const path = zone === "owner" ? "/v1/owner/me" : "/v1/staff/me";
  try {
    const api = await serverApi(zone);
    return { kind: "operator", zone, me: await unwrap(api.GET(path)) };
  } catch (error) {
    if (!isApiError(error)) throw error;
    if (error.status === 401 || error.code === "auth.wrong_audience") return null;
    if (TENANT_CONTEXT_CODES.has(error.code)) {
      const api = await serverApi(zone, { withoutTenant: true });
      return { kind: "operator", zone, me: await unwrap(api.GET(path)) };
    }
    throw error;
  }
});

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
