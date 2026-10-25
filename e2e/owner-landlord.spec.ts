import { expect, test } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { CODE, signInWithOtp } from "./support/auth";
import { hydrated } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/** B7.1 / F6.1 — landlord self sign-up, the portfolio home and the one-step unit wizard (D-251). */

async function resetPortfolio(): Promise<void> {
  await fetch(`${MOCK_API}/__mock/owner/reset?part=portfolio`, { method: "POST" });
}

test.describe.configure({ mode: "serial" });
test.beforeAll(resetPortfolio);

test("a house or condo owner signs up from the landlords page and adds a first unit", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/landlords`);
  await page.getByTestId("landlords-hero").getByTestId("landlords-signup").click();
  await expect(page).toHaveURL(`${HOSTS.owner}/signup`);
  await expectAxeClean(page);

  await page.getByTestId("signup-name").fill("สมศรี ใจงาม");
  await page.getByLabel(/เบอร์มือถือ|Mobile number/).fill("0891234567");
  await page.getByRole("button", { name: /ส่งรหัส|Send code/ }).click();
  await page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ }).fill(CODE);

  await expect(page).toHaveURL(`${HOSTS.owner}/portfolio?welcome=1`);
  await hydrated(page);
  await expect(page.getByTestId("portfolio")).toContainText("ยินดีต้อนรับ");
  await expect(page.getByTestId("session-summary")).toContainText("เจ้าของใหม่");

  await page.getByRole("link", { name: "เพิ่มยูนิตแรก" }).click();
  await expect(page.getByTestId("portfolio-new")).toBeVisible();
  await hydrated(page);

  // Required fields first: the condo needs its project and unit number.
  await page.getByTestId("portfolio-submit").click();
  await expect(page.getByTestId("portfolio-form")).toContainText("กรอกช่องนี้");

  await page.getByTestId("portfolio-project").fill("ไอดีโอ โมบิ อารีย์");
  await page.getByTestId("portfolio-unit-no").fill("12/345");
  await page.getByTestId("portfolio-line1").fill("ถนนพหลโยธิน");
  await page.getByTestId("portfolio-province").fill("กรุงเทพมหานคร");
  await page.getByTestId("portfolio-postcode").fill("10400");
  await page.getByTestId("portfolio-rent").fill("15000");
  await page.getByTestId("portfolio-submit").click();
  // Another owner already registered 12/345 in this project: the API says so, nothing is created.
  await expect(page.getByTestId("problem-notice")).toHaveAttribute("data-code", "portfolio.unit_claimed");

  await page.getByTestId("portfolio-unit-no").fill("12/346");
  await page
    .getByRole("radio", { name: /เฟอร์นิเจอร์|ครบ/ })
    .last()
    .click();
  await page.getByTestId("portfolio-submit").click();

  await expect(page).toHaveURL(/\/portfolio\?added=/);
  const card = page.getByTestId("portfolio-unit");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("ห้อง 12/346");
  await expect(card).toContainText("ไอดีโอ โมบิ อารีย์");
  await expect(card).toContainText("฿15,000.00/เดือน");
  await expect(card).toContainText("ว่าง");
});

test("a landlord signs in to the portfolio, not the building dashboard", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, "0810000006");
  await expect(page).toHaveURL(`${HOSTS.owner}/portfolio`);
  await hydrated(page);

  await expect(page.getByTestId("portfolio-unit")).toHaveCount(3);
  await expect(page.getByTestId("portfolio-summary")).toContainText("฿37,000.00");
  await expect(page.getByTestId("portfolio-collected")).toHaveText("฿15,000.00");
  const moving = page.locator('[data-testid="portfolio-unit"][data-unit-no="8/101"]');
  await expect(moving).toContainText("แจ้งย้ายออกแล้ว");
  await expect(moving).toContainText("ค้าง ฿22,000.00");

  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: "พอร์ตของฉัน" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "อาคาร", exact: true })).toHaveCount(0);
  await expectAxeClean(page);
});
