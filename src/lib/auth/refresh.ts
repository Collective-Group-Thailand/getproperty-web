import type { TokenPair } from "@/lib/api/types";

/**
 * Refresh-token rotation (contract §4, D-163): every refresh token is single-use, and presenting a
 * used one revokes the whole sign-in. A page load fans out into parallel requests (the document, RSC
 * prefetches, BFF calls), each of which may notice the expired access token at once — so this module
 * makes sure one refresh token is exchanged **once per process**: concurrent callers share the
 * in-flight promise, and callers that arrive just after get the same new pair from a short cache.
 *
 * Several server instances can still race; the window is the few hundred ms between two instances
 * receiving requests of the same browser at the moment of expiry. Sticky sessions or a shared cache
 * close it (recorded in ADR-0004).
 */

export type RefreshOutcome =
  { ok: true; pair: TokenPair } | { ok: false; reason: "invalid" | "reused" | "unavailable"; status: number };

const RESULT_TTL_MS = 30_000;

interface Entry {
  promise: Promise<RefreshOutcome>;
  settledAt?: number;
}

/**
 * Kept on `globalThis`: Next bundles the proxy and every route handler separately, so a module-level map would exist
 * once per bundle and the proxy's refresh and a BFF call of the same page load would exchange the same token twice
 * (the API's rotation grace, D-229, answers the second with the same successor, but only within its window).
 */
const INFLIGHT_KEY = Symbol.for("getproperty-web.refresh-inflight");
const inflight: Map<string, Entry> = ((globalThis as typeof globalThis & { [INFLIGHT_KEY]?: Map<string, Entry> })[
  INFLIGHT_KEY
] ??= new Map<string, Entry>());

async function digest(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function prune(now: number) {
  for (const [key, entry] of inflight) {
    if (entry.settledAt !== undefined && now - entry.settledAt > RESULT_TTL_MS) inflight.delete(key);
  }
}

async function exchange(
  apiUrl: string,
  refreshToken: string,
  fetchImpl: typeof fetch,
  clientIp: string | undefined,
): Promise<RefreshOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`${apiUrl}/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-request-id": crypto.randomUUID(),
        // The end user's address as our edge saw it (review H1): the session row and the throttle use it.
        ...(clientIp ? { "x-forwarded-for": clientIp } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unavailable", status: 503 };
  }
  if (response.ok) return { ok: true, pair: (await response.json()) as TokenPair };
  if (response.status === 401) {
    const problem = (await response.json().catch(() => ({}))) as { code?: string };
    return { ok: false, reason: problem.code === "auth.refresh_reused" ? "reused" : "invalid", status: 401 };
  }
  // 400/422 mean the token is malformed — as good as invalid; 429/5xx are transient.
  if (response.status < 500 && response.status !== 429)
    return { ok: false, reason: "invalid", status: response.status };
  return { ok: false, reason: "unavailable", status: response.status };
}

export async function refreshTokens(
  apiUrl: string,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
  clientIp?: string,
): Promise<RefreshOutcome> {
  const now = Date.now();
  prune(now);
  const key = await digest(refreshToken);
  const existing = inflight.get(key);
  if (existing) return existing.promise;

  const entry: Entry = { promise: exchange(apiUrl, refreshToken, fetchImpl, clientIp) };
  inflight.set(key, entry);
  entry.promise.then(
    (outcome) => {
      // A transient failure must not be cached: the next request should try again.
      if (outcome.ok || outcome.reason !== "unavailable") entry.settledAt = Date.now();
      else inflight.delete(key);
    },
    () => inflight.delete(key),
  );
  return entry.promise;
}

/** Test hook. */
export function resetRefreshCache(): void {
  inflight.clear();
}
