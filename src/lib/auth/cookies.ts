import type { TokenPair } from "@/lib/api/types";

/**
 * Session cookies (ADR-0004): host-only (`__Host-` = `Secure`, `Path=/`, no `Domain`), `HttpOnly`,
 * `SameSite=Lax`. Each zone's host has its own pair, so an owner session is never sent to the admin
 * host. Browsers treat `http://localhost` and `http://*.localhost` as secure contexts, so the same
 * names work in local development.
 */
export const ACCESS_COOKIE = "__Host-gp_at";
export const REFRESH_COOKIE = "__Host-gp_rt";
/** The current tenant for operators of several tenants; sent upstream as `X-Tenant-Id` (contract §8). */
export const TENANT_COOKIE = "__Host-gp_tenant";

/**
 * The access cookie dies this long before the token does, so the proxy refreshes before the API
 * would answer 401 (clock skew, request time).
 */
export const ACCESS_EXPIRY_SKEW_SECONDS = 30;

export interface CookieSpec {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: true;
    sameSite: "lax";
    path: "/";
    maxAge: number;
  };
}

const base = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;

function secondsUntil(iso: string, now: number): number {
  const at = Date.parse(iso);
  return Number.isFinite(at) ? Math.floor((at - now) / 1000) : 0;
}

/** The two cookies of a token pair; the access cookie expires `ACCESS_EXPIRY_SKEW_SECONDS` early. */
export function sessionCookies(
  pair: Pick<TokenPair, "accessToken" | "accessTokenExpiresAt" | "refreshToken" | "refreshTokenExpiresAt">,
  now = Date.now(),
): CookieSpec[] {
  const accessMaxAge = Math.max(1, secondsUntil(pair.accessTokenExpiresAt, now) - ACCESS_EXPIRY_SKEW_SECONDS);
  const refreshMaxAge = Math.max(1, secondsUntil(pair.refreshTokenExpiresAt, now));
  return [
    { name: ACCESS_COOKIE, value: pair.accessToken, options: { ...base, maxAge: accessMaxAge } },
    { name: REFRESH_COOKIE, value: pair.refreshToken, options: { ...base, maxAge: refreshMaxAge } },
  ];
}

/** The tenant choice lives as long as a refresh token can (30 days, D-163). */
export function tenantCookie(tenantId: string): CookieSpec {
  return { name: TENANT_COOKIE, value: tenantId, options: { ...base, maxAge: 30 * 24 * 60 * 60 } };
}

/** Expired versions of every session cookie, for logout and a failed refresh. */
export function clearedSessionCookies(options: { keepTenant?: boolean } = {}): CookieSpec[] {
  const names = options.keepTenant ? [ACCESS_COOKIE, REFRESH_COOKIE] : [ACCESS_COOKIE, REFRESH_COOKIE, TENANT_COOKIE];
  return names.map((name) => ({ name, value: "", options: { ...base, maxAge: 0 } }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only a uuid ever goes upstream as `X-Tenant-Id`; anything else in the cookie is ignored. */
export function validTenantId(value: string | undefined): string | undefined {
  return value && UUID.test(value) ? value.toLowerCase() : undefined;
}
