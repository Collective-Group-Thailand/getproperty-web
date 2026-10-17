import { expect, test } from "@playwright/test";

import { expectAxeClean } from "./support/staff";
import { gotoOwner, received, resetOwner, signInOwner } from "./support/owner";

/**
 * F2 2.3 on the mock API: the billing-cycle workspace (state stepper, meters still to read, the drafts
 * with their flags, lines with reading sources and photos, a one-off charge and a refused renewal fee,
 * "Issue all" with the typed period, the tariff-cap acknowledgement and an Idempotency-Key, drafts the
 * API skipped) and invoices (list filters, detail with disclosure and totals, reminder, credit note,
 * PDF viewer, void with a replacement draft) — with axe on each screen.
 */
test.describe.configure({ mode: "serial" });

const INVOICE_A302_PREV = "1e700000-0000-4000-8000-000000000102";
const INVOICE_B101_PREV = "1e700000-0000-4000-8000-000000000103";

test.beforeAll(async () => {
  await resetOwner();
});

test("billing workspace: stepper, readings pending, drafts with flags, lines with sources and photos", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, "/billing");
  const workspace = page.getByTestId("cycle-workspace");
  await expect(workspace).toHaveAttribute("data-status", "readings_pending");
  await expect(page.getByTestId("stepper-progress")).toContainText("2");
  await expect(page.getByTestId("readings-pending").getByTestId("pending-row").first()).toBeVisible();
  const rows = page.getByTestId("draft-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: "A-201" }).locator('[data-flag="acknowledgement_required"]')).toBeVisible();
  await expect(rows.filter({ hasText: "A-201" }).locator('[data-flag="above_cap"]')).toBeVisible();
  await expect(rows.filter({ hasText: "B-101" }).locator('[data-flag="missing_reading"]')).toBeVisible();
  await expect(rows.filter({ hasText: "A-302" }).locator('[data-flag="estimated"]')).toBeVisible();
  await expectAxeClean(page);

  await rows.filter({ hasText: "A-201" }).getByTestId("draft-expand").click();
  const lines = page.getByTestId("draft-lines");
  await expect(lines.getByTestId("flag-above-cap")).toBeVisible();
  await expect(lines.getByTestId("meter-segment").first()).toContainText("E-A-201");
  await expect(lines.getByTestId("photo-thumb").first()).toBeVisible();
  await expect(lines.getByTestId("line-cap").first()).toBeVisible();
  await expectAxeClean(page);
});

test("one-off charge on a draft; a renewal fee is refused with its legal reference", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/billing");
  const row = page.getByTestId("draft-row").filter({ hasText: "A-302" });

  await row.getByTestId("add-charge").click();
  let dialog = page.getByRole("dialog", { name: /ห้อง A-302/ });
  await dialog.getByTestId("charge-description").fill("ค่าต่อสัญญา");
  await dialog.getByTestId("charge-price").fill("500.00");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog.getByTestId("problem-notice")).toHaveAttribute("data-code", "compliance.no_renewal_fee");
  await expect(dialog.getByTestId("problem-notice")).toContainText("ข้อ 4");
  await page.keyboard.press("Escape");

  await row.getByTestId("add-charge").click();
  dialog = page.getByRole("dialog", { name: /ห้อง A-302/ });
  await dialog.getByTestId("charge-description").fill("ค่าซ่อมก๊อกน้ำ");
  await dialog.getByTestId("charge-price").fill("250.00");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toBeHidden();
  const charges = await received("owner.invoiceCharges.create");
  expect(charges.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await row.getByTestId("draft-expand").click();
  await expect(page.getByTestId("draft-lines")).toContainText("ค่าซ่อมก๊อกน้ำ");
});

