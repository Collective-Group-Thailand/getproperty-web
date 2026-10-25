import { expect, test } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { CODE, signInWithOtp } from "./support/auth";
import { hydrated } from "./support/owner";
import { signInPlatform } from "./support/admin";
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

/** A tiny PNG (1×1) — enough for the mock's upload, scan and attach. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("a landlord lists a vacant house: draft, photos, publish (F6.2)", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, "0810000006");
  await expect(page).toHaveURL(`${HOSTS.owner}/portfolio`);
  await hydrated(page);
  await page.locator('[data-testid="portfolio-unit"][data-unit-no="1"]').getByTestId("portfolio-list-unit").click();
  await expect(page.getByTestId("listing-create")).toBeVisible();
  await hydrated(page);
  await page.getByTestId("listing-headline").fill("บ้านเดี่ยว 3 ห้องนอน มีสวน นนทบุรี");
  await page.getByTestId("listing-create-submit").click();

  await expect(page.getByTestId("listing-editor")).toBeVisible();
  await hydrated(page);
  await page.getByTestId("listing-submit").click();
  await expect(page.getByTestId("listing-missing")).toContainText("รูป");

  await page
    .getByTestId("listing-photo-input")
    .setInputFiles(
      Array.from({ length: 5 }, (_, i) => ({ name: `house-${i + 1}.png`, mimeType: "image/png", buffer: PNG })),
    );
  await expect(page.getByTestId("listing-photo")).toHaveCount(5);
  await expect(page.getByTestId("listing-photo").first()).toContainText("รูปปก");

  await page.getByTestId("listing-description").fill("บ้านพร้อมสวน ใกล้ทางด่วน นัดดูได้ทุกเสาร์");
  await page.getByTestId("listing-details-save").click();
  await expect(page.getByTestId("listing-details")).toContainText("บันทึกแล้ว");

  await page.getByTestId("listing-submit").click();
  await expect(page.getByTestId("listing-state-hint")).toContainText("เผยแพร่อยู่บนหน้า /rent");
  await expect(page.getByTestId("listing-view")).toBeVisible();
  await expectAxeClean(page);

  await page.goto(`${HOSTS.owner}/listings`);
  await expect(page.getByTestId("listing-card")).toHaveCount(3);
});

test("support reviews listings: approves, restores a reported one and verifies an owner (F6.5)", async ({ page }) => {
  await signInPlatform(page, "support");
  await page.goto(`${HOSTS.admin}/listings`);
  const queue = page.getByTestId("moderation-row");
  await expect(queue).toHaveCount(1);
  await queue.first().getByTestId("moderation-approve").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("moderation-row")).toHaveCount(0);

  await page.getByTestId("listings-tab-reported").click();
  const reported = page.getByTestId("moderation-row");
  await expect(reported).toHaveCount(1);
  await expect(reported).toContainText("3 reports");
  await reported.getByTestId("moderation-restore").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Restore" }).click();
  await expect(page.getByTestId("moderation-row")).toHaveCount(0);

  await page.getByTestId("listings-tab-verifications").click();
  await page.getByTestId("verification-open").click();
  await expect(page.getByTestId("verification-evidence")).toBeVisible();
  await page.getByTestId("verification-approve").click();
  await expect(page.getByTestId("verification-row")).toHaveCount(0);
  await expectAxeClean(page);
});

test("a landlord answers enquiries: reply in LINE, confirm a viewing, close one lost (F6.2 part 2)", async ({
  page,
}) => {
  await signInWithOtp(page, HOSTS.owner, "0810000006");
  await page.goto(`${HOSTS.owner}/leads`);
  await hydrated(page);
  await expect(page.getByTestId("leads")).toBeVisible();
  await expect(page.getByTestId("leads-upcoming")).toContainText("ธนพล ศรีสุข");
  // Without a tab the inbox opens on what waits for an answer.
  const waiting = page.getByTestId("lead-row");
  await expect(waiting).toHaveCount(1);
  await expect(waiting.first()).toContainText("สมศรี ใจดี");
  await expect(waiting.first()).toHaveAttribute("data-awaiting", "true");
  await expectAxeClean(page);

  await waiting.first().getByRole("link").click();
  await expect(page.getByTestId("lead-detail")).toContainText("สมศรี ใจดี");
  await hydrated(page);
  await expect(page.getByTestId("lead-viewing")).toHaveAttribute("data-state", "requested");
  await expectAxeClean(page);

  await page.getByTestId("lead-reply-input").fill("ยังว่างค่ะ เจอกันวันเสาร์นะคะ");
  await page.getByTestId("lead-reply-send").click();
  await expect(page.getByTestId("lead-message").last()).toHaveAttribute("data-author", "owner");
  await expect(page.getByTestId("lead-message").last()).toContainText("เจอกันวันเสาร์");

  await page.getByTestId("viewing-confirm").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ยืนยันนัด" }).click();
  await expect(page.getByTestId("lead-viewing")).toHaveAttribute("data-state", "confirmed");
  // B7.4: the lease is drafted from here once the prospect wants the place.
  await expect(page.getByTestId("lead-lease-draft")).toBeVisible();

  // Answered: nothing waits any more, so the inbox opens on the conversations in progress.
  await page.goto(`${HOSTS.owner}/leads?view=awaiting`);
  await expect(page.getByTestId("lead-row")).toHaveCount(0);
  await page.getByTestId("leads-tab-open").click();
  await page.getByTestId("lead-row").filter({ hasText: "Daniel Weber" }).getByRole("link").click();
  await hydrated(page);
  await page.getByTestId("lead-lost").click();
  await page.getByTestId("lead-lost-reason").selectOption("chose_other");
  await page.getByRole("dialog").getByRole("button", { name: "ไม่สำเร็จ" }).click();
  await expect(page.getByTestId("lead-outcome")).toContainText("เลือกที่อื่นแล้ว");
  await expect(page.getByTestId("lead-closed")).toBeVisible();

  await page.goto(`${HOSTS.owner}/leads?view=closed`);
  await expect(page.getByTestId("lead-row")).toHaveCount(2);
});

test("a landlord opens the documents of one unit from the portfolio (B7.5)", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, "0810000006");
  await expect(page).toHaveURL(`${HOSTS.owner}/portfolio`);
  await hydrated(page);
  const leased = page.locator('[data-testid="portfolio-unit"][data-unit-no="12/345"]');
  await leased.getByTestId("portfolio-documents").click();
  await expect(page).toHaveURL(/\/documents\?unit=/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("เอกสารของห้องนี้");
  const rows = page.getByTestId("document-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute("data-kind", "pdf_receipt");
  await expect(page.getByTestId("documents-zip")).toHaveCount(0);
  await expectAxeClean(page);

  await page.getByTestId("filter-kind").selectOption("contract");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("สัญญาเช่า 12/345");
});
