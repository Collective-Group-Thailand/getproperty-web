import { expect, test } from "@playwright/test";

import { expectAxeClean } from "./support/staff";
import { gotoOwner, received, resetOwner, signInOwner } from "./support/owner";

/**
 * F2 2.4 on the mock API: payments list and detail, the slip review queue (zoomable picture,
 * verification facts, duplicate warning, a refused partial approval, approve / reject with Idempotency
 * Keys), a manual cash payment with its typed confirmation, a credit refund, arrears (aging, filters,
 * party ledger, reminder now, export) and the documents archive with the zip export — axe on each.
 */
test.describe.configure({ mode: "serial" });

const PAYMENT_QR = "9a9e0000-0000-4000-8000-000000000001";
const SLIP_REVIEW = "5119e000-0000-4000-8000-000000000001";
const SLIP_DUPLICATE = "5119e000-0000-4000-8000-000000000002";
const INVOICE_B101_PREV = "1e700000-0000-4000-8000-000000000103";
const PARTY_ANAN = "9a700000-0000-4000-8000-000000000003";

test.beforeAll(async () => {
  await resetOwner();
});

test("payments: list with filters, detail with allocation and receipt", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/payments");
  // Two booked payments and the QR callback held as a possible duplicate (D-220).
  await expect(page.getByTestId("payment-row")).toHaveCount(3);
  await expect(page.getByTestId("payment-held")).toHaveCount(1);
  await expect(page.getByTestId("money-tab-slips")).toContainText("2");
  await expect(page.getByTestId("money-tab-held")).toContainText("1");
  await expectAxeClean(page);
  await gotoOwner(page, "/payments?method=qr");
  await expect(page.getByTestId("payment-row")).toHaveCount(2);

  await gotoOwner(page, `/payments/${PAYMENT_QR}`);
  await expect(page.getByTestId("allocation")).toHaveCount(1);
  await page.getByTestId("receipt-pdf").first().click();
  await expect(page.getByRole("dialog").locator("iframe")).toBeVisible();
  await page.keyboard.press("Escape");
  await expectAxeClean(page);
});

test("slip queue: duplicate warning, refused partial approval, approve the full amount, reject the duplicate", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, `/payments/slips?slip=${SLIP_DUPLICATE}`);
  await expect(page.getByTestId("slip-row")).toHaveCount(2);
  await expect(page.getByTestId("slip-duplicate")).toBeVisible();
  await expect(page.getByTestId("slip-image")).toBeVisible();
  await page.getByTestId("slip-image").getByRole("button", { name: "ขยาย" }).click();
  await expect(page.getByTestId("slip-image")).not.toHaveAttribute("data-zoom", "1");
  await expectAxeClean(page);

  await page.getByTestId("slip-reject").click();
  const reject = page.getByRole("alertdialog", { name: "ปฏิเสธสลิปนี้?" });
  await reject.getByTestId("slip-reject-reason").fill("สลิปนี้ใช้ชำระไปแล้ว");
  await reject.getByRole("button", { name: "ปฏิเสธ", exact: true }).click();
  await expect(page.getByTestId("slip-row")).toHaveCount(1);

  await gotoOwner(page, `/payments/slips?slip=${SLIP_REVIEW}`);
  await expect(page.locator('[data-reason="amount_below_due"]')).toBeVisible();
  await page.getByTestId("slip-approve").click();
  const approve = page.getByRole("alertdialog", { name: "อนุมัติสลิปนี้?" });
  await expect(approve.getByTestId("slip-amount")).toHaveValue("3000.00");
  await approve.getByRole("textbox", { name: /^พิมพ์/ }).fill("A-302");
  await approve.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await expect(approve.getByTestId("problem-notice")).toHaveAttribute("data-code", "payment.partial_not_allowed");
  await approve.getByTestId("slip-amount").fill("7182.00");
  await approve.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await expect(page.getByTestId("slip-row")).toHaveCount(0);
  const decisions = await received("owner.slipReviews.decide");
  expect(decisions.at(-1)?.body).toMatchObject({ action: "approve", amount: "7182.00" });
  expect(decisions.at(-1)?.idempotencyKey).toBeTruthy();
});

