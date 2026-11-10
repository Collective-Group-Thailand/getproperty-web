import { expect, test, type Browser, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * JW2b — vendors, service contracts, quotation rounds and evaluations (api J2.2 at fb2a22ff, D-331, D-310): a new
 * vendor quotes in a round with two others, the award asks for approval and a second member approves it, the contract
 * draft is activated and the hourly job turns its first instalment into an expense request; a monthly evaluation with
 * the SLA breaches pulled read-only; a contract in the renewal queue renewed into a draft. Written for the deferred e2e
 * run (founder 2026-10-28) — not run in JW2b.
 */

test.describe.configure({ mode: "serial" });

const reset = () => fetch(`${MOCK_API}/__mock/owner/reset?part=juristic`, { method: "POST" });
const runJob = () => fetch(`${MOCK_API}/__mock/owner/vendors/job`, { method: "POST" });
const dialogOf = (page: Page) => page.getByRole("alertdialog").or(page.getByRole("dialog"));
const OWNER = "0810000010";
const COMMITTEE = "0810000011";
const pdf = { name: "quotation.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") };

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

/**
 * Picks a day with the console's date picker (its hidden input only carries the value — setting it directly is undone
 * by the next render): opens the picker of the field `name`, goes `monthsAhead` months forward, clicks the day.
 */
async function pickDate(page: Page, field: string, monthsAhead: number, day: string) {
  await dialogOf(page).locator(`input[type="hidden"][name="${field}"] + button`).click();
  const calendar = page.getByRole("dialog", { name: "เลือกวันที่" });
  for (let step = 0; step < monthsAhead; step += 1) await calendar.getByRole("button", { name: "เดือนถัดไป" }).click();
  await calendar.getByRole("gridcell").getByRole("button", { name: day, exact: true }).click();
  await expect(calendar).toHaveCount(0);
}

async function addQuotation(page: Page, vendor: string, amount: string) {
  const before = await page.getByTestId("quote-row").count();
  const dialog = dialogOf(page);
  const vendorField = dialog.getByRole("combobox", { name: "ผู้ให้บริการ" });
  // The round's panel carries the primary action (the quotations section repeats it under its list). The panel is
  // re-rendered by the refresh after the previous quotation, which can swallow a click made at that moment: retry it.
  await expect(async () => {
    if (!(await vendorField.isVisible()))
      await page.getByTestId("round-panel").getByTestId("round-add-quotation").click();
    await expect(vendorField).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await vendorField.fill(vendor);
  await page.getByRole("option", { name: new RegExp(vendor) }).click();
  await dialog.getByTestId("quote-amount-input").fill(amount);
  await pickDate(page, "validUntil", 2, "28");
  await dialog.getByTestId("quote-document").locator('input[type="file"]').setInputFiles(pdf);
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  // The page refreshes from the API: wait for the new row before the next action.
  await expect(page.getByTestId("quote-row")).toHaveCount(before + 1);
}

test.beforeEach(reset);
test.afterAll(reset);

test("a vendor wins a round by approval, its contract is activated and the first instalment becomes an expense", async ({
  page,
  browser,
}) => {
  await signIn(page);

  // A new vendor, its tax id checked digit by digit, the bank by its last four only.
  await gotoOwner(page, "/juristic/vendors/new");
  await page.getByTestId("vendor-name").fill("บริษัท สระสวย พูลแคร์ จำกัด");
  await page.getByTestId("vendor-tax-id").fill("0105563012345");
  await page.getByTestId("vendor-tax-id").blur();
  // The field's own message (the error summary repeats it as a link to the field).
  await expect(page.getByTestId("vendor-tax-id")).toHaveAccessibleDescription(/เลขหลักสุดท้ายไม่ตรง/);
  await page.getByTestId("vendor-tax-id").fill("0105563012343");
  await page.getByTestId("vendor-category-pool").click();
  await page.getByTestId("vendor-last4").fill("5521");
  await page.getByTestId("vendor-save").click();
  await expect(page.getByTestId("vendor-tax-id")).toContainText("2343");
  await expect(page.getByTestId("vendor-bank")).toContainText("····5521");

  // A round with three quotations: the rule line is met, the comparison is cheapest first.
  await gotoOwner(page, "/juristic/quotations");
  await page.getByTestId("round-new").click();
  await dialogOf(page).getByTestId("round-title").fill("ดูแลสระว่ายน้ำรายเดือน 2570");
  await dialogOf(page).getByTestId("round-category").selectOption("pool");
  await dialogOf(page).getByTestId("round-estimate").fill("120000");
  await dialogOf(page).getByTestId("form-submit").click();
  await expect(page.getByTestId("quote-rule")).toHaveAttribute("data-state", "empty");
  await addQuotation(page, "สระสวย", "96300");
  await expect(page.getByTestId("quote-rule")).toHaveAttribute("data-state", "short");
  await addQuotation(page, "คลีนพลัส", "112350");
  await addQuotation(page, "ไทยปั๊ม", "101650");
  await expect(page.getByTestId("quote-rule")).toHaveAttribute("data-state", "met");
  await expect(page.getByTestId("quote-row").first()).toHaveAttribute("data-vendor", /สระสวย/);

  // Award by approval: no reason field with three quotations; the owner asked, so the owner cannot approve.
  await page.getByTestId("round-award").click();
  await expect(page.getByTestId("award-reason")).toHaveCount(0);
  await pickDate(page, "startsOn", 1, "1");
  await pickDate(page, "endsOn", 13, "28");
  await dialogOf(page).getByTestId("form-submit").click();
  await expect(page.getByTestId("round-approve-block")).toHaveAttribute("data-block", "requester");

  const committee = await asCommittee(browser);
  await gotoOwner(committee.page, "/juristic/quotations");
  await committee.page.getByTestId("round-row").filter({ hasText: "ดูแลสระว่ายน้ำ" }).click();
  await committee.page.getByTestId("round-approve").click();
  await dialogOf(committee.page).getByRole("button", { name: "อนุมัติการให้งาน" }).click();
  await expect(committee.page.getByTestId("round-approval-progress")).toContainText("1 จาก 2");
  await committee.close();
  const approvals = await received("owner.juristicQuotations.approve");
  expect(approvals.at(-1)?.idempotencyKey).toBeTruthy();
});

test("a round short of three quotations asks for a reason before the award", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/quotations?tab=open");
  await page.getByTestId("round-row").filter({ hasText: "บำรุงรักษาลิฟต์" }).click();
  await expect(page.getByTestId("quote-rule")).toHaveAttribute("data-state", "short");
  await page.getByTestId("round-award").click();
  await expect(page.getByTestId("award-reason")).toBeVisible();
  // The dates first: the dialog checks its fields in order and names one at a time.
  await pickDate(page, "startsOn", 1, "1");
  await pickDate(page, "endsOn", 13, "28");
  await page.getByTestId("award-reason").fill("สั้น");
  await dialogOf(page).getByTestId("form-submit").click();
  await expect(dialogOf(page).locator('[id$="-error"]', { hasText: "เหตุผลอย่างน้อย 10 ตัวอักษร" })).toBeVisible();
  await page.getByTestId("award-reason").fill("มีผู้ให้บริการลิฟต์ยี่ห้อนี้ในพื้นที่เพียง 2 ราย");
  await dialogOf(page).getByTestId("form-submit").click();
  await expect(page.getByTestId("round-fewer-reason")).toContainText("เพียง 2 ราย");
});

test("an awarded contract draft is activated and the job requests its first instalment", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/contracts?tab=draft");
  await page.getByTestId("contract-row").filter({ hasText: "บำรุงรักษาปั๊มน้ำรายไตรมาส" }).click();
  await page.waitForURL(/\/juristic\/contracts\/[0-9a-f-]{36}/);
  await hydrated(page);
  await page.getByTestId("contract-activate").click();
  await dialogOf(page).getByRole("button", { name: "เปิดใช้สัญญา" }).click();
  await expect(page.getByTestId("contract-instalment").first()).toHaveAttribute("data-state", "scheduled");
  expect((await received("owner.juristicVendorContracts.activate")).at(-1)?.idempotencyKey).toBeTruthy();
  await runJob();
  await page.reload();
  await expect(page.getByTestId("contract-instalment").first()).toHaveAttribute("data-state", "requested");
  await page.getByTestId("instalment-request").first().click();
  await expect(page.getByTestId("expense-contract-link")).toBeVisible();
  await expect(page.getByTestId("approve-block")).toHaveAttribute("data-block", "requester"); // maker ≠ checker
  await expectAxeClean(page);
});

