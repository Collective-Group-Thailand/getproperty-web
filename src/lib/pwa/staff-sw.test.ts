// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { purgeStaffCaches, STAFF_STATIC_CACHE } from "./caches";

/**
 * Unit harness for the staff service worker (review H2): the worker source runs against a fake
 * `ServiceWorkerGlobalScope` (listeners, clients, registration), an in-memory Cache Storage and a scripted network,
 * and each test dispatches install / activate / fetch / message / push events at it.
 */

const ORIGIN = "https://staff.getproperty.co";
const PIN_PAGE = "<html><body>Door code 730215</body></html>";

class FakeCache {
  readonly entries = new Map<string, Response>();
  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const hit = this.entries.get(keyOf(request));
    return hit?.clone();
  }
  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(keyOf(request), response.clone());
  }
  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(keyOf(request));
  }
}

function keyOf(request: RequestInfo | URL): string {
  const url = typeof request === "string" ? request : request instanceof URL ? request.href : request.url;
  return new URL(url, ORIGIN).href;
}

class FakeCacheStorage {
  readonly stores = new Map<string, FakeCache>();
  async open(name: string): Promise<FakeCache> {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.stores.set(name, cache);
    }
    return cache;
  }
  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }
  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }
  async has(name: string): Promise<boolean> {
    return this.stores.has(name);
  }
  /** Every response body stored anywhere. */
  async everything(): Promise<string[]> {
    const bodies: string[] = [];
    for (const cache of this.stores.values()) {
      for (const response of cache.entries.values()) bodies.push(await response.clone().text());
    }
    return bodies;
  }
}

type Listener = (event: unknown) => void;
type Network = (request: Request) => Promise<Response>;

interface Harness {
  storage: FakeCacheStorage;
  network: ReturnType<typeof vi.fn<Network>>;
  install(): Promise<void>;
  activate(): Promise<void>;
  /** The worker's answer, or `undefined` when it lets the browser handle the request. */
  fetch(input: string, init?: RequestInit & { navigate?: boolean }): Promise<Response | undefined>;
  message(data: unknown): Promise<void>;
  push(data: unknown): Promise<{ title: string; options: NotificationOptions }>;
}

function navigationRequest(request: Request): Request {
  return new Proxy(request, {
    get(target, property) {
      if (property === "mode") return "navigate";
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
}

async function startWorker(route: Network): Promise<Harness> {
  const listeners = new Map<string, Listener[]>();
  const storage = new FakeCacheStorage();
  const network = vi.fn<Network>(async (request) => route(request));
  const notifications: { title: string; options: NotificationOptions }[] = [];
  const scope = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, listener: Listener) =>
      listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined), matchAll: vi.fn(async () => []), openWindow: vi.fn() },
    registration: {
      showNotification: vi.fn(async (title: string, options: NotificationOptions) => {
        notifications.push({ title, options });
      }),
    },
  };
  vi.stubGlobal("self", scope);
  vi.stubGlobal("caches", storage);
  vi.stubGlobal("__SW_VERSION__", "v-test");
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    network(input instanceof Request ? input : new Request(new URL(String(input), ORIGIN), init)),
  );
  vi.resetModules();
  const source = "./sw/staff-sw";
  await import(/* @vite-ignore */ source);

  const dispatch = async (type: string, extra: Record<string, unknown>) => {
    const waits: Promise<unknown>[] = [];
    let answer: Promise<Response> | undefined;
    const event = {
      ...extra,
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
      respondWith: (response: Promise<Response> | Response) => {
        answer = Promise.resolve(response);
      },
    };
    for (const listener of listeners.get(type) ?? []) listener(event);
    await Promise.all(waits);
    return answer;
  };

  return {
    storage,
    network,
    install: async () => void (await dispatch("install", {})),
    activate: async () => void (await dispatch("activate", {})),
    fetch: async (input, init = {}) => {
      const { navigate, ...rest } = init;
      const request = new Request(new URL(input, ORIGIN), rest);
      const answer = await dispatch("fetch", { request: navigate ? navigationRequest(request) : request });
      return answer ? await answer : undefined;
    },
    message: async (data) => void (await dispatch("message", { data })),
    push: async (data) => {
      await dispatch("push", { data: { json: () => data, text: () => JSON.stringify(data) } });
      return notifications.at(-1)!;
    },
  };
}

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { "content-type": "text/html", ...headers } });

