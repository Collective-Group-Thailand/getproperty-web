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
  expect(sitemap).toContain("/guides/tm30</loc>");
  expect(sitemap).toContain("/tools/rent-receipt</loc>");
  expect(sitemap).toContain("/rent/area/nonthaburi</loc>");
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
  expect(body).toContain("/guides/rental-income-tax");
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

test("rent detail shows the unit's real utility cost and links the verified owner's page (D-265, D-274)", async ({
  page,
}) => {
  await page.goto(`${HOSTS.owner}/rent/condo-ari-1br-sunlit`);
  const utility = page.getByTestId("listing-utility");
  await expect(utility).toContainText("หน่วยที่ 0–150");
  await expect(utility).toContainText("฿18.00 ต่อ ลบ.ม.");
  await expect(utility).toContainText("ค่าส่วนกลาง");
  await expect(page.getByTestId("listing-utility-average")).toContainText("฿1,385");

  await page.getByTestId("listing-owner-link").click();
  await expect(page).toHaveURL(`${HOSTS.owner}/owners/landlord-0a1b2c3d4e`);
  await expect(page.getByTestId("owner-name")).toHaveText("คุณนภา");
  await expect(page.getByText("ตรวจเอกสารสิทธิ์แล้ว 2 ห้อง")).toBeVisible();
  await expect(page.getByTestId("owner-reply")).toHaveText("ประมาณ 42 นาที");
  await expect(page.getByTestId("listings").getByRole("listitem")).toHaveCount(1);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);

  await page.goto(`${HOSTS.owner}/en/owners/landlord-0a1b2c3d4e`);
  await expect(page.getByText("Title checked for 2 units")).toBeVisible();
  // a listing whose owner's page is closed names the owner without a link; an unknown owner is 404
  await page.goto(`${HOSTS.owner}/rent/condo-onnut-studio-near-bts`);
  await expect(page.getByTestId("listing-owner-link")).toHaveCount(0);
  expect((await page.goto(`${HOSTS.owner}/owners/no-such-owner`))?.status()).toBe(404);
});

test("guides: index and an article with its short answer, Article and FAQ JSON-LD (D-271)", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/guides`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("รู้ก่อนปล่อยเช่า");
  await page.getByRole("link", { name: /ตม\.30 คืออะไร/ }).click();
  await expect(page).toHaveURL(/\/guides\/tm30$/);
  await expect(page.getByRole("heading", { level: 2, name: "สรุปสั้น" })).toBeVisible();
  const graphs = await jsonLdGraphs(page);
  expect(graphs.find((g) => g["@type"] === "Article")).toMatchObject({
    dateModified: expect.stringMatching(/^\d{4}-/),
  });
  expect(graphs.some((g) => g["@type"] === "FAQPage")).toBe(true);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
  expect((await page.goto(`${HOSTS.owner}/guides/no-such-guide`))?.status()).toBe(404);
});

test("tools: utility bill adds up, receipt writes the amount in words, yield shows a percentage (D-271)", async ({
  page,
}) => {
  await page.goto(`${HOSTS.owner}/tools/utility-bill`);
  await page.getByLabel("ค่าเช่าห้อง (บาท)").fill("4500");
  await page.getByLabel("เลขมิเตอร์ครั้งก่อน").first().fill("1200");
  await page.getByLabel("เลขมิเตอร์ครั้งนี้").first().fill("1325");
  await page.getByLabel("อัตราต่อหน่วย (บาท)").fill("7");
  await expect(page.getByText("฿5,375.00")).toBeVisible();

  await page.goto(`${HOSTS.owner}/tools/rent-receipt`);
  await page.getByLabel("ค่าเช่า", { exact: true }).fill("15000");
  await expect(page.getByText("(หนึ่งหมื่นห้าพันบาทถ้วน)")).toBeVisible();

  await page.goto(`${HOSTS.owner}/tools/rental-yield`);
  await page.getByLabel("ราคาซื้อ (บาท)").fill("3000000");
  await page.getByLabel("ค่าเช่าต่อเดือน (บาท)").fill("15000");
  await page.getByLabel("ค่าใช้จ่ายต่อปี (บาท)").fill("24000");
  await expect(page.getByText("4.7%")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("trust pages render, are indexable and accessible", async ({ page }) => {
  for (const [path, heading] of [
    ["/about", "เราทำ getproperty เพราะการเช่าบ้านไม่ควรเหนื่อยขนาดนี้"],
    ["/security", "ข้อมูลผู้เช่าของคุณ เราดูแลเหมือนของเรา"],
    ["/help", "มีอะไรให้เราช่วย"],
    ["/foreign-renters", "เช่าที่พักในไทย ไม่ต้องเดาว่าต้องทำอะไรบ้าง"],
    ["/en/foreign-renters", "Rent a home in Thailand without guessing the next step"],
  ] as const) {
    const response = await page.goto(`${HOSTS.owner}${path}`);
    expect(response!.headers()["x-robots-tag"]).toBeUndefined();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("contact: the form sends a lead and says so", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/contact`);
  await page.getByLabel("ชื่อ", { exact: true }).fill("สมชาย");
  await page.getByLabel("เบอร์โทร", { exact: true }).fill("0812345678");
  await page.getByLabel("ข้อความ", { exact: true }).fill("อยากย้ายข้อมูลจาก Excel");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ส่งข้อความ" }).click();
  await expect(page.getByRole("status")).toHaveText("ได้รับข้อความแล้ว ทีมงานจะติดต่อกลับในวันทำการ");
});

test("area page: listings near a station, nearby areas, 404 for an unknown area (D-272)", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/rent/area/ari`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ห้องเช่าใกล้อารีย์");
  await expect(page.getByTestId("listings").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "ย่านอื่นใกล้เคียง" })).toBeVisible();
  expect((await page.goto(`${HOSTS.owner}/rent/area/no-such-area`))?.status()).toBe(404);
});
