import "server-only";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import { ACCESS_COOKIE, TENANT_COOKIE, validTenantId } from "@/lib/auth/cookies";
import { zoneHasTenant } from "@/lib/auth/zones";
import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";
import type { Zone } from "@/lib/zones";

import { createApiClient, type ApiClient } from "./client";
import { TENANT_HEADER } from "./headers";

export interface ServerApiOptions {
  /** Leave `X-Tenant-Id` off even when the cookie has one (to recover from a stale tenant choice). */
  withoutTenant?: boolean;
}

/**
 * The Server Components' API client (ADR-0004): straight to `API_INTERNAL_URL`, the bearer from the
 * zone's httpOnly cookie (the proxy has already refreshed it for this request), `X-Tenant-Id` from
 * `__Host-gp_tenant` in the tenant zones, the page's language for problem `detail`s, and the end user's address
 * as our edge saw it (review H1 — the API's throttle and audit would otherwise see only this server).
 */
export async function serverApi(zone: Zone, options: ServerApiOptions = {}): Promise<ApiClient> {
  const [jar, locale, edge] = await Promise.all([cookies(), getLocale().catch(() => "th"), inboundEdgeHeaders()]);
  const token = jar.get(ACCESS_COOKIE)?.value;
  const tenantId =
    zoneHasTenant(zone) && !options.withoutTenant ? validTenantId(jar.get(TENANT_COOKIE)?.value) : undefined;
  return createApiClient({
    baseUrl: serverEnv().API_INTERNAL_URL,
    headers: () => ({
      ...edge,
      authorization: token ? `Bearer ${token}` : undefined,
      [TENANT_HEADER]: tenantId,
      "Accept-Language": locale,
    }),
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
}
