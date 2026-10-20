import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";

/** F1 1.3 §7: the owner host's public pages — the only indexable ones. */
const get = (request: import("@playwright/test").APIRequestContext, host: string, path: string) => {
  const url = new URL(host);
  return request.get(`http://127.0.0.1:${url.port}${path}`, { headers: { host: url.host } });
};

test("landing: hero, lawful-rate teaser from the API, Organization JSON-LD, indexable", async ({ page }) => {
  const response = await page.goto(`${HOSTS.owner}/`);
  expect(response!.headers()["x-robots-tag"]).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("บิลทำเอง เก็บเงินเอง ถูกกฎหมาย");
  await expect(page.getByTestId("loss-ceiling")).toContainText("4.6189");
  await page.getByRole("radio", { name: "การไฟฟ้าส่วนภูมิภาค (กฟภ.)" }).click();
  await expect(page.getByTestId("loss-ceiling")).toContainText("4.6189");
  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(jsonLd).toMatchObject({ "@type": "Organization", name: "getproperty" });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en$/);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("pricing shows the plans the API publishes, formatted", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/pricing`);
  const plans = page.getByTestId("pricing-plans");
  await expect(plans.getByRole("heading", { name: "Apartment Starter" })).toBeVisible();
  await expect(plans).toContainText("฿25.00 / ห้อง / เดือน");
  await expect(plans).toContainText("ขั้นต่ำ 20 ห้อง");
});

test("legal pages in both languages; an unknown one is 404", async ({ page }) => {
  for (const doc of ["terms", "privacy", "pdpa", "dpa"]) {
    expect((await page.goto(`${HOSTS.owner}/legal/${doc}`))?.status()).toBe(200);
    await expect(page.getByTestId("legal-page").getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto(`${HOSTS.owner}/en/legal/pdpa`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Personal data protection notice");
  expect((await page.goto(`${HOSTS.owner}/legal/cookies`))?.status()).toBe(404);
});

test("sitemap lists only the marketing pages, robots points at it", async ({ request }) => {
  const sitemap = await (await get(request, HOSTS.owner, "/sitemap.xml")).text();
  expect(sitemap).toContain(`<loc>${HOSTS.owner}/</loc>`);
  expect(sitemap).toContain("/pricing</loc>");
  expect(sitemap).toContain(`hreflang="en" href="${HOSTS.owner}/en/legal/dpa"`);
  expect(sitemap).not.toContain("dashboard");
  const robots = await (await get(request, HOSTS.owner, "/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${HOSTS.owner}/sitemap.xml`);
  expect(robots).toContain("Disallow: /");
  expect((await get(request, HOSTS.staff, "/sitemap.xml")).status()).toBe(404);
});
