import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * JW3a — the import wizard from a legacy system (api J3.1 at 0b426453, D-332): อาคาร B's draft opens on its four
 * wrong rows (a full ID number, shares over 100 % on both owners of a unit, a phone); the register is replaced and the bank balances added, the
 * job passes; the reconcile finds the operating account ฿2,000.00 off the statement and asks for a note with an
 * attachment; the commit asks for the bill-to consent; the parallel cycle compares a computed cycle with the legacy
 * bills, every difference is explained and the building goes live. A committed job is rolled back (and refused while
 * something refers to it). Written for the deferred e2e run (founder 2026-10-28) — not run in JW3a.
 */

test.describe.configure({ mode: "serial" });

const DRAFT_B = "1a9b0a01-0000-4000-8000-000000000002";
const reset = () => fetch(`${MOCK_API}/__mock/owner/reset?part=juristic`, { method: "POST" });
const control = (path: string) => fetch(`${MOCK_API}/__mock/owner/imports/${path}`, { method: "POST" });
const OWNER = "0810000010";
const COMMITTEE = "0810000011";
const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
const xlsx = (name: string) => ({
  name,
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer: Buffer.from("PK\u0003\u0004 mock workbook"),
});
const csv = (name: string, text: string) => ({ name, mimeType: "text/csv", buffer: Buffer.from(`﻿${text}`) });

async function signIn(page: Page, phone = OWNER) {
  await signInWithOtp(page, HOSTS.owner, phone);
  await hydrated(page);
}

async function typePhrase(dialog: ReturnType<Page["getByRole"]>) {
  const phrase = dialog.getByRole("textbox", { name: /^พิมพ์/ });
  await phrase.fill((await phrase.getAttribute("placeholder")) ?? "");
}

const current = (page: Page) => page.locator('[data-testid="step-track-step"][data-state="current"]');

test.beforeEach(reset);
test.afterAll(reset);

test("upload → validation errors → fix → reconcile with an attachment → commit → parallel cycle explained → go-live", async ({
  page,
}) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/import");
  await expect(page.getByTestId("import-job")).toHaveCount(4);
  await expectAxeClean(page);
  await page.getByTestId("import-job").filter({ hasText: "อาคาร B" }).click();
  await page.waitForURL(new RegExp(`/juristic/import/${DRAFT_B}`));
  await hydrated(page);

  // Step 2: three wrong rows, the next step closed with its reason, the bad rows downloadable.
  await expect(current(page)).toContainText("ตรวจสอบข้อมูล");
  await expect(page.getByTestId("import-next")).toBeDisabled();
  await expect(page.getByTestId("import-next-reason")).toContainText("แก้ 4 แถว");
  await expect(page.getByTestId("import-row")).toHaveCount(4); // B-303's two owners both carry the share error
  await expect(page.getByTestId("row-issues").first()).toContainText("PDPA");
  await expect(page.getByTestId("bad-rows-download")).toHaveAttribute("href", /bad-rows\?sheet=register/);
  await expectAxeClean(page);

  // Step 1 again: replace the register with the corrected workbook, add the bank balances (operating ฿2,000.00 off).
  await gotoOwner(page, `/juristic/import/${DRAFT_B}?step=upload`);
  await page.getByTestId("sheet-register").getByTestId("file-replace-input").setInputFiles(xlsx("register_fixed.xlsx"));
  await expect(page.getByTestId("sheet-register").getByTestId("file-chip-state")).toContainText("ไม่พบข้อผิดพลาด");
  await page
    .getByTestId("dropzone-bank_balance")
    .locator('input[type="file"]')
    .setInputFiles(
      csv("bank.csv", "account_type,bank_account_last4,fund_name,balance\r\noperating,4012,,2186330.15\r\n"),
    );
  await expect(page.getByTestId("sheet-bank_balance")).toHaveAttribute("data-state", "uploaded");

  // Step 3: reconcile — receivables match, the operating account does not; the note alone is refused.
  await gotoOwner(page, `/juristic/import/${DRAFT_B}`);
  await expect(current(page)).toContainText("กระทบยอด");
  await page.getByTestId("reconcile-declared").fill("612,450.00");
  await page.getByTestId("reconcile-submit").click();
  await expect(page.locator('[data-testid="reconcile-block"][data-kind="receivables"]')).toHaveAttribute(
    "data-status",
    "match",
  );
  await expect(page.locator('[data-testid="reconcile-block"][data-kind="bank"]')).toHaveAttribute(
    "data-status",
    "mismatch",
  );
  await expect(
    page.locator('[data-testid="reconcile-block"][data-kind="bank"]').getByTestId("reconcile-difference"),
  ).toHaveText("+฿2,000.00");
  await expect(page.getByTestId("import-next")).toBeDisabled();
  await page.getByTestId("reconcile-note").fill("เช็คเลขที่ 0092144 รอเคลียริ่ง ณ วันตัดยอด");
  await page.getByTestId("reconcile-submit").click();
  await expect(page.getByTestId("reconcile-error-summary")).toContainText("แนบหลักฐาน");
  await page.getByTestId("reconcile-attach-input").setInputFiles(pdf("statement_oct.pdf"));
  await expect(page.getByTestId("reconcile-attachment")).toContainText("statement_oct.pdf");
  await page.getByTestId("reconcile-submit").click();
  await expect(current(page)).toContainText("ยืนยันนำเข้า");
  const [reconcile] = (await received("owner.juristicImports.reconcile")).slice(-1);
  expect(reconcile?.body).toMatchObject({
    declaredReceivables: "612450.00",
    note: expect.any(String),
    documentId: expect.any(String),
  });

  // Step 4: commit — the bill-to consent is required, the building's name typed.
  await expect(page.getByTestId("commit-step")).toContainText("เงินต้นยกมา");
  await page.getByTestId("import-commit").click();
  const commit = page.getByRole("alertdialog");
  await expect(commit.getByTestId("commit-consent")).toBeVisible();
  await typePhrase(commit);
  await expect(commit.getByRole("button", { name: "ยืนยันนำเข้า" })).toBeDisabled();
  await commit.getByTestId("commit-consent-file").locator('input[type="file"]').setInputFiles(pdf("consents.pdf"));
  await commit.getByRole("button", { name: "ยืนยันนำเข้า" }).click();
  await expect(commit).toHaveCount(0);
  const [committed] = (await received("owner.juristicImports.commit")).slice(-1);
  expect(committed?.idempotencyKey).toBeTruthy();
  expect(committed?.body).toHaveProperty("billToConsentDocumentId");

  // Step 5: go-live waits for the parallel cycle.
  await expect(current(page)).toContainText("เริ่มใช้งานจริง");
  await expect(page.getByTestId("import-golive")).toBeDisabled();
  await expect(page.locator('[data-testid="golive-check"][data-key="parallel"]')).toHaveAttribute("data-state", "todo");
  await page.getByTestId("parallel-legacy").locator('input[type="file"]').setInputFiles(xlsx("legacy_bills.xlsx"));
  await page.getByTestId("parallel-compare").click();
  await expect(page.getByTestId("parallel-summary")).toBeVisible();
  await expect(page.locator('[data-testid="difference-row"][data-kind="unexplained"]')).toHaveCount(3);
  await expectAxeClean(page);
  for (let left = 3; left > 0; left -= 1) {
    await page
      .locator('[data-testid="difference-row"][data-kind="unexplained"]')
      .first()
      .getByTestId("difference-explain")
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("difference-explanation-input").fill("ระบบเดิมรวมค่าที่จอดรถคันที่สองไว้ในค่าส่วนกลาง");
    await dialog.getByTestId("form-submit").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-testid="difference-row"][data-kind="unexplained"]')).toHaveCount(left - 1);
  }
  await expect(page.getByTestId("import-golive")).toBeEnabled();
  await page.getByTestId("import-golive").click();
  const live = page.getByRole("alertdialog");
  await typePhrase(live);
  await live.getByRole("button", { name: "เริ่มใช้งานจริง" }).click();
  await expect(live).toHaveCount(0);
  await expect(page.getByTestId("golive-done")).toBeVisible();
  const [goLive] = (await received("owner.juristicImports.goLive")).slice(-1);
  expect(goLive?.body).toMatchObject({ notifyOpeningBalances: true, acknowledgeDifferences: false });
});

