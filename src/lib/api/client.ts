import createClient, { type Client, type Middleware } from "openapi-fetch";

import { OPERATIONS } from "./generated/operations";
import { IDEMPOTENCY_HEADER, REQUEST_ID_HEADER } from "./headers";
import { NetworkError, problemError, toApiError } from "./errors";
import type { Problem, paths } from "./types";

export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  baseUrl: string;
  /** Static headers on every request (Authorization, X-Tenant-Id on the server; CSRF in the browser). */
  headers?: () => Record<string, string | undefined>;
  fetch?: typeof fetch;
}

/**
 * One typed client for server and browser (openapi-fetch over the generated `paths`). The middleware
 * adds what the contract asks of every call so call sites cannot forget it:
 * - `X-Request-Id` (a fresh uuid unless given) — shown in error states, searchable in API logs;
 * - `Idempotency-Key` for every operation the contract flags (irreversible POSTs), when the caller
 *   did not pass one — callers that retry pass their own so a replay is recognised;
 * - failed responses become typed `ApiError`s (`unwrap`), network failures `NetworkError`s.
 */
export function createApiClient({ baseUrl, headers, fetch: fetchImpl }: ApiClientOptions): ApiClient {
  const client = createClient<paths>({ baseUrl, fetch: fetchImpl });
  const middleware: Middleware = {
    onRequest({ request, schemaPath }) {
      for (const [name, value] of Object.entries(headers?.() ?? {})) {
        if (value !== undefined && !request.headers.has(name)) request.headers.set(name, value);
      }
      if (!request.headers.has(REQUEST_ID_HEADER)) request.headers.set(REQUEST_ID_HEADER, crypto.randomUUID());
      const flags = OPERATIONS[`${request.method} ${schemaPath}`];
      if (flags?.idempotencyKey && !request.headers.has(IDEMPOTENCY_HEADER)) {
        request.headers.set(IDEMPOTENCY_HEADER, crypto.randomUUID());
      }
      return request;
    },
    onError({ error }) {
      return new NetworkError(error);
    },
  };
  client.use(middleware);
  return client;
}

/**
 * Turns an openapi-fetch result into data or a thrown `ApiError` — the shape TanStack Query and
 * Server Components want. The `ETag` of editable aggregates is returned alongside for `If-Match`.
 */
export async function unwrap<T>(result: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  return (await unwrapWithETag(result)).data;
}

export async function unwrapWithETag<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<{ data: T; etag: string | null }> {
  const { data, error, response } = await result;
  if (error !== undefined || !response.ok) throw await failure(error, response);
  return { data: data as T, etag: response.headers.get("etag") };
}

/** openapi-fetch has already read the body into `error`; use it rather than the spent response. */
async function failure(error: unknown, response: Response) {
  if (error && typeof error === "object" && !Array.isArray(error)) {
    return problemError(response.status, {
      requestId: response.headers.get("x-request-id") ?? undefined,
      ...(error as Partial<Problem>),
    });
  }
  return toApiError(response);
}