test("a monthly evaluation pulls the month's SLA breaches read-only and joins the trend", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/contracts?tab=renewal");
  await page.getByTestId("contract-row").filter({ hasText: "ลิฟต์" }).click();
  await expect(page.getByTestId("evaluation-direction")).toContainText("แย่ลง");
  await page.getByTestId("contract-evaluate").first().click();
  await expect(page.getByTestId("evaluation-breach")).toHaveCount(2);
  for (const criterion of ["quality", "timeliness", "communication", "safety"])
    await page.getByTestId(`score-${criterion}-3`).check({ force: true });
  await page.getByTestId("evaluation-note").fill("ตอบรับเหตุลิฟต์ค้างช้า ขอแผนแก้ไขภายในเดือนหน้า");
  await page.getByTestId("evaluation-save").click();
  await expect(page.getByTestId("contract-evaluation")).toHaveCount(7);
  const evaluate = await received("owner.juristicVendorContracts.evaluate");
  expect(evaluate.at(-1)?.idempotencyKey).toBeTruthy();
});

test("a contract in the renewal queue is renewed into a draft", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/contracts");
  await expect(page.getByTestId("contracts-tab-renewal")).toHaveAttribute("aria-current", "page");
  const fire = page.getByTestId("contract-row").filter({ hasText: "ระบบแจ้งเหตุเพลิงไหม้" });
  await expect(fire).toHaveAttribute("data-badge", /ending|notice/);
  const renewals = (await received("owner.juristicVendorContracts.renew")).length;
  await fire.click();
  await page.waitForURL(/\/juristic\/contracts\/[0-9a-f-]{36}/);
  await hydrated(page);
  await page.getByTestId("contract-renew").click();
  await pickDate(page, "endsOn", 13, "28");
  await dialogOf(page).getByTestId("renew-value").fill("66000");
  await dialogOf(page).getByTestId("form-submit").click();
  await expect(page.getByTestId("juristic-contract")).toContainText("ร่างสัญญา");
  await expect(page.getByTestId("contract-activate")).toBeVisible();
  expect(await received("owner.juristicVendorContracts.renew")).toHaveLength(renewals + 1);
});
