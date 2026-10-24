import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInWithOtp } from "./support/auth";

/**
 * F1 1.1: each host renders its own shell inside its own root layout, with its own security headers;
 * another zone's segment, the retired resident segments and unknown hosts are 404 (ADR-0004). The
 * hosts resolve to loopback through the browser's `--host-resolver-rules`, so no /etc/hosts entry is
 * needed.
 */
const ZONES = [
  { zone: "owner", host: HOSTS.owner, lang: "th", theme: "light" },
  { zone: "staff", host: HOSTS.staff, lang: "th", theme: "light" },
  { zone: "admin", host: HOSTS.admin, lang: "th", theme: "light" },
] as const;

for (const { zone, host, lang, theme } of ZONES) {
  test.describe(`${zone} zone`, () => {
    test("renders its sign-in page with the wordmark in its own root layout", async ({ page }) => {
      const response = await page.goto(`${host}/login`);
      expect(response?.status()).toBe(200);

      const html = page.locator("html");
      await expect(html).toHaveAttribute("data-zone", zone);
      await expect(html).toHaveAttribute("lang", lang);
      await expect(html).toHaveAttribute("data-theme", theme);

      await expect(page.getByTestId("auth-card")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // The founder's logo, drawn (no lettering set in a font) and named for assistive technology.
      await expect(page.locator("header").getByRole("img", { name: "getproperty" })).toBeVisible();
      await expect(page.locator("header svg text")).toHaveCount(0);
      await expect(page.locator("main#main")).toHaveCount(1);
      await page.keyboard.press("Tab");
      await expect(page.locator(".skip-link")).toBeFocused();
    });

    test("declares the brand icons and theme colour, and serves them on its host", async ({ page }) => {
      await page.goto(`${host}/login`);
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#1A4BA3");
      await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
        "href",
        "/brand/favicon.svg",
      );
      await expect(page.locator('link[rel="icon"][href^="/favicon.ico"]')).toHaveCount(1);
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/brand/apple-touch-icon.png");
      for (const [path, type] of [
        ["/favicon.ico", /image\/(x-icon|vnd\.microsoft\.icon)/],
        ["/brand/favicon.svg", /image\/svg\+xml/],
        ["/brand/apple-touch-icon.png", /image\/png/],
        ["/apple-touch-icon.png", /image\/png/],
        ["/brand/getproperty-logo.svg", /image\/svg\+xml/],
      ] as const) {
        // The other hosts resolve only inside the browser (`--host-resolver-rules`): ask loopback with the Host header.
        const url = new URL(host);
        const response = await page.request.get(`http://127.0.0.1:${url.port}${path}`, { headers: { host: url.host } });
        expect(response.status(), path).toBe(200);
        expect(response.headers()["content-type"], path).toMatch(type);
      }
    });

    test("is axe-clean (WCAG 2.2 AA)", async ({ page }) => {
      await page.goto(`${host}/login`);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });

    test("sends a nonce CSP and the zone's permissions", async ({ page }) => {
      const response = await page.goto(`${host}/login`);
      const headers = response!.headers();
      expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(headers["permissions-policy"]).toContain(zone === "staff" ? "camera=(self)" : "camera=()");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      // Every script in the server-rendered HTML carries the nonce, so the strict policy did not break
      // the page (chunks loaded later by those scripts are allowed by 'strict-dynamic').
      const nonce = /'nonce-([^']+)'/.exec(headers["content-security-policy"]!)![1];
      const html = await response!.text();
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      expect(scripts.length).toBeGreaterThan(0);
      for (const tag of scripts) {
        if (/type="application\/ld\+json"/.test(tag)) continue;
        expect(tag).toContain(`nonce="${nonce}"`);
      }
    });

    test("there is no resident zone — /tenant and /resident are 404 (D-154)", async ({ page }) => {
      expect((await page.goto(`${host}/tenant`))?.status()).toBe(404);
      expect((await page.goto(`${host}/resident/invoices`))?.status()).toBe(404);
      await expect(page.locator("html")).toHaveAttribute("data-zone", zone);
      await expect(page.getByTestId("not-found")).toBeVisible();
    });
  });
}

test("another zone's segment is a 404 on the wrong host", async ({ page }) => {
  expect((await page.goto(`${HOSTS.owner}/staff`))?.status()).toBe(404);
  expect((await page.goto(`${HOSTS.owner}/admin`))?.status()).toBe(404);
  expect((await page.goto(`${HOSTS.staff}/admin`))?.status()).toBe(404);
  expect((await page.goto(`${HOSTS.admin}/staff`))?.status()).toBe(404);
  // and therefore the other zones' BFFs too
  expect((await page.goto(`${HOSTS.owner}/staff/bff/v1/staff/me`))?.status()).toBe(404);
  expect((await page.goto(`${HOSTS.staff}/admin/bff/v1/admin/me`))?.status()).toBe(404);
});

test("an unknown host is a 404", async ({ request }) => {
  const port = new URL(HOSTS.owner).port;
  const response = await request.get(`http://127.0.0.1:${port}/`, { headers: { host: `unknown.example:${port}` } });
  expect(response.status()).toBe(404);
});

test("admin responses carry noindex; the owner landing does not", async ({ request }) => {
  // Node's resolver does not map *.localhost, so API requests go to loopback with the zone's Host.
  const get = (host: string, path: string) => {
    const url = new URL(host);
    return request.get(`http://127.0.0.1:${url.port}${path}`, { headers: { host: url.host } });
  };
  expect((await get(HOSTS.admin, "/")).headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect((await get(HOSTS.staff, "/")).headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect((await get(HOSTS.owner, "/")).headers()["x-robots-tag"]).toBeUndefined();
  expect(await (await get(HOSTS.admin, "/robots.txt")).text()).toContain("Disallow: /");
});

test("the owner host serves English under /en", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/en`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Close the month without walking the meters");
});

test("the theme choice stamps data-theme and the gp_theme cookie", async ({ page, context }) => {
  await signInWithOtp(page, HOSTS.owner, "0810000001");
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: "มืด" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const cookie = (await context.cookies(HOSTS.owner)).find((c) => c.name === "gp_theme");
  expect(cookie?.value).toBe("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
