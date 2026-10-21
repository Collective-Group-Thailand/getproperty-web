import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInWithOtp } from "./support/auth";

/** F1 1.3 §5: the staff host is an installable PWA with a service worker; the other hosts are not. */
const get = (request: import("@playwright/test").APIRequestContext, host: string, path: string) => {
  const url = new URL(host);
  return request.get(`http://127.0.0.1:${url.port}${path}`, { headers: { host: url.host } });
};

test("manifest and service worker are served on the staff host only", async ({ request }) => {
  const manifest = await get(request, HOSTS.staff, "/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  const body = await manifest.json();
  expect(body).toMatchObject({ display: "standalone", start_url: "/", scope: "/", theme_color: "#1A4BA3" });
  expect(body.background_color).toMatch(/^#[0-9a-f]{6}$/);
  expect(body.icons).toEqual([
    { src: "/pwa/staff-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/pwa/staff-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/pwa/staff-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ]);
  for (const icon of body.icons as { src: string }[]) {
    const file = await get(request, HOSTS.staff, icon.src);
    expect(file.status(), icon.src).toBe(200);
    expect(file.headers()["content-type"], icon.src).toBe("image/png");
  }
  const sw = await get(request, HOSTS.staff, "/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["service-worker-allowed"]).toBe("/");
  expect(sw.headers()["cache-control"]).toBe("no-cache");
  expect((await get(request, HOSTS.owner, "/sw.js")).status()).toBe(404);
  expect((await get(request, HOSTS.admin, "/manifest.webmanifest")).status()).toBe(404);
});

test("the staff PWA registers its worker and links its manifest", async ({ page }) => {
  await signInWithOtp(page, HOSTS.staff, "0810000004");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope).toBe(`${HOSTS.staff}/`);
});

/** Every cached response the page can see: cache name, URL, content type and whether the body names `needle`. */
async function cachedEntries(page: import("@playwright/test").Page, needle: string) {
  return page.evaluate(async (text) => {
    const found: { cache: string; url: string; type: string; hit: boolean }[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const body = response ? await response.clone().text() : "";
        found.push({
          cache: name,
          url: request.url,
          type: response?.headers.get("content-type") ?? "",
          hit: body.includes(text),
        });
      }
    }
    return found;
  }, needle);
}

test("the staff worker caches no page, shows a static offline page, and sign-out leaves nothing personal (review H2, M3, M4)", async ({
  page,
  context,
}) => {
  await signInWithOtp(page, HOSTS.staff, "0810000004");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the worker
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const me = await page.evaluate(async () => {
    const response = await fetch("/bff/v1/staff/me");
    return (await response.json()) as { user: { id: string; displayName: string }; currentTenant: { id: string } };
  });
  await page.goto(`${HOSTS.staff}/readings`);
  await page.goto(`${HOSTS.staff}/`);

  // Only the static offline page is HTML in Cache Storage; nothing rendered for this user is.
  const entries = await cachedEntries(page, me.user.displayName);
  const pages = entries.filter((entry) => entry.type.includes("text/html"));
  expect(pages.map((entry) => new URL(entry.url).pathname)).toEqual(["/offline"]);
  expect(entries.some((entry) => entry.hit)).toBe(false);

  // Offline, a navigation gets the offline page — not the last render of the page.
  await context.setOffline(true);
  await page.goto(`${HOSTS.staff}/`).catch(() => undefined);
  await expect(page.getByRole("heading", { name: "ไม่มีการเชื่อมต่อ" })).toBeVisible();
  await expect(page.getByRole("img", { name: "getproperty" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(me.user.displayName);
  await context.setOffline(false);
  await page.goto(`${HOSTS.staff}/`);

  // What this person leaves behind: an unsent queued reading, a push subscription, a stale page cache.
  await page.evaluate(
    async ({ userId, tenantId }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("gp-staff-queue", 2);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("entries", "readwrite");
          tx.objectStore("entries").put({
            id: "e2e-entry",
            owner: { userId, tenantId },
            idempotencyKey: crypto.randomUUID(),
            method: "POST",
            path: "/v1/staff/meter-readings",
            body: {},
            label: "A-201",
            createdAt: Date.now(),
            attempts: 0,
            nextAttemptAt: Date.now() + 3_600_000,
            state: "pending",
          });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      });
      localStorage.setItem(
        "gp_push_subscription",
        JSON.stringify({
          zone: "staff",
          id: "3b241101-e2bb-4255-8caf-4136c566a962",
          endpoint: "https://push.invalid/x",
        }),
      );
      await (await caches.open("gp-staff-pages-legacy")).put("/", new Response("<html>old render</html>"));
    },
    { userId: me.user.id, tenantId: me.currentTenant.id },
  );

  const unsubscribed = page.waitForRequest(
    (request) =>
      request.method() === "DELETE" &&
      request.url().endsWith("/bff/v1/staff/push-subscriptions/3b241101-e2bb-4255-8caf-4136c566a962"),
  );
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  // One unsent item: the staff member is told it will be deleted before anything happens.
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("1 item has not been sent yet");
  await confirm.getByRole("button", { name: "Sign out" }).click();
  await unsubscribed;
  await page.waitForURL(`${HOSTS.staff}/login`);

  const after = await page.evaluate(async () => {
    const queued = await new Promise<number>((resolve) => {
      const open = indexedDB.open("gp-staff-queue", 2);
      open.onsuccess = () => {
        const count = open.result.transaction("entries").objectStore("entries").count();
        count.onsuccess = () => resolve(count.result);
      };
    });
    return { caches: await caches.keys(), queued, push: localStorage.getItem("gp_push_subscription") };
  });
  expect(after.queued).toBe(0);
  expect(after.push).toBeNull();
  expect(after.caches.every((name) => name === "gp-staff-static" || name.startsWith("gp-staff-shell-"))).toBe(true);
});
