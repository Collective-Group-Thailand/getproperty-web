import { describe, expect, it, vi } from "vitest";

describe("query runtime (D-179: TanStack Query on demand)", () => {
  it("has no client until one is loaded, then notifies listeners and runs their cleanup", async () => {
    vi.resetModules();
    const runtime = await import("./query-runtime");
    expect(runtime.peekQueryClient()).toBeUndefined();

    const cleanup = vi.fn();
    const listener = vi.fn(() => cleanup);
    const unsubscribe = runtime.onQueryClient(listener);
    expect(listener).not.toHaveBeenCalled();

    const client = await runtime.loadQueryClient();
    expect(runtime.peekQueryClient()).toBe(client);
    expect(listener).toHaveBeenCalledWith(client);
    expect(await runtime.loadQueryClient()).toBe(client);

    // A late subscriber runs at once.
    const late = vi.fn();
    runtime.onQueryClient(late);
    expect(late).toHaveBeenCalledWith(client);

    unsubscribe();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
