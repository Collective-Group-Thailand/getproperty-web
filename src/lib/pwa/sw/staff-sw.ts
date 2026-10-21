/// <reference lib="webworker" />
/**
 * The staff PWA's service worker (ADR-0007, amended by review H2), bundled by `scripts/build-sw.ts` into
 * `src/lib/pwa/generated/staff-sw.ts` and served at `/sw.js` on the staff host only.
 *
 * What it caches — nothing personal, ever:
 * - Next's hashed static assets (`/_next/static/*`, immutable): cache-first, stored only when the response is a
 *   same-origin 200 that does not say `no-store`/`private`;
 * - one static, unauthenticated offline page (`/offline`), fetched without credentials at install.
 *
 * What it never caches: navigations (rendered pages are per user and may carry personal data — a cached work
 * order once carried its door PIN to the next person holding the phone), `/bff/*`, RSC payloads, images,
 * anything cross-origin (signed URLs) and any response marked `no-store`/`private`. A navigation goes to the
 * network; only when the network fails is the offline page shown — there is no "slow network" fallback to an old
 * render. Every cache under `gp-staff-` other than the two above (the page caches of earlier workers included) is
 * deleted on activation, and the page deletes them again at sign-out (`purgeStaffCaches`).
 *
 * Also: Background Sync `gp-offline-queue` → asks the open pages to replay the IndexedDB queue (the page owns the
 * queue, its session cookies and its cross-tab lock); web push → shows the notification the API sent, a tap focuses
 * the PWA (or opens the given same-origin path).
 */
import {
  isSharedStaffCache,
  STAFF_CACHE_PREFIX,
  STAFF_OFFLINE_PATH,
  STAFF_SHELL_CACHE_PREFIX,
  STAFF_STATIC_CACHE,
} from "../caches";

declare const self: ServiceWorkerGlobalScope;
declare const __SW_VERSION__: string;

const SHELL = `${STAFF_SHELL_CACHE_PREFIX}${__SW_VERSION__}`;
const STATIC_MAX_ENTRIES = 300;

/** Only a plain same-origin 200 that allows storage is ever written to a cache. */
export function storable(response: Response): boolean {
  if (response.status !== 200 || response.type === "opaque" || response.redirected) return false;
  const cacheControl = (response.headers.get("cache-control") ?? "").toLowerCase();
  return !/\b(no-store|private)\b/.test(cacheControl);
}

const offlineUrl = () => new URL(STAFF_OFFLINE_PATH, self.location.origin).href;

async function precacheOfflinePage(): Promise<void> {
  const response = await fetch(new Request(offlineUrl(), { credentials: "omit", cache: "reload" }));
  // `storable` refuses a redirect (e.g. to a sign-in page): the fallback must be the static page itself.
  if (!response.ok || response.redirected) return;
  const cache = await caches.open(SHELL);
  await cache.put(offlineUrl(), response);
}

async function dropPersonalAndStaleCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(STAFF_CACHE_PREFIX) && key !== SHELL && key !== STAFF_STATIC_CACHE)
      .map((key) => caches.delete(key)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflinePage().catch(() => undefined));
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(dropPersonalAndStaleCaches().then(() => self.clients.claim()));
});

async function navigation(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL);
    return (await cache.match(offlineUrl())) ?? Response.error();
  }
}

async function trimStatic(cache: Cache): Promise<void> {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_MAX_ENTRIES)).map((key) => cache.delete(key)));
}

async function staticAsset(request: Request): Promise<Response> {
  const cache = await caches.open(STAFF_STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (storable(response)) {
    await cache.put(request, response.clone());
    void trimStatic(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigation(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request));
  }
  // Everything else (`/bff/*`, RSC requests, images, the manifest) goes to the network untouched.
});

self.addEventListener("sync", (event: Event) => {
  const sync = event as Event & { tag: string; waitUntil(promise: Promise<unknown>): void };
  if (sync.tag !== "gp-offline-queue") return;
  sync.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) client.postMessage({ type: "gp:replay" });
    }),
  );
});

self.addEventListener("message", (event) => {
  const type = (event.data as { type?: string } | null)?.type;
  if (type === "gp:skip-waiting") void self.skipWaiting();
  if (type === "gp:purge") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith(STAFF_CACHE_PREFIX) && !isSharedStaffCache(key))
              .map((key) => caches.delete(key)),
          ),
        ),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload: { title?: string; body?: string; path?: string; tag?: string } = {};
  try {
    payload = (event.data?.json() ?? {}) as typeof payload;
  } catch {
    payload = { body: event.data?.text() };
  }
  const path = payload.path && payload.path.startsWith("/") && !payload.path.startsWith("//") ? payload.path : "/";
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "getproperty", {
      body: payload.body ?? "",
      tag: payload.tag,
      icon: "/pwa/staff-192.png",
      badge: "/pwa/staff-192.png",
      data: { path },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data as { path?: string } | undefined)?.path ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await (existing as WindowClient).navigate(path);
        return;
      }
      await self.clients.openWindow(path);
    }),
  );
});
