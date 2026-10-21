import type { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, clearedSessionCookies, REFRESH_COOKIE, sessionCookies, type CookieSpec } from "./cookies";
import { refreshTokens } from "./refresh";

/**
 * Access-token refresh before rendering (F1 1.1 §2, ADR-0004): when a page request arrives with a
 * refresh cookie but no access cookie (it expired — the cookie dies 30 s before the token), the proxy
 * exchanges it, puts the new tokens on the *request* (so the Server Components of this very request
 * see them) and on the response (so the browser keeps them). A refused refresh clears the session; an
 * unavailable API leaves it alone (the page's guard then shows sign-in or an error).
 */
export interface SessionRefresh {
  cookies: CookieSpec[];
  /** The request's `cookie` header with the new values, or `undefined` to leave it as is. */
  cookieHeader?: string;
}

export async function refreshBeforeRender(
  request: NextRequest,
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
  clientIp?: string,
): Promise<SessionRefresh | null> {
  if (request.cookies.get(ACCESS_COOKIE)?.value) return null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const outcome = await refreshTokens(apiUrl, refreshToken, fetchImpl, clientIp);
  if (outcome.ok) {
    const cookies = sessionCookies(outcome.pair);
    return { cookies, cookieHeader: withCookies(request, cookies) };
  }
  if (outcome.reason === "unavailable") return null;
  const cookies = clearedSessionCookies({ keepTenant: true });
  return { cookies, cookieHeader: withCookies(request, cookies) };
}

/** The request's cookies with these set (or removed, for an empty value). */
export function withCookies(request: Pick<NextRequest, "cookies">, cookies: CookieSpec[]): string {
  const jar = new Map(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]));
  for (const cookie of cookies) {
    if (cookie.value) jar.set(cookie.name, cookie.value);
    else jar.delete(cookie.name);
  }
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
}

export function applyCookies(response: NextResponse, cookies: CookieSpec[]): void {
  for (const cookie of cookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
}
