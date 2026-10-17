import { unwrap, type ApiClient } from "./client";

/**
 * CONTRACT-REQUEST — a GET of an endpoint the pinned contract does not publish yet (`src/lib/api/pending.ts`
 * holds the requested response shapes). Same client, headers and error mapping as every other call; only
 * the path is not typed. Callers fall back gracefully while the API answers 404 (not implemented yet).
 */
export function getPending<T>(
  client: ApiClient,
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  return unwrap(client.GET(path as never, { params: { query } } as never)) as Promise<T>;
}
