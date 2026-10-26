import { expect, test } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * B7.11 — the portable rent record (D-256) and no empty months (D-261): what a landlord sees on an enquiry when the
 * prospect shared their record, the public letter check, and the vacancy view on the portfolio.
 */

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/owner/reset?part=portfolio`, { method: "POST" });
});

test("a landlord sees the rent record a prospect shared, and the empty and soon-empty units", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, "0810000006");
  await expect(page).toHaveURL(`${HOSTS.owner}/portfolio`);
  await hydrated(page);
  const vacancy = page.getByTestId("portfolio-vacancy");
  await expect(vacancy.getByTestId("vacancy-row")).toHaveCount(2);
  const house = vacancy.locator('[data-testid="vacancy-row"][data-unit-no="1"]');
  await expect(house).toContainText("ว่างตั้งแต่");
  await expect(house.getByTestId("vacancy-list")).toHaveAttribute("href", /\/listings\/new\?unit=/);
  const moving = vacancy.locator('[data-testid="vacancy-row"][data-unit-no="8/101"]');
  await expect(moving).toContainText("ผู้เช่าแจ้งออก");
  await expect(moving.getByTestId("vacancy-leads")).toHaveText("คนสนใจ 0 คน");
  await expectAxeClean(page);

  await gotoOwner(page, "/leads/5e7a9c1b-0000-4000-8000-0000000e1001");
  const record = page.getByTestId("rent-record");
  await expect(record.getByTestId("rent-record-on_time")).toContainText("10 เดือน");
  await expect(record.getByTestId("rent-record-late")).toContainText("1 เดือน");
  await expect(record.locator('[data-status="late"]')).toHaveCount(1);
  await expectAxeClean(page);
  await gotoOwner(page, "/leads/5e7a9c1b-0000-4000-8000-0000000e1002");
  await expect(page.getByTestId("lead-rent-record-none")).toBeVisible();
});

test("anyone with a letter's code checks it; a wrong code says so", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/rent-record`);
  await page.getByTestId("rent-record-check").getByRole("textbox").fill("h4n8-r2k7-qx");
  await page.getByTestId("rent-record-check").getByRole("button").click();
  await expect(page).toHaveURL(/\/rent-record\/H4N8R2K7QX$/);
  await expect(page.getByTestId("rent-record-letter")).toContainText("ยืนยันโดย getproperty");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("สมศรี ใจดี");
  await expectAxeClean(page);

  await page.goto(`${HOSTS.owner}/rent-record/ZZZZZZZZZZ`);
  await expect(page.getByTestId("rent-record-not-found")).toBeVisible();
});
