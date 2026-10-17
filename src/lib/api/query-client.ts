import { QueryClient, isServer } from "@tanstack/react-query";

/**
 * TanStack Query defaults for every zone (ADR-0004). Server Components fetch the first page and
 * hydrate; the client then keeps it fresh. A 4xx never retries (the request is wrong, not the
 * network); other failures retry twice with backoff. F1 1.2 adds the API error policy on top
 * (`src/lib/api/query.ts`).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR the first render already has data; refetching it at once on hydrate is waste.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          const status = (error as { status?: number } | null)?.status;
          if (typeof status === "number" && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

let browserClient: QueryClient | undefined;

/** One client per request on the server, one per tab in the browser. */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
