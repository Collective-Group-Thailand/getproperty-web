import type { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query on demand (D-179). The console shells render without it; the first component that
 * needs a query cache (a page with a list, the notification panel, search results) loads it through
 * `QueryProvider`, and everything that only *reacts* to the cache — realtime invalidation, the
 * read-only switch — attaches here once it exists. Before that there is nothing cached to invalidate.
 *
 * No runtime import of `@tanstack/react-query` in this module: it ships with every console page.
 */

let current: QueryClient | undefined;
let loading: Promise<QueryClient> | undefined;
const listeners = new Set<(client: QueryClient) => void>();

/** The tab's query client once something has loaded it, else `undefined`. */
export function peekQueryClient(): QueryClient | undefined {
  return current;
}

/** Called by `getQueryClient()` when the browser client is created. */
export function announceQueryClient(client: QueryClient): void {
  if (current === client) return;
  current = client;
  for (const listener of listeners) listener(client);
}

/** Loads TanStack Query and the tab's client. */
export function loadQueryClient(): Promise<QueryClient> {
  loading ??= import("./query-client").then((module) => module.getQueryClient());
  return loading;
}

/** Runs `listener` with the client now (when it exists) and whenever it is created; returns an unsubscribe. */
export function onQueryClient(listener: (client: QueryClient) => (() => void) | void): () => void {
  let cleanup: (() => void) | void;
  const run = (client: QueryClient) => {
    cleanup?.();
    cleanup = listener(client);
  };
  if (current) run(current);
  listeners.add(run);
  return () => {
    listeners.delete(run);
    cleanup?.();
  };
}
