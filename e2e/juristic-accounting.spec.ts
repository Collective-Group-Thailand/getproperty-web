import { expect, test, type Browser, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * JW2a — the juristic light GL (api J2.1 at c0a216c2, D-329): an expense request approved by a second member, paid and
 * given its 50 ทวิ; a manual journal that must balance, then reversed; a bank statement imported and matched; a fund
 * transfer approved by another member. Written for the deferred e2e run (founder 2026-10-28) — not run in JW2a.
 */

test.describe.configure({ mode: "serial" });

const reset = () => fetch(`${MOCK_API}/__mock/owner/reset?part=juristic`, { method: "POST" });
const dialogOf = (page: Page) => page.getByRole("alertdialog").or(page.getByRole("dialog"));
const OWNER = "0810000010";
const COMMITTEE = "0810000011";
const slip = { name: "slip.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") };

async function signIn(page: Page, phone = OWNER) {
  await signInWithOtp(page, HOSTS.owner, phone);
  await hydrated(page);
}

async function asCommittee(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, COMMITTEE);
  return { page, close: () => context.close() };
}

test.beforeEach(reset);
test.afterAll(reset);

test("an expense request is approved by a second member, paid, and gets its 50 ทวิ", async ({ page, browser }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/expenses/new");
  await page.getByTestId("expense-title").fill("ซ่อมประตูห้องเครื่อง");
  await page.getByRole("combobox", { name: "ผู้รับเงิน" }).fill("ไทยปั๊ม");
  await page.getByRole("option", { name: /ไทยปั๊ม/ }).click();
  const line = page.getByTestId("expense-line-input").first();
  await line.getByTestId("expense-line-account").selectOption({ label: "5130 · ค่าซ่อมแซมและบำรุงรักษา" });
  await line.getByTestId("expense-line-description").fill("เปลี่ยนบานพับและโช้คประตู");
  await line.getByTestId("expense-line-amount").fill("5350");
  await line.getByTestId("expense-line-vat").fill("350");
  await line.getByTestId("expense-line-wht").selectOption("service");
  await expect(page.getByTestId("expense-wht-unverified")).toBeVisible();
  await page.getByTestId("expense-save").click();

  await expect(page.getByTestId("expense-paper")).toBeVisible();
  await expect(page.getByTestId("expense-net")).toContainText("5,200.00"); // 5,350 − 3 % of 5,000
  await page.getByTestId("expense-submit").click();
  await dialogOf(page).getByRole("button", { name: "ส่งขออนุมัติ" }).click();
  await expect(page.getByTestId("approve-block")).toHaveAttribute("data-block", "requester");
  const url = page.url();

  const committee = await asCommittee(browser);
  await gotoOwner(committee.page, "/juristic/expenses");
  await committee.page.getByTestId("expense-row").filter({ hasText: "ซ่อมประตูห้องเครื่อง" }).click();
  await committee.page.getByTestId("expense-approve").click();
  await dialogOf(committee.page).getByRole("button", { name: "อนุมัติ" }).click();
  await expect(committee.page.getByTestId("approval-progress")).toContainText("1 จาก 1");
  await expect(committee.page.getByTestId("expense-pay")).toHaveCount(0); // the committee never pays (D-320)
  await committee.close();

  await page.goto(url);
  await page.getByTestId("expense-pay").click();
  await page.getByTestId("expense-pay-reference").fill("KB20261106001");
  await page.getByTestId("expense-pay-evidence").locator('input[type="file"]').setInputFiles(slip);
  await dialogOf(page).getByTestId("form-submit").click();
  await expect(page.getByTestId("expense-certificate")).toBeVisible();
  const pay = await received("owner.juristicExpenses.pay");
  expect(pay.at(-1)?.idempotencyKey).toBeTruthy();
  await page.getByTestId("expense-certificate").click();
  await expect(page.getByTestId("certificate-tax")).toContainText("150.00");
  await expectAxeClean(page);
});

test("a manual journal saves only when balanced, then is reversed with a reason", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/accounting/journals/new");
  const lines = page.getByTestId("journal-line-input");
  await lines.nth(0).getByRole("combobox").fill("2120");
  await page.getByRole("option", { name: /2120/ }).click();
  await lines.nth(0).getByTestId("journal-line-debit").fill("1755");
  await lines.nth(1).getByRole("combobox").fill("1130");
  await page.getByRole("option", { name: /1130/ }).click();
  await lines.nth(1).getByTestId("journal-line-credit").fill("1700");
  await expect(page.getByTestId("journal-balance-state")).toHaveAttribute("data-state", "unbalanced");
  await expect(page.getByTestId("journal-save")).toBeDisabled();
  await lines.nth(1).getByTestId("journal-line-credit").fill("1755");
  await expect(page.getByTestId("journal-balance-state")).toHaveAttribute("data-state", "balanced");
  await page.getByTestId("journal-memo").fill("นำส่งภาษีหัก ณ ที่จ่าย ภ.ง.ด.53");
  await page.getByTestId("journal-save").click();

  await expect(page.getByTestId("journal-paper")).toBeVisible();
  await page.getByTestId("journal-reverse").click();
  await dialogOf(page).getByTestId("journal-reverse-reason").fill("บันทึกยอดผิดเดือน");
  await dialogOf(page).getByRole("button", { name: "กลับรายการ" }).click();
  await expect(page.getByTestId("journal-source")).toBeVisible(); // the reversal links back to the original
  expect(await received("owner.juristicJournals.reverse")).toHaveLength(1);
});

test("a bank statement is imported and its open line matched from the queue", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/bank-statements");
  await page.getByTestId("statement-import").click();
  await dialogOf(page).getByTestId("statement-import-format").selectOption("scb");
  await dialogOf(page)
    .getByTestId("statement-import-file")
    .locator('input[type="file"]')
    .setInputFiles({
      name: "scb.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "date,description,amount,reference\n2026-10-03,โอนเข้า A-101,1120.00,QR1\n2026-10-04,โอนเข้า A-102,1465.50,\n",
      ),
    });
  await dialogOf(page).getByTestId("form-submit").click();
  await expect(page.getByTestId("queue-progress")).toBeVisible();
  await expect(page.getByTestId("queue-line").first()).toBeVisible();
  await page.getByTestId("queue-candidate").first().getByTestId("line-match").click();
  await dialogOf(page).getByRole("button", { name: "จับคู่" }).click();
  await expect(page.getByTestId("queue-progress")).toContainText("2 จาก 2");
  expect(await received("owner.juristicBankStatementLines.match")).toHaveLength(1);
});

test("a fund transfer out waits for another member, who approves and posts it", async ({ page, browser }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/funds");
  const waiting = page.getByTestId("fund-transfers-waiting");
  await waiting.getByTestId("fund-transfer-row").first().click();
  await expect(page.getByTestId("fund-transfer-approve")).toHaveCount(0); // the requester cannot approve
  const url = page.url();

  const committee = await asCommittee(browser);
  await committee.page.goto(url);
  await committee.page.getByTestId("fund-transfer-approve").click();
  await dialogOf(committee.page).getByRole("button", { name: "อนุมัติการโอน" }).click();
  await expect(committee.page.getByTestId("fund-transfer-panel")).toContainText("ลงบัญชีแล้ว");
  await committee.close();
  expect(await received("owner.juristicFundTransfers.approve")).toHaveLength(1);
});
