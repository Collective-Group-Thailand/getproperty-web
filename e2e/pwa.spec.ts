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
  expect(await manifest.json()).toMatchObject({ display: "standalone", start_url: "/", scope: "/" });
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