test("manual cash payment with a typed confirmation lands on the payment with its receipt", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/payments/new?invoice=${INVOICE_B101_PREV}`);
  await expect(page.getByTestId("manual-balance")).toContainText("฿5,512.00");
  await page.getByTestId("manual-amount").fill("5512.00");
  await expectAxeClean(page);
  await page.getByTestId("manual-record").click();
  const dialog = page.getByRole("alertdialog", { name: "บันทึกรับเงินนี้?" });
  await expect(dialog).toContainText("฿5,512.00");
  await dialog.getByRole("textbox", { name: /^พิมพ์/ }).fill("B-101");
  await dialog.getByRole("button", { name: "บันทึกรับเงิน" }).click();
  await expect(page.getByTestId("payment-detail")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("receipt-pdf")).toBeVisible();
  const records = await received("owner.payments.record");
  expect(records.at(-1)?.body).toMatchObject({ method: "cash", amount: "5512.00", invoiceId: INVOICE_B101_PREV });
  expect(records.at(-1)?.idempotencyKey).toBeTruthy();
});

test("credits: refund a payer's credit in cash", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/payments/credits");
  const row = page.getByTestId("credit-row").filter({ hasText: "B-101" });
  await expect(row.getByTestId("credit-balance")).toHaveText("฿250.00");
  await expectAxeClean(page);
  await row.getByTestId("credit-refund").click();
  const dialog = page.getByRole("alertdialog", { name: "คืนเงินเครดิต" });
  await dialog.getByRole("button", { name: /วันที่คืน/ }).click();
  await page
    .getByRole("dialog", { name: "เลือกวันที่" })
    .getByRole("gridcell")
    .getByRole("button", { name: "1", exact: true })
    .click();
  await dialog.getByRole("textbox", { name: /^พิมพ์/ }).fill("B-101");
  await dialog.getByRole("button", { name: "คืนเงิน" }).click();
  await expect(page.getByTestId("credit-row").filter({ hasText: "B-101" })).toHaveCount(0);
  expect((await received("owner.refunds.create")).at(-1)?.body).toMatchObject({ amount: "250.00", method: "cash" });
});

test("arrears: aging, filters, party ledger, reminder now, export", async ({ page }) => {
  // The earlier tests paid the overdue invoices; start this one from the seeded money world.
  await resetOwner("money");
  await signInOwner(page);
  await gotoOwner(page, "/arrears");
  await expect(page.getByTestId("arrears-total")).toBeVisible();
  await expect(page.getByTestId("arrears-row").first()).toBeVisible();
  await expect(page.getByTestId("arrears-policy")).toContainText("1, 3, 7");
  await expectAxeClean(page);

  await gotoOwner(page, "/arrears?minDays=1000");
  await expect(page.getByTestId("arrears-row")).toHaveCount(0);
  await gotoOwner(page, "/arrears?minDays=1&sort=days_overdue");
  await expect(page.getByTestId("arrears-row").first()).toBeVisible();

  await page.getByTestId("arrears-export").getByRole("button").click();
  await expect(page.getByTestId("export-download")).toBeVisible({ timeout: 15_000 });

  await gotoOwner(page, `/arrears/${PARTY_ANAN}`);
  await expect(page.getByTestId("ledger-row").first()).toBeVisible();
  const invoice = page.getByTestId("party-invoice").first();
  await invoice.getByTestId("arrears-remind").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ส่งแจ้งเตือน" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  expect((await received("owner.invoices.sendReminder")).at(-1)?.idempotencyKey).toBeTruthy();
  // Let the confirmation toast mount first, so axe measures it at rest rather than mid fade-in.
  await expect(page.getByText("ส่งแจ้งเตือนแล้ว")).toBeVisible();
  await expectAxeClean(page);
});

test("documents archive: a month's PDFs in the viewer and the zip export", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/documents");
  await expect(page.getByTestId("document-row").first()).toBeVisible();
  await expectAxeClean(page);
  await page.getByTestId("document-open").first().click();
  await expect(page.getByRole("dialog").locator("iframe")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("documents-zip").getByRole("button").click();
  await expect(page.getByTestId("export-download")).toBeVisible({ timeout: 15_000 });
  const exports = await received("owner.exports.create");
  expect(exports.at(-1)?.body).toMatchObject({ kind: "document_archive_zip" });
});
