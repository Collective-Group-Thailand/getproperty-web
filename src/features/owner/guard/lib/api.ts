import { CSRF_HEADER, IDEMPOTENCY_HEADER } from "@/lib/api/headers";
import type { Problem, Schemas } from "@/lib/api/types";

/**
 * The tablet's calls to its BFF (`/bff/guard/*`, JW4). Deliberately tiny — no query cache on the kiosk (the
 * `/gate` first-load budget is 180 KB, D-179): lists are refetched on stream events, nothing is stale for long.
 *
 * A result is never thrown: `{ ok: true, data }`, or `{ ok: false, status, problem, offline }` where `offline` means
 * the request never reached the API (no network, BFF 502) — the offline queue keys its retries on it.
 */
export type GuardProblem = Partial<Problem> & { code?: string; lockedUntil?: string };

export type GuardResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; problem: GuardProblem | null; offline: boolean; retryAfterS?: number };

export interface GuardRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  lastEventId?: string;
  signal?: AbortSignal;
}

/** `/v1/guard/visits` → `/bff/guard/v1/guard/visits`; `session/roster` → `/bff/guard/session/roster`. */
export function bffUrl(path: string): string {
  return `/bff/guard${path.startsWith("/") ? path : `/${path}`}`;
}

export async function guardFetch<T>(
  path: string,
  request: GuardRequest = {},
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<GuardResult<T>> {
  const method = request.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  // Problems come back in the tablet's language (the page's, not the browser's).
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  if (lang) headers["accept-language"] = lang;
  if (method !== "GET") headers[CSRF_HEADER] = "1";
  if (request.body !== undefined) headers["content-type"] = "application/json";
  if (request.idempotencyKey) headers[IDEMPOTENCY_HEADER] = request.idempotencyKey;
  let response: Response;
  try {
    response = await fetchImpl(bffUrl(path), {
      method,
      headers,
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return { ok: false, status: 0, problem: null, offline: true };
  }
  const text = await response.text().catch(() => "");
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (response.ok) return { ok: true, status: response.status, data: parsed as T };
  const problem = parsed && typeof parsed === "object" ? (parsed as GuardProblem) : null;
  const retryAfter = Number(response.headers.get("retry-after") ?? "NaN");
  return {
    ok: false,
    status: response.status,
    problem,
    offline: response.status === 502 || response.status === 503 || response.status === 504,
    ...(Number.isFinite(retryAfter) ? { retryAfterS: retryAfter } : {}),
  };
}

/** The shapes the tablet reads (indexes into the generated contract, nothing hand-written). */
export type GuardMe = Schemas["GuardMeDto"];
export type GuardVisit = Schemas["GuardVisitDto"];
export type GuardVisitDetail = Schemas["GuardVisitDetailDto"];
export type GuardUnit = Schemas["GuardUnitDto"];
export type GuardHardware = Schemas["GuardHardwareDto"];
export type GuardIncident = Schemas["IncidentDto"];
export type PlateDetection = Schemas["PlateDetectionDto"];
export type VisitKind = Schemas["VisitKind"];
export type VisitCreate = Schemas["VisitCreateDto"];
export type VisitCreated = Schemas["VisitCreatedDto"];
export type Roster = Schemas["GuardRosterDto"];
export type IncidentKind = Schemas["IncidentKind"];
