import "server-only";

import { cookies } from "next/headers";

import type { TokenPair } from "@/lib/api/types";

import {
  clearedSessionCookies,
  REFRESH_COOKIE,
  sessionCookies,
  TENANT_COOKIE,
  tenantCookie,
  validTenantId,
  type CookieSpec,
} from "./cookies";

/** Cookie writes for Server Actions and Route Handlers (the only places Next allows them). */
async function write(specs: CookieSpec[]): Promise<void> {
  const jar = await cookies();
  for (const spec of specs) jar.set(spec.name, spec.value, spec.options);
}

export async function writeSession(pair: TokenPair): Promise<void> {
  await write(sessionCookies(pair));
}

export async function clearSession(): Promise<void> {
  await write(clearedSessionCookies());
}

export async function writeTenant(tenantId: string): Promise<void> {
  await write([tenantCookie(tenantId)]);
}

export async function readRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function readTenant(): Promise<string | undefined> {
  return validTenantId((await cookies()).get(TENANT_COOKIE)?.value);
}
