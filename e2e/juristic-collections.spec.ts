import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * JW1b — money collection of the juristic office (api J1.2a + J1.2b): receivables with the bulk bar, a case's
 * dispute, the ladder editor and its counsel lock, paying a statement, a plan approved by the committee, debt
 * clearance issue / refuse with the public verify page, and the D-270 invitation from a landlord to the office.
 * Written for the deferred e2e run (founder 2026-10-28) — not run in JW1b.
 */

test.describe.configure({ mode: "serial" });

const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const reset = () => fetch(`${MOCK_API}/__mock/owner/reset?part=juristic`, { method: "POST" });
const dialogOf = (page: Page) => page.getByRole("alertdialog").or(page.getByRole("dialog"));

async function signIn(page: Page, phone = "0810000010") {
  await signInWithOtp(page, HOSTS.owner, phone);
  await hydrated(page);
}

test.beforeEach(reset);
test.afterAll(reset);

test("receivables: tabs with counts, then a bulk reminder skips owners without LINE", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/receivables");
  await expect(page.getByTestId("receivables-tab-dispute")).toContainText("1");
  await expect(page.getByTestId("receivables-outstanding")).toContainText("฿");
  await expectAxeClean(page);

  const rows = page.getByTestId("receivable-row");
  await rows.filter({ hasText: "A-101" }).getByTestId("receivable-select").click();
  await rows.filter({ hasText: "A-201" }).getByTestId("receivable-select").click(); // letter only
  await expect(page.getByTestId("receivables-bulk")).toContainText("2");

  await page.getByTestId("bulk-remind").click();
  await dialogOf(page).getByRole("button", { name: "ส่งเตือน" }).click();
  await expect(page.getByTestId("bulk-outcome")).toContainText("A-201");
  const sent = await received("owner.invoices.sendReminder");
  expect(sent).toHaveLength(1);
  expect(sent[0]?.idempotencyKey).toBeTruthy();
});

test("a case is paused with a dispute and resumed when it is closed", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, `/juristic/receivables/${id("ca5e0a01", 1)}`);
  await expect(page.getByTestId("case-next-step")).toBeVisible();
  await page.getByTestId("case-open-dispute").first().click();
  await dialogOf(page).getByTestId("case-dispute-reason").fill("เจ้าของแจ้งว่าชำระบิลเดือน ส.ค. แล้ว");
  await dialogOf(page).getByRole("button", { name: "เปิดข้อโต้แย้ง" }).click();
  await expect(page.getByTestId("case-timeline")).toContainText("เปิดข้อโต้แย้ง");

  await page.getByTestId("case-close-dispute").first().click();
  await dialogOf(page).getByTestId("case-dispute-outcome").fill("ตรวจแล้วยังไม่ได้ชำระ แจ้งเจ้าของแล้ว");
  await dialogOf(page).getByRole("button", { name: "ปิดข้อโต้แย้ง" }).click();
  await expect(page.getByTestId("case-timeline")).toContainText("ปิดข้อโต้แย้ง");
  expect(await received("owner.juristicCollectionCases.openDispute")).toHaveLength(1);
});

test("ladder: an offset is edited between its neighbours; a legal step stays locked", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/collections/settings");
  const steps = page.getByTestId("ladder-step");
  const second = steps.nth(1);
  await second.getByTestId("ladder-edit").click();
  await second.getByTestId("ladder-offset-input").fill("40");
  await second.getByTestId("ladder-offset-input").blur();
  await expect(second.getByTestId("ladder-editor")).toContainText("ต้องอยู่หลังขั้นก่อนหน้า");
  await second.getByTestId("ladder-offset-input").fill("20");
  await second.getByTestId("ladder-save").click();
  await expect(second.getByTestId("ladder-offset")).toContainText("+20");

  const notice = page.locator('[data-testid="ladder-step"][data-action="notice_letter"]');
  await expect(notice.getByTestId("ladder-legal-lock")).toContainText("ต้องให้ทนายยืนยันก่อนเปิดใช้");
  await notice.getByTestId("ladder-edit").click();
  await expect(notice.getByTestId("ladder-enabled")).toBeDisabled();
  await expectAxeClean(page);
});

