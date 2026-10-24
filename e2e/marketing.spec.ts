import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";

/** F1 1.3 §7: the owner host's public pages — the only indexable ones. */
const get = (request: import("@playwright/test").APIRequestContext, host: string, path: string) => {
  const url = new URL(host);
  return request.get(`http://127.0.0.1:${url.port}${path}`, { headers: { host: url.host } });
};

/** Every JSON-LD graph on the page, flattened (a script may hold one graph or an array of them). */
async function jsonLdGraphs(page: import("@playwright/test").Page): Promise<Record<string, unknown>[]> {
  const bodies = await page.locator('script[type="application/ld+json"]').allTextContents();
  return bodies.flatMap((body) => [JSON.parse(body)].flat() as Record<string, unknown>[]);
}

test("landing: hero, repair-request section, Organization JSON-LD, indexable", async ({ page }) => {
  const response = await page.goto(`${HOSTS.owner}/`);
  expect(response!.headers()["x-robots-tag"]).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("สิ้นเดือนนี้ ไม่ต้องเดินจดมิเตอร์");
  await expect(page.getByRole("heading", { level: 2, name: "แจ้งซ่อมผ่าน LINE ไม่ต้องรับโทรศัพท์" })).toBeVisible();
  // Organization, WebSite (with the listings search), SoftwareApplication (free) and FAQPage, for search and answer engines.
  const graphs = await jsonLdGraphs(page);
  expect(graphs.find((g) => g["@type"] === "Organization")).toMatchObject({
    name: "getproperty",
    logo: expect.stringMatching(/\/brand\/getproperty-logo\.png$/),
  });
  expect(graphs.find((g) => g["@type"] === "WebSite")).toHaveProperty("potentialAction");
  expect(graphs.find((g) => g["@type"] === "SoftwareApplication")).toMatchObject({ offers: { price: "0" } });
  expect(graphs.find((g) => g["@type"] === "FAQPage")).toBeTruthy();
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
  expect(sitemap).toContain("/rent</loc>");
  expect(sitemap).toContain("/rent/condo-ari-1br-sunlit</loc>");
  expect(sitemap).toContain(`hreflang="en" href="${HOSTS.owner}/en/legal/dpa"`);
  expect(sitemap).not.toContain("dashboard");
  const robots = await (await get(request, HOSTS.owner, "/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${HOSTS.owner}/sitemap.xml`);
  expect(robots).toContain("Disallow: /");
  expect(robots).toContain("Allow: /rent/");
  expect(robots).toContain("Allow: /llms.txt$");
  expect((await get(request, HOSTS.staff, "/sitemap.xml")).status()).toBe(404);
});

test("llms.txt: a markdown statement for answer engines, on the indexed host only", async ({ request }) => {
  const response = await get(request, HOSTS.owner, "/llms.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/markdown");
  const body = await response.text();
  expect(body.startsWith("# getproperty\n")).toBe(true);
  expect(body).toContain("getproperty คืออะไร");
  expect(body).toContain("/rent/condo-ari-1br-sunlit");
  expect((await get(request, HOSTS.staff, "/llms.txt")).status()).toBe(404);
});

test("rent: published listings, filters in the URL, no axe violations (D-252)", async ({ page }) => {
  const response = await page.goto(`${HOSTS.owner}/rent`);
  expect(response!.headers()["x-robots-tag"]).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("หาที่อยู่ใหม่ จากเจ้าของตัวจริง");
  await expect(page.getByTestId("listings-count")).toHaveText("พบ 6 ห้อง");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/rent$/);
  expect((await jsonLdGraphs(page)).some((g) => g["@type"] === "ItemList")).toBe(true);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
  await page.goto(`${HOSTS.owner}/rent?kind=house`);
  await expect(page.getByTestId("listings-count")).toHaveText("พบ 1 ห้อง");
});

test("rent detail: full address, rent, owner contact, Offer JSON-LD; unknown slug is 404", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/rent/condo-ari-1br-sunlit`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("คอนโดแสงดีใกล้ BTS อารีย์ 1 ห้องนอน วิวสวน");
  await expect(page.getByTestId("listing-rent")).toHaveText("฿16,500");
  await expect(page.getByTestId("listing-gallery")).toBeVisible();
  expect((await jsonLdGraphs(page)).some((g) => g["@type"] === "Offer")).toBe(true);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
  expect((await page.goto(`${HOSTS.owner}/rent/no-such-listing`))?.status()).toBe(404);
});
