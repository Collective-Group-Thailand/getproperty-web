import { InfiniteQueryObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { refreshQueries } from "./refresh";

/** A server whose answers are released by the test, so an event can land while a fetch is in flight. */
function server() {
  let items = ["old"];
  const pending: (() => void)[] = [];
  let calls = 0;
  return {
    push: (item: string) => {
      items = [item, ...items];
    },
    get calls() {
      return calls;
    },
    fetch: () => {
      calls += 1;
      const snapshot = [...items]; // what the server has when the request arrives
      return new Promise<string[]>((resolve) => pending.push(() => resolve(snapshot)));
    },
    releaseAll: async () => {
      while (pending.length) {
        pending.shift()!();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },
  };
}

const settle = async (api: ReturnType<typeof server>, done: () => boolean) => {
  for (let i = 0; i < 20 && !done(); i++) await api.releaseAll();
};

let client: QueryClient;
afterEach(() => client?.clear());

describe("refreshQueries (realtime → query cache)", () => {
  it("an event during the first load is not lost: the list refetches with the new item (shells flake)", async () => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = server();
    const observer = new InfiniteQueryObserver(client, {
      queryKey: ["owner", "notifications"],
      queryFn: () => api.fetch().then((data) => ({ data, next: null })),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: () => undefined,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    expect(api.calls).toBe(1); // first load in flight, nothing cached yet

    api.push("new"); // the API stores the item, then the event arrives
    const refreshed = refreshQueries(client, ["owner", "notifications"]);
    await settle(api, () => observer.getCurrentResult().isSuccess && api.calls >= 2);
    await refreshed;

    expect(api.calls).toBe(2);
    expect(observer.getCurrentResult().data?.pages.flatMap((page) => page.data)).toEqual(["new", "old"]);
    expect(observer.getCurrentResult().isError).toBe(false);
    unsubscribe();
  });

  it("refetches a loaded query, and leaves other keys alone", async () => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = server();
    const other = server();
    const inbox = new QueryObserver(client, { queryKey: ["owner", "notifications"], queryFn: api.fetch });
    const invoices = new QueryObserver(client, {
      queryKey: ["owner", "tenant", "t1", "invoices"],
      queryFn: other.fetch,
    });
    const stop = [inbox.subscribe(() => undefined), invoices.subscribe(() => undefined)];
    await settle(api, () => inbox.getCurrentResult().isSuccess);
    await settle(other, () => invoices.getCurrentResult().isSuccess);

    api.push("new");
    const refreshed = refreshQueries(client, ["owner", "notifications"]);
    await settle(api, () => api.calls >= 2 && !inbox.getCurrentResult().isFetching);
    await refreshed;

    expect(inbox.getCurrentResult().data).toEqual(["new", "old"]);
    expect(other.calls).toBe(1);
    stop.forEach((unsubscribe) => unsubscribe());
  });
});
