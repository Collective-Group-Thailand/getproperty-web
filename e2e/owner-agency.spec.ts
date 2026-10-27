import { expect, test } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { typePhrase } from "./support/admin";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * GW2 — the agency workspace (api G2; D-284, D-293, ADR-0008): an agency answers a landlord's mandate and sees only
 * its mandated units; the landlord invites an agency (exclusive conflicts refused) and revokes with the unit number
 * typed; co-broke proposed and signed; closed deals with the commission recorded outside the platform; agency sign-up.
 */

test.describe.configure({ mode: "serial" });

const AGENCY_PHONE = "0810000008";
const LANDLORD_PHONE = "0810000006";
const row = (page: import("@playwright/test").Page, unitNo: string) =>
  page.locator(`[data-testid="mandate-row"][data-unit-no="${unitNo}"]`);

test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/owner/reset?part=agency`, { method: "POST" });
});
test.afterAll(async () => {
  await fetch(`${MOCK_API}/__mock/owner/reset?part=agency`, { method: "POST" });
});

test("an agency starts at its mandated units and accepts a landlord's invitation", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, AGENCY_PHONE);
  await expect(page).toHaveURL(`${HOSTS.owner}/mandated-units`);
  await hydrated(page);
  await expect(page.getByTestId("mandated-unit")).toHaveCount(1);
  await expect(page.locator('[data-testid="mandated-unit"][data-unit-no="21/88"]')).toContainText("เอกสิทธิ์");
  await expectAxeClean(page);

  await gotoOwner(page, "/mandates");
  const invited = row(page, "8/101");
  await expect(invited).toHaveAttribute("data-state", "invited");
  await expect(page.getByText("ค่านายหน้าจ่ายกันโดยตรงระหว่างคู่สัญญา")).toBeVisible();
  await expectAxeClean(page);
  await invited.getByTestId("mandate-accept").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("ลงประกาศและทำสัญญาเช่า");
  await expect(dialog).toContainText("มาลี มีสุข");
  await dialog.getByRole("button", { name: "ตอบรับ" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await received("owner.mandates.accept")).at(-1)?.idempotencyKey).toBeTruthy();

  await gotoOwner(page, "/mandated-units");
  await expect(page.getByTestId("mandated-unit")).toHaveCount(2);
  await expect(page.locator('[data-testid="mandated-unit"][data-unit-no="8/101"]')).toContainText("มาลี มีสุข");
});

test("a landlord invites an agency (exclusive conflict refused) and revokes with the unit typed", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, LANDLORD_PHONE);
  await hydrated(page);
  await page
    .locator('[data-testid="portfolio-unit"][data-unit-no="8/101"]')
    .getByTestId("portfolio-invite-agency")
    .click();
  await hydrated(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("mandate-unit")).toHaveValue("7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c02");
  await dialog.getByTestId("mandate-agency-search").fill("บ้านดี");
  await expect(dialog.getByTestId("mandate-agency").locator("option", { hasText: "บ้านดี" })).toHaveCount(1);
  await dialog.getByTestId("mandate-agency").selectOption({ label: "บ้านดี พร็อพเพอร์ตี้" });
  await dialog.getByRole("switch").click();
  await dialog.getByTestId("form-submit").click();
  // 8/101 already has an agency on it: an exclusive mandate is refused by the API, explained in the dialog.
  await expect(dialog.getByTestId("problem-notice")).toHaveAttribute("data-code", "mandate.exclusive_conflict");
  await dialog.getByRole("switch").click();
  await dialog.getByTestId("mandate-unit").selectOption("7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c03");
  await dialog.getByTestId("mandate-percent").fill("50");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  const invite = (await received("owner.mandates.invite")).at(-1);
  expect(invite?.idempotencyKey).toBeTruthy();
  expect(invite?.body).toMatchObject({ unitId: "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c03", exclusive: false });

  await gotoOwner(page, "/mandates?view=invited");
  await expect(row(page, "1")).toHaveAttribute("data-state", "invited");
  await gotoOwner(page, "/mandates?view=active");
  await expectAxeClean(page);
  await row(page, "8/101").getByTestId("mandate-revoke").click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("บ้านดี พร็อพเพอร์ตี้");
  await expect(confirm.getByRole("button", { name: "ยกเลิกการมอบหมาย" })).toBeDisabled();
  await typePhrase(confirm);
  await confirm.getByRole("button", { name: "ยกเลิกการมอบหมาย" }).click();
  await expect(confirm).toHaveCount(0);
  await gotoOwner(page, "/mandates?view=past");
  await expect(row(page, "8/101")).toHaveAttribute("data-state", "revoked");
});

test("the agency loses the revoked unit, signs and proposes co-broke, and reads its deals", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, AGENCY_PHONE);
  await hydrated(page);
  await expect(page.getByTestId("mandated-unit")).toHaveCount(1);
  await expect(page.locator('[data-testid="mandated-unit"][data-unit-no="8/101"]')).toHaveCount(0);

  await gotoOwner(page, "/co-broke");
  const proposal = page.getByTestId("co-broke-invited").getByTestId("co-broke-row");
  await expect(proposal).toHaveAttribute("data-state", "proposed");
  await expectAxeClean(page);
  await proposal.getByTestId("co-broke-sign").click();
  const sign = page.getByRole("alertdialog");
  await expect(sign).toContainText("40%");
  await sign.getByRole("button", { name: "เซ็นข้อตกลง" }).click();
  await expect(sign).toHaveCount(0);
  await expect(proposal).toHaveAttribute("data-state", "signed");

  await page.getByTestId("co-broke-propose").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("co-broke-agency").selectOption({ label: "นายหน้าร่วม จำกัด" });
  await dialog.getByTestId("co-broke-split").fill("30");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("co-broke-mine").getByTestId("co-broke-row")).toHaveCount(1);
  expect((await received("owner.coBroke.propose")).at(-1)?.body).toMatchObject({ splitPercent: "30" });

  await gotoOwner(page, "/deals");
  await expect(page.getByTestId("deals-outside")).toContainText("นอกระบบ getproperty");
  await expect(page.getByTestId("deal-row")).toHaveCount(1);
  await expectAxeClean(page);
  await page.getByTestId("deal-open").click();
  await expect(page.getByTestId("deal-commission")).toContainText("15,000");
  await expect(page.getByTestId("deal-no-fees")).toBeVisible();
  await expectAxeClean(page);
});

test("an estate agency signs up for free and lands on its mandated units", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/signup`);
  await page.getByTestId("signup-switch-kind").click();
  await expect(page).toHaveURL(`${HOSTS.owner}/signup?as=agency`);
  await expect(page.getByTestId("landlord-signup")).toHaveAttribute("data-kind", "agency");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("นายหน้า");
  await expectAxeClean(page);
  await page.getByTestId("signup-name").fill("บริษัท เช่าง่าย เอเจนซี่");
  await page.getByLabel(/เบอร์มือถือ|Mobile number/).fill("0891234599");
  await page.getByRole("button", { name: /ส่งรหัส|Send code/ }).click();
  await page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ }).fill("123456");
  await expect(page).toHaveURL(`${HOSTS.owner}/mandated-units?welcome=1`);
  await hydrated(page);
  await expect(page.getByTestId("agency-welcome")).toContainText("ฟรี");
  await expect(page.getByTestId("mandated-unit")).toHaveCount(0);
});
