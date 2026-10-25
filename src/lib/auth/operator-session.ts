import "server-only";

import { cookies } from "next/headers";

import { createApiClient, unwrap } from "@/lib/api/client";
import type { OperatorMe, TokenPair } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/routing";

import { readTenant, writeSession, writeTenant } from "./session";

export type OperatorZone = "owner" | "staff";

/** Where an operator goes after signing in: the console, or the tenant picker. */
export type OperatorNext = { next: "console" | "select-tenant" };

/**
 * The API as sign-in code calls it (Server Actions, the OAuth route handlers): every call carries the end user's
 * address as our edge saw it (review H1), so the API's sign-in throttle, sessions and audit record it.
 */
export async function authApiClient(language?: string, extra: Record<string, string | undefined> = {}) {
  const edge = await inboundEdgeHeaders();
  return createApiClient({
    baseUrl: serverEnv().API_INTERNAL_URL,
    headers: () => ({ ...edge, "Accept-Language": language, ...extra }),
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
}

export async function requestLanguage(): Promise<string> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "th";
}

export async function rememberLanguage(value: string | undefined): Promise<void> {
  if (!isLocale(value)) return;
  (await cookies()).set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function operatorMe(zone: OperatorZone, accessToken: string, tenantId?: string): Promise<OperatorMe> {
  const api = await authApiClient(undefined, { authorization: `Bearer ${accessToken}`, "x-tenant-id": tenantId });
  return zone === "owner" ? unwrap(api.GET("/v1/owner/me")) : unwrap(api.GET("/v1/staff/me"));
}

/**
 * After an operator sign-in: keep a remembered tenant only if it is still one of theirs, and send
 * operators of several tenants without a valid choice to the picker. Staff and admin zones take the
 * user's language from `/me` (owner pages carry it in the URL).
 */
export async function afterOperatorSignIn(zone: OperatorZone, pair: TokenPair): Promise<OperatorNext> {
  await writeSession(pair);
  const remembered = await readTenant();
  const me = await operatorMe(zone, pair.accessToken);
  if (zone === "staff") await rememberLanguage(me.user.language);
  const active = me.tenants.filter((tenant) => tenant.status !== "deactivated");
  if (remembered && active.some((tenant) => tenant.id === remembered)) return { next: "console" };
  if (active.length === 1) {
    await writeTenant(active[0]!.id);
    return { next: "console" };
  }
  return { next: "select-tenant" };
}
