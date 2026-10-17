/// <reference lib="webworker" />
/**
 * The staff PWA's service worker (ADR-0007), bundled by `scripts/build-sw.ts` into
 * `src/lib/pwa/generated/staff-sw.ts` and served at `/sw.js` on the staff host only.
 *
 * - App shell: navigations are network-first and fall back to the cached page (the last good render of
 *   that path, else "/"), so the PWA opens in a basement with no signal; Next's hashed static assets
 *   and the fonts are cache-first; brand images stale-while-revalidate.
 * - Never cached: `/bff/*` (authenticated API traffic) and anything cross-origin (signed upload URLs).
 * - Background Sync `gp-offline-queue` → asks an open page to replay the IndexedDB queue (the page owns
 *   the queue and its session cookies).
 * - Web push: shows the notification the API sent; a tap focuses the PWA (or opens the given path).
 */
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;
declare const __SW_VERSION__: string;

const PAGES = `gp-staff-pages-${__SW_VERSION__}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(new Request("/", { credentials: "same-origin" })))
      .catch(() => undefined),
  );
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("gp-staff-pages-") && key !== PAGES).map((key) => caches.delete(key)),
        ),
      ),
  );
});
clientsClaim();

registerRoute(({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/bff/"), new NetworkOnly());

const pages = new NetworkFirst({
  cacheName: PAGES,
  networkTimeoutSeconds: 4,
  plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 40 })],
});
registerRoute(
  new NavigationRoute(async (options) => {
    try {
      return await pages.handle(options);
    } catch {
      const cache = await caches.open(PAGES);
      return (await cache.match("/")) ?? Response.error();
    }
  }),
);

registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"),
  new CacheFirst({
    cacheName: "gp-staff-static",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 86400 }),
    ],
  }),
);

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin && (request.destination === "image" || url.pathname.startsWith("/pwa/")),
  new StaleWhileRevalidate({ cacheName: "gp-staff-images", plugins: [new ExpirationPlugin({ maxEntries: 60 })] }),
);

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
  if ((event.data as { type?: string } | null)?.type === "gp:skip-waiting") void self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let payload: { title?: string; body?: string; path?: string; tag?: string } = {};
  try {
    payload = (event.data?.json() ?? {}) as typeof payload;
  } catch {
    payload = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "getproperty", {
      body: payload.body ?? "",
      tag: payload.tag,
      icon: "/pwa/staff-192.png",
      badge: "/pwa/staff-192.png",
      data: { path: payload.path && payload.path.startsWith("/") ? payload.path : "/" },
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
