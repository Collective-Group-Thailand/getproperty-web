import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";

/**
 * F0 smoke: each of the three hosts renders its own placeholder shell (00-master-plan.md §2) and the
 * shell is axe-clean (design-system.md §6). The hosts resolve to loopback through the browser's
 * `--host-resolver-rules`, so no /etc/hosts entry is needed.
 */
const ZONES = [
  { zone: "owner", host: HOSTS.owner, lang: "th", theme: "light" },
  { zone: "staff", host: HOSTS.staff, lang: "th", theme: "light" },
  { zone: "admin", host: HOSTS.admin, lang: "th", theme: "light" },
] as const;

for (const { zone, host, lang, theme } of ZONES) {
  test.describe(`${zone} zone`, () => {
    test("renders its placeholder shell with the wordmark", async ({ page }) => {
      const response = await page.goto(`${host}/`);
      expect(response?.status()).toBe(200);

      const html = page.locator("html");
      await expect(html).toHaveAttribute("data-zone", zone);
      await expect(html).toHaveAttribute("lang", lang);
      await expect(html).toHaveAttribute("data-theme", theme);

      await expect(page.getByTestId("zone-placeholder")).toHaveAttribute("data-zone", zone);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // The wordmark: visible lower-case brand name in the header, from BRAND_NAME.
      await expect(page.locator("header").getByText("getproperty", { exact: true })).toBeVisible();
      // One main landmark and a working skip link.
      await expect(page.locator("main#main")).toHaveCount(1);
      await page.keyboard.press("Tab");
      await expect(page.locator(".skip-link")).toBeFocused();
    });

    test("is axe-clean (WCAG 2.2 AA)", async ({ page }) => {
      await page.goto(`${host}/`);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  });
}

test("there is no resident zone any more — /tenant is not a route (D-154)", async ({ page }) => {
  const response = await page.goto(`${HOSTS.owner}/tenant`);
  expect(response?.status()).toBe(404);
});

test("the owner host serves English under /en", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/en`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Owner zone/);
});

test("the theme toggle stamps data-theme and the gp_theme cookie", async ({ page, context }) => {
  await page.goto(`${HOSTS.staff}/`);
  await page.getByRole("button", { name: "ธีม" }).click();
  await page.getByRole("menuitem", { name: "คอนทราสต์สูง" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "hc");
  const cookie = (await context.cookies(HOSTS.staff)).find((c) => c.name === "gp_theme");
  expect(cookie?.value).toBe("hc");
  // The next server render agrees with the cookie — no flash, no JS needed.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "hc");
});