const OFFLINE_HTML = "<html><body>You are offline</body></html>";

/** A staff host: `/offline` is the static page; pages render per user; static chunks are immutable. */
function staffHost(offline = { value: false }): Network {
  return async (request) => {
    if (offline.value) throw new TypeError("Failed to fetch");
    const { pathname } = new URL(request.url);
    if (pathname === "/offline") return html(OFFLINE_HTML, { "cache-control": "no-cache" });
    if (pathname.startsWith("/_next/static/")) {
      return new Response("chunk", { headers: { "cache-control": "public, max-age=31536000, immutable" } });
    }
    if (pathname.startsWith("/bff/"))
      return Response.json({ pin: "730215" }, { headers: { "cache-control": "no-store" } });
    return html(PIN_PAGE, { "cache-control": "private, no-store" });
  };
}

beforeEach(() => {
  vi.stubGlobal("caches", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("staff service worker (review H2)", () => {
  it("precaches only the static offline page, fetched without credentials", async () => {
    const sw = await startWorker(staffHost());
    await sw.install();
    const [request] = sw.network.mock.calls[0]!;
    expect(new URL(request.url).pathname).toBe("/offline");
    expect(request.credentials).toBe("omit");
    expect(await sw.storage.keys()).toEqual(["gp-staff-shell-v-test"]);
    expect(await sw.storage.everything()).toEqual([OFFLINE_HTML]);
  });

  it("never stores an authenticated page, and offline shows the offline page — not the last render", async () => {
    const offline = { value: false };
    const sw = await startWorker(staffHost(offline));
    await sw.install();
    await sw.activate();
    const online = await sw.fetch("/work-orders/wo-1", { navigate: true });
    expect(await online!.text()).toBe(PIN_PAGE);
    expect((await sw.storage.everything()).some((body) => body.includes("730215"))).toBe(false);

    offline.value = true;
    const fallback = await sw.fetch("/work-orders/wo-1", { navigate: true });
    expect(await fallback!.text()).toBe(OFFLINE_HTML);
    const home = await sw.fetch("/", { navigate: true });
    expect(await home!.text()).toBe(OFFLINE_HTML);
  });

  it("waits for a slow network instead of serving anything cached", async () => {
    vi.useFakeTimers();
    try {
      let release: (response: Response) => void = () => {};
      const sw = await startWorker(async (request) => {
        if (new URL(request.url).pathname === "/offline") return html(OFFLINE_HTML);
        return new Promise<Response>((resolve) => (release = resolve));
      });
      await sw.install();
      const pending = sw.fetch("/today", { navigate: true });
      await vi.advanceTimersByTimeAsync(10_000);
      release(html("<html>fresh</html>"));
      expect(await (await pending)!.text()).toBe("<html>fresh</html>");
    } finally {
      vi.useRealTimers();
    }
  });

  it("serves hashed static assets cache-first and stores only storable ones", async () => {
    const sw = await startWorker(staffHost());
    const first = await sw.fetch("/_next/static/chunks/app.js");
    expect(await first!.text()).toBe("chunk");
    await sw.fetch("/_next/static/chunks/app.js");
    expect(sw.network).toHaveBeenCalledTimes(1);
    expect((await sw.storage.open(STAFF_STATIC_CACHE)).entries.size).toBe(1);
  });

  it("does not store a static response marked no-store or private, or a redirect", async () => {
    const sw = await startWorker(async (request) => {
      const { pathname } = new URL(request.url);
      if (pathname.endsWith("a.js")) return new Response("a", { headers: { "cache-control": "no-store" } });
      if (pathname.endsWith("b.js")) return new Response("b", { headers: { "cache-control": "private, max-age=60" } });
      return new Response("c", { status: 404 });
    });
    await sw.fetch("/_next/static/chunks/a.js");
    await sw.fetch("/_next/static/chunks/b.js");
    await sw.fetch("/_next/static/chunks/c.js");
    expect((await sw.storage.open(STAFF_STATIC_CACHE)).entries.size).toBe(0);
  });

  it.each([
    ["/bff/v1/staff/work-orders/wo-1/access", {}],
    ["/work-orders/wo-1?_rsc=abc", { headers: { rsc: "1" } }],
    ["/pwa/staff-192.png", {}],
    ["/manifest.webmanifest", {}],
    ["https://collective-uat-getproperty-assets.s3.ap-southeast-7.amazonaws.com/t/photo.jpg?X-Amz-Signature=1", {}],
    ["/bff/v1/staff/readings", { method: "POST", body: "{}" }],
  ] as const)("leaves %s to the network untouched", async (url, init) => {
    const sw = await startWorker(staffHost());
    expect(await sw.fetch(url, init as RequestInit)).toBeUndefined();
    expect(await sw.storage.keys()).toEqual([]);
  });

  it("deletes the page caches of earlier workers (which held rendered pages) on activation", async () => {
    const sw = await startWorker(staffHost());
    for (const name of ["gp-staff-pages-0123456789ab", "gp-staff-images", "gp-staff-shell-old", STAFF_STATIC_CACHE]) {
      await (await sw.storage.open(name)).put(`${ORIGIN}/x`, html(PIN_PAGE));
    }
    await (await sw.storage.open("unrelated-app-cache")).put(`${ORIGIN}/y`, html("other"));
    await sw.install();
    await sw.activate();
    expect((await sw.storage.keys()).sort()).toEqual(
      ["gp-staff-shell-v-test", STAFF_STATIC_CACHE, "unrelated-app-cache"].sort(),
    );
  });

  it("purges every personal cache on gp:purge (sign-out), keeping the static assets and the offline page", async () => {
    const sw = await startWorker(staffHost());
    await sw.install();
    await (await sw.storage.open("gp-staff-pages-legacy")).put(`${ORIGIN}/`, html(PIN_PAGE));
    await sw.fetch("/_next/static/chunks/app.js");
    await sw.message({ type: "gp:purge" });
    expect((await sw.storage.keys()).sort()).toEqual([STAFF_STATIC_CACHE, "gp-staff-shell-v-test"].sort());
  });

  it("keeps notification taps on this origin", async () => {
    const sw = await startWorker(staffHost());
    expect((await sw.push({ title: "x", path: "//evil.example/" })).options.data).toEqual({ path: "/" });
    expect((await sw.push({ title: "x", path: "https://evil.example/" })).options.data).toEqual({ path: "/" });
    expect((await sw.push({ title: "x", path: "/work-orders/1" })).options.data).toEqual({ path: "/work-orders/1" });
  });
});

describe("purgeStaffCaches (the page's half of sign-out)", () => {
  it("deletes every gp-staff cache except the static assets and the offline page", async () => {
    const storage = new FakeCacheStorage();
    for (const name of ["gp-staff-pages-x", "gp-staff-images", STAFF_STATIC_CACHE, "gp-staff-shell-v1", "other"]) {
      await storage.open(name);
    }
    const deleted = await purgeStaffCaches(storage as unknown as CacheStorage);
    expect(deleted.sort()).toEqual(["gp-staff-images", "gp-staff-pages-x"]);
    expect((await storage.keys()).sort()).toEqual([STAFF_STATIC_CACHE, "gp-staff-shell-v1", "other"].sort());
  });

  it("does nothing without Cache Storage", async () => {
    expect(await purgeStaffCaches(undefined)).toEqual([]);
  });
});