test("rollback of a committed import: refused while referenced, then removes what was created", async ({ page }) => {
  await control("advance?to=committed");
  await signIn(page);
  await gotoOwner(page, `/juristic/import/${DRAFT_B}`);
  await expect(page.getByTestId("import-pending")).toContainText("อาคาร B");

  await control("flag?blockRollback=1");
  await page.getByTestId("import-rollback").click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByTestId("rollback-reason").fill("ไฟล์ทะเบียนผิดชุด จะนำเข้าใหม่");
  await typePhrase(dialog);
  await dialog.getByRole("button", { name: "ย้อนกลับการนำเข้า" }).click();
  await expect(dialog.getByTestId("import-problem")).toHaveAttribute("data-code", "import.rollback_blocked");
  // J-CR: the problem's `table` names what still refers to the import.
  await expect(dialog.getByTestId("import-problem")).toHaveAttribute("data-blocker", "invoice");
  await expect(dialog.getByTestId("import-problem")).toContainText("ใบแจ้งหนี้ที่ออกแล้ว");

  await control("flag?blockRollback=0");
  await dialog.getByRole("button", { name: "ย้อนกลับการนำเข้า" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("rollback-reason-shown")).toContainText("ไฟล์ทะเบียนผิดชุด");
  // The building may start a new import again.
  await gotoOwner(page, "/juristic/import");
  await page.getByTestId("import-start").click();
  await expect(page.getByTestId("import-building").locator("option", { hasText: "อาคาร B" })).not.toHaveAttribute(
    "disabled",
    "",
  );
});

test("a stale plan sends the office back to the validation", async ({ page }) => {
  await control("advance?to=validated");
  await control("flag?stale=1");
  await signIn(page);
  await gotoOwner(page, `/juristic/import/${DRAFT_B}`);
  await page.getByTestId("reconcile-declared").fill("612450.00");
  await page.getByTestId("reconcile-submit").click();
  await expect(page.getByTestId("import-problem")).toHaveAttribute("data-code", "import.preview_stale");
  await page.getByTestId("import-problem").getByRole("link").click();
  await hydrated(page);
  await page.getByTestId("import-revalidate").first().click();
  await expect(current(page)).toContainText("กระทบยอด");
});

test("the committee reads the import but cannot run it", async ({ page }) => {
  await signIn(page, COMMITTEE);
  await gotoOwner(page, `/juristic/import/${DRAFT_B}`);
  await expect(page.getByTestId("import-panel")).toContainText("เฉพาะเจ้าของและผู้จัดการ");
  await expect(page.getByTestId("import-cancel")).toHaveCount(0);
  await gotoOwner(page, "/juristic/import");
  await expect(page.getByTestId("import-start")).toHaveCount(0);
  await expect(page.getByTestId("full-export")).toHaveCount(0);
});
