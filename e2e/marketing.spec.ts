import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";

/** F1 1.3 §7: the owner host's public pages — the only indexable ones. */
const get = (request: import("@playwright/test").APIRequestContext, host: string, path: string) => {
  const url = new URL(host);
  return request.get(`http://127.0.0.1:${url.port}${path}`, { headers: { host: url.host } });
};

test("landing: hero, repair-request section, Organization JSON-LD, indexable", async ({ page }) => {
  const response = await page.goto(`${HOSTS.owner}/`);
  expect(response!.headers()["x-robots-tag"]).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("สิ้นเดือนนี้ ไม่ต้องเดินจดมิเตอร์");
  await expect(page.getByRole("heading", { level: 2, name: "แจ้งซ่อมผ่าน LINE ไม่ต้องรับโทรศัพท์" })).toBeVisible();
  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(jsonLd).toMatchObject({
    "@type": "Organization",
    name: "getproperty",
    logo: /\/brand\/getproperty-logo\.png$/,
  });
  // The founder's logo in the header (drawn, not set in a font), and the Open Graph card.
  await expect(page.locator("header svg[data-brand='wordmark']")).toBeVisible();
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toMatch(/\/brand\/og-image\.png$/);
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const card = await page.request.get(new URL(new URL(og!).pathname, HOSTS.owner).href);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toBe("image/png");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en$/);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("pricing: free to use, fee per collected payment, hardware add-ons from the API (D-250)", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/pricing`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ใช้ฟรี จ่ายเฉพาะเมื่อรับเงินผ่านระบบ");
  const model = page.getByTestId("pricing-model");
  await expect(model.getByRole("heading", { name: "ค่าธรรมเนียมการรับชำระ" })).toBeVisible();
  // Per-unit subscription plans are no longer sold; only add-ons from the API are listed.
  const addons = page.getByTestId("pricing-plans");
  await expect(addons.getByRole("heading", { name: "Access Add-on" })).toBeVisible();
  await expect(addons).not.toContainText("Apartment Starter");
});

test("landlords page: house and condo owners, indexable, no axe violations", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/landlords`);
  await expect(page.getByTestId("landlords-hero").getByRole("heading", { level: 1 })).toContainText(
    "ปล่อยเช่าเองได้แบบมืออาชีพ",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/landlords$/);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
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
  expect(sitemap).toContain("/landlords</loc>");
  expect(sitemap).toContain(`hreflang="en" href="${HOSTS.owner}/en/legal/dpa"`);
  expect(sitemap).not.toContain("dashboard");
  const robots = await (await get(request, HOSTS.owner, "/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${HOSTS.owner}/sitemap.xml`);
  expect(robots).toContain("Disallow: /");
  expect((await get(request, HOSTS.staff, "/sitemap.xml")).status()).toBe(404);
});