test("a statement is paid once with evidence and a note; the API books one payment per unit", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, `/juristic/statements/${id("57a70a01", 44)}`);
  await expect(page.getByTestId("statement-unit")).toHaveCount(3);
  await page.getByTestId("statement-pay").first().click();
  const sheet = dialogOf(page);
  await sheet.getByTestId("statement-pay-note").fill("abc");
  await sheet.getByTestId("form-submit").click();
  await expect(sheet).toContainText("อย่างน้อย 5 ตัวอักษร");
  await sheet.getByTestId("statement-pay-note").fill("โอนจาก KBank เลขอ้างอิง 0042");
  await sheet.locator('input[type="file"]').setInputFiles({
    name: "slip.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await sheet.getByTestId("form-submit").click();
  await expect(page.getByText("แยกเป็นการชำระ")).toBeVisible();
  const [pay] = await received("owner.juristicStatements.pay");
  expect(pay?.body).toMatchObject({ notes: "โอนจาก KBank เลขอ้างอิง 0042" });
});

test("the committee approves a plan a resident asked for", async ({ page }) => {
  await signIn(page, "0810000011");
  await gotoOwner(page, `/juristic/plans/${id("91a40a01", 3)}`);
  await page.getByTestId("plan-approve").first().click();
  await dialogOf(page).getByRole("textbox").fill("A-203");
  await dialogOf(page).getByRole("button", { name: "อนุมัติแผน" }).click();
  await expect(page.getByText("กำลังผ่อน").first()).toBeVisible();
  const [approve] = await received("owner.juristicPaymentPlans.approve");
  expect(approve?.idempotencyKey).toBeTruthy();
});

test("debt clearance: refused while something is owed, issued when clear, then verified publicly", async ({ page }) => {
  await signIn(page);
  // A-101 still owes: the API refuses with the amount, shown in the dialog.
  await gotoOwner(page, `/juristic/debt-clearance/${id("dc1a0a01", 1)}`);
  await page.getByTestId("clearance-issue").first().click();
  await dialogOf(page).getByRole("textbox").fill("A-101");
  await dialogOf(page).getByRole("button", { name: "ออกหนังสือ" }).click();
  await expect(page.getByTestId("clearance-outstanding")).toContainText("฿54,600.00");
  await page.keyboard.press("Escape");

  // A-401 owes nothing: issued, the code is shown once.
  await gotoOwner(page, `/juristic/debt-clearance/${id("dc1a0a01", 2)}`);
  await page.getByTestId("clearance-issue").first().click();
  await dialogOf(page).getByRole("textbox").fill("A-401");
  await dialogOf(page).getByRole("button", { name: "ออกหนังสือ" }).click();
  const code = (await page.getByTestId("clearance-code-value").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z0-9]{8}$/);
  await page.getByTestId("clearance-code-done").click();

  await page.goto(`${HOSTS.owner}/verify/${code}`);
  await expect(page.getByTestId("verify-document")).toHaveAttribute("data-status", "valid");
  await expect(page.getByTestId("verify-holder")).not.toContainText("วรรณี");
  await expectAxeClean(page);
  await page.goto(`${HOSTS.owner}/verify/NOPE0000`);
  await expect(page.getByTestId("verify-not-found")).toBeVisible();
});

test("debt clearance: a request is refused with a reason", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, `/juristic/debt-clearance/${id("dc1a0a01", 2)}`);
  await page.getByTestId("clearance-refuse").first().click();
  await dialogOf(page).getByTestId("clearance-refuse-reason").fill("ยังไม่ได้ชำระค่าธรรมเนียม");
  await dialogOf(page).getByRole("button", { name: "ปฏิเสธคำขอ" }).click();
  await expect(page.getByText("ปฏิเสธแล้ว").first()).toBeVisible();
});

test("D-270: a landlord invites the condo's office; the office accepts with an SMS code", async ({ page, browser }) => {
  await signIn(page, "0810000006");
  await gotoOwner(page, "/juristic-office");
  await page.getByTestId("office-invite").click();
  await dialogOf(page).getByTestId("office-name").fill("นิติบุคคลอาคารชุด ไอดีโอ โมบิ อารีย์");
  await dialogOf(page).getByTestId("form-submit").click();
  const code = (await page.getByTestId("office-code-value").textContent())?.trim() ?? "";
  expect(code).toHaveLength(10);

  const office = await (await browser.newContext()).newPage();
  await office.goto(`${HOSTS.owner}/juristic/join/${code}`);
  await office.getByTestId("join-name").fill("นิติบุคคลอาคารชุด ไอดีโอ โมบิ อารีย์");
  await office.getByLabel(/เบอร์มือถือ/).fill("0899999999");
  await office.getByTestId("join-send").click();
  await office.getByRole("textbox", { name: /หลักที่ 1/ }).fill("123456");
  await office.waitForURL(/\/juristic\/workspace/);
  await expect(office.getByTestId("workspace-units")).toContainText("12/345");
});