test("issue all: typed period, tariff-cap acknowledgement, Idempotency-Key, skipped drafts listed", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, "/billing");
  await page.getByTestId("cycle-issue").click();
  const dialog = page.getByRole("alertdialog", { name: "ออกบิลประจำเดือน?" });
  await expect(dialog).toContainText("ร่างบิล 3 ใบ");
  const confirm = dialog.getByRole("button", { name: /^ออกบิล 3 ใบ/ });
  await expect(confirm).toBeDisabled();
  const phraseInput = dialog.getByRole("textbox", { name: /^พิมพ์/ });
  await phraseInput.fill((await phraseInput.getAttribute("placeholder")) ?? "");
  await confirm.click();
  const warning = dialog.getByTestId("problem-notice");
  await expect(warning).toHaveAttribute("data-code", "compliance.acknowledgement_required");
  await expect(warning).toContainText("ข้อ 4 (6)");
  await warning.getByRole("button", { name: "รับทราบและดำเนินการต่อ" }).click();
  await expect(page.getByTestId("issue-skipped")).toContainText("B-101");
  await expect(page.getByTestId("issue-skipped")).toContainText("ไม่มีเลขมิเตอร์");
  const issues = await received("owner.billingCycles.issue");
  expect(issues.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(issues.at(-1)?.body.acknowledgementIds).toHaveLength(1);
  await expect(page.getByTestId("draft-row")).toHaveCount(1);
  await expect(page.getByTestId("cycle-issued")).toBeVisible();
  await expectAxeClean(page);
});

test("invoices: list filters, detail with disclosure, reminder, credit note, PDF viewer", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/invoices?status=overdue");
  await expect(page.getByTestId("invoice-row")).toHaveCount(1);
  await expect(page.getByTestId("invoice-row")).toHaveAttribute("data-status", "overdue");
  await expectAxeClean(page);

  await gotoOwner(page, `/invoices/${INVOICE_A302_PREV}`);
  await expect(page.getByTestId("invoice-title")).toHaveText("INV-2569-000102");
  await expect(page.getByTestId("promptpay-ref")).toHaveText("INV2569000102");
  await expect(
    page.getByTestId("invoice-line").filter({ hasText: "ค่าน้ำประปา" }).getByTestId("flag-estimated"),
  ).toBeVisible();
  await expect(page.getByTestId("reminder-row")).toHaveCount(3);
  await expectAxeClean(page);

  await page.getByTestId("invoice-remind").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ส่งแจ้งเตือน" }).click();
  await expect(page.getByTestId("reminder-row")).toHaveCount(4);

  await page.getByTestId("credit-note").click();
  const note = page.getByRole("dialog", { name: /ใบลดหนี้ของ/ });
  await note.getByTestId("note-reason").selectOption("reading_correction");
  await note.getByTestId("note-reason-text").fill("แก้เลขมิเตอร์น้ำ");
  await note.getByTestId("note-ref").selectOption({ index: 3 });
  await expect(note.getByTestId("note-description")).toHaveValue("ค่าน้ำประปา");
  await note.getByTestId("note-amount").fill("50.00");
  await note.getByTestId("form-submit").click();
  await expect(page.getByTestId("note-row")).toHaveCount(1);
  expect((await received("owner.invoices.creditNote")).at(-1)?.idempotencyKey).toBeTruthy();

  await page.getByTestId("invoice-pdf").click();
  await expect(page.getByRole("dialog").locator("iframe")).toBeVisible();
});

test("void an unpaid invoice with a corrected replacement draft", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/invoices/${INVOICE_B101_PREV}`);
  await page.getByTestId("invoice-void").click();
  const dialog = page.getByRole("alertdialog", { name: "ยกเลิกบิลนี้" });
  await dialog.getByTestId("void-reason").fill("คิดค่าน้ำผิด");
  await dialog.getByRole("checkbox").click();
  const confirm = dialog.getByRole("button", { name: "ยกเลิกบิล" });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("textbox", { name: /^พิมพ์/ }).fill("INV-2569-000103");
  await confirm.click();
  await expect(page.getByTestId("replacement-link")).toBeVisible({ timeout: 15_000 });
  expect((await received("owner.invoices.void")).at(-1)?.body).toMatchObject({ reason: "คิดค่าน้ำผิด", reissue: true });
  await expectAxeClean(page);
});
