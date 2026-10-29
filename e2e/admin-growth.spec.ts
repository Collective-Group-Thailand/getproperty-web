import { expect, test } from "@playwright/test";

import { MOCK_API } from "../playwright.config";
import { gotoAdmin, platformReceived, resetPlatform, signInPlatform, typePhrase } from "./support/admin";
import { expectAxeClean } from "./support/staff";

/**
 * GW4 — growth billing on the admin console (api G5; D-091, D-293, D-297; O-032): Finance disputes an invoiced
 * success fee → a credit note is requested (maker) → another platform user approves it on the invoice → the fee shows
 * credited; an uninvoiced fee cannot be disputed. The platform team books a paid photo order, uploads the files as
 * documents of the ordering tenant and delivers; an open order is cancelled with a reason.
 */

test.describe.configure({ mode: "serial" });

const resetGrowth = () => fetch(`${MOCK_API}/__mock/owner/reset?part=growth`, { method: "POST" });
const ORDER = "0199f2a0-0000-7000-8000-00000000e001";
const SUCCESS_FEE = "0199f2a0-0000-7000-8000-00000000f001";
const UNINVOICED_FEE = "0199f2a0-0000-7000-8000-00000000f003";

test.beforeAll(async () => {
  await resetPlatform();
  await resetGrowth();
});
test.afterAll(resetGrowth);

test("growth fees: dispute → credit note requested → approved by a second user → credited", async ({ browser }) => {
  // A context of its own: axe needs one, and each user keeps their own session.
  const financeContext = await browser.newContext();
  const finance = await financeContext.newPage();
  await signInPlatform(finance, "finance");
  await gotoAdmin(finance, "/subscriptions");
  await finance.getByTestId("billing-tab-fees").click();
  await expect(finance.getByTestId("billing-fees")).toBeVisible();
  const row = (id: string) => finance.locator(`[data-testid="fee-accrual-row"][data-id="${id}"]`);
  await expect(row(UNINVOICED_FEE)).toHaveAttribute("data-state", "uninvoiced");
  await expect(row(UNINVOICED_FEE).getByTestId("fee-dispute")).toHaveCount(0);
  await expect(row(SUCCESS_FEE)).toHaveAttribute("data-state", "invoiced");
  await expect(row(SUCCESS_FEE).getByTestId("fee-invoice")).toHaveText("PIV-2026-00812");
  await expectAxeClean(finance);

  await row(SUCCESS_FEE).getByTestId("fee-dispute").click();
  const dialog = finance.getByRole("alertdialog");
  await expect(dialog).toContainText("PIV-2026-00812");
  await dialog.getByTestId("fee-dispute-reason").fill("ดีลยกเลิกภายใน 7 วัน ผู้เช่าไม่ย้ายเข้า");
  await dialog.getByRole("button", { name: "Request credit note" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row(SUCCESS_FEE)).toHaveAttribute("data-state", "disputed");
  await expect(row(SUCCESS_FEE).getByTestId("fee-credit-note")).toContainText("฿1,605.00");
  expect((await platformReceived("admin.feeAccruals.dispute")).at(-1)?.idempotencyKey).toBeTruthy();
  await financeContext.close();

  // Maker-checker (D-091): another platform user decides on the invoice.
  // A context of its own: axe needs one, and each user keeps their own session.
  const checkerContext = await browser.newContext();
  const checker = await checkerContext.newPage();
  await signInPlatform(checker, "checker");
  await gotoAdmin(checker, "/subscriptions/fees?state=disputed");
  await checker.getByTestId("fee-decide").first().click();
  await checker.getByTestId("approve-credit-note").click();
  const approve = checker.getByRole("alertdialog");
  await typePhrase(approve);
  await approve.getByRole("button", { name: "Approve" }).click();
  await expect(approve).toHaveCount(0);
  await gotoAdmin(checker, "/subscriptions/fees");
  await expect(checker.locator(`[data-testid="fee-accrual-row"][data-id="${SUCCESS_FEE}"]`)).toHaveAttribute(
    "data-state",
    "credited",
  );
  await checkerContext.close();
});

test("photo services: a paid order is booked, its files uploaded and delivered", async ({ page }) => {
  await signInPlatform(page, "support");
  await gotoAdmin(page, "/listings");
  await page.getByTestId("listings-tab-media").click();
  await expect(page.getByTestId("admin-media-orders")).toBeVisible();
  const row = page.locator(`[data-testid="media-order-row"][data-id="${ORDER}"]`);
  await expect(row).toHaveAttribute("data-state", "requested");
  await expectAxeClean(page);

  await row.getByRole("link").first().click();
  await expect(page.getByTestId("admin-media-order")).toBeVisible();
  await page.getByTestId("media-schedule").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("media-schedule-when").fill("2026-11-03T14:30");
  await dialog.getByTestId("media-schedule-ref").fill("PARTNER-2026-0042");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("media-order-next")).toContainText("deliver the files");

  await page
    .getByTestId("media-deliver-files")
    .locator('input[type="file"]')
    .setInputFiles([
      { name: "room-01.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake-jpeg-bytes-01") },
      { name: "room-02.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake-jpeg-bytes-0002") },
    ]);
  await expect(page.getByTestId("media-uploaded")).toHaveCount(2);
  await page.getByTestId("media-deliver-submit").click();
  await expect(page.getByTestId("media-order-next")).toContainText("2 files delivered");
  await expect(page.getByTestId("media-cancel")).toHaveCount(0);
  await expectAxeClean(page);
});

test("an open order is cancelled with a reason", async ({ page }) => {
  await resetGrowth();
  await signInPlatform(page, "support");
  await gotoAdmin(page, `/listings/media/${ORDER}`);
  await page.getByTestId("media-cancel").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("credit note");
  await dialog.getByTestId("media-cancel-reason").fill("เจ้าของขอยกเลิก ห้องปล่อยเช่าได้แล้ว");
  await dialog.getByRole("button", { name: "Cancel order" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("media-order-next")).toContainText("Cancelled");
  expect((await platformReceived("admin.mediaServices.cancel")).at(-1)?.idempotencyKey).toBeTruthy();
});
