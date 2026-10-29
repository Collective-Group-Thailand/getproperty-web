import type { QueryClient } from "@tanstack/react-query";

/**
 * Makes the cached queries an event concerns fetch again. A fetch already in flight started before the event and
 * may miss what the event announces, and TanStack Query joins it instead of starting another while the query has
 * no data yet (`cancelRefetch` only applies once there is data) — the first load of the notification panel would
 * keep the list without the item just pushed. So in-flight fetches are cancelled first (their state reverted, the
 * result ignored) and every match then refetches with what exists now.
 *
 * Type-only import: TanStack Query loads on demand (D-179); this runs only once a client exists.
 */
export async function refreshQueries(client: QueryClient, queryKey: readonly unknown[]): Promise<void> {
  await client.cancelQueries({ queryKey, fetchStatus: "fetching" });
  await client.invalidateQueries({ queryKey });
}
