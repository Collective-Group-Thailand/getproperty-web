import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * JW1a — the juristic console: register → unit record → whole-unit transfer (J1.1b, D-307, D-323). A juristic office
 * (mock persona `juristic`) reads its condominium as floor cards with the ownership ratio and its housing estate as
 * plots by soi; a unit's record shows owners and shares, the bill-to and the invite codes; the transfer wizard checks
 * the date and the buyers' shares, restates the unit before recording, sends one Idempotency-Key and shows the API's
 * answer (credit notes to the sellers, charges to the buyers). Written for the deferred e2e run (founder 2026-10-28).
 */

test.describe.configure({ mode: "serial" });

const JURISTIC_PHONE = "0810000010";
const UNIT = (n: number) => `3b24ua01-0000-4000-8000-${String(n).padStart(12, "0")}`;
const VILLAGE = "7b9f0a01-0000-4000-8000-000000000002";

const reset = () => fetch(`${MOCK_API}/__mock/owner/reset?part=juristic`, { method: "POST" });

async function signInJuristic(page: Page) {
  await signInWithOtp(page, HOSTS.owner, JURISTIC_PHONE);
  await expect(page.getByTestId("juristic-overview")).toBeVisible();
  await hydrated(page);
}

async function pickDate(page: Page, label: RegExp, day: string, nextMonths = 0) {
  await page.getByLabel(label).click();
  const calendar = page.getByRole("dialog", { name: "เลือกวันที่" });
  for (let step = 0; step < nextMonths; step += 1) await calendar.getByRole("button", { name: "เดือนถัดไป" }).click();
  await calendar.getByRole("gridcell").getByRole("button", { name: day, exact: true }).click();
}

test.beforeAll(reset);
test.afterAll(reset);

test("the morning: figures, aging, this cycle, what is waiting", async ({ page }) => {
  await signInJuristic(page);
  // The aging comes from the receivables world (mocks/owner/collections.ts, JW1b) so every page agrees on the total.
  await expect(page.getByTestId("figure-outstanding")).toContainText("฿474,275.00");
  await expect(page.getByTestId("aging-strip").getByRole("listitem")).toHaveCount(4);
  await expect(page.getByTestId("cycle-rail-item").first()).toContainText("ไตรมาส 1/2570");
  await expect(page.getByTestId("task-register")).toContainText("2");
  // The rail: J-DESIGN §5 groups, with the receivables JW1b added.
  await expect(
    page.getByRole("navigation", { name: /เมนูหลัก|Main/ }).getByRole("link", { name: "ทะเบียนเจ้าของร่วม" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: /เมนูหลัก|Main/ }).getByRole("link", { name: "ลูกหนี้ค่าส่วนกลาง" }),
  ).toBeVisible();
  await expectAxeClean(page);
});

test("register: condo floors with the ratio, estate plots with ตร.วา, the incomplete view", async ({ page }) => {
  await signInJuristic(page);
  await gotoOwner(page, "/juristic/register");
  await expect(page.getByTestId("register-floor")).toHaveCount(4);
  const a102 = page.locator('[data-testid="register-row"][data-unit="A-102"]');
  await expect(a102).toHaveAttribute("data-incomplete", "true");
  await expect(page.locator('[data-testid="register-row"][data-unit="A-101"]')).toContainText("0.043476");

  await page.getByTestId("register-view-incomplete").click();
  await expect(page.getByTestId("register-row")).toHaveCount(2);

  await gotoOwner(page, `/juristic/register?property=${VILLAGE}`);
  await expect(page.getByTestId("register-plots")).toContainText("52.5 ตร.วา");
  await expect(page.getByTestId("register-plots")).toContainText("1/1");
  await expectAxeClean(page);
});

test("unit record: owners and shares, bill-to with consent, history", async ({ page }) => {
  await signInJuristic(page);
  await gotoOwner(page, `/juristic/register/${UNIT(6)}`);
  await expect(page.getByTestId("owner-row")).toHaveCount(1);
  await expect(page.getByTestId("bill-to-row")).toContainText("บจก. พร็อพแคร์ เอเจนซี่");
  await gotoOwner(page, `/juristic/register/${UNIT(2)}`);
  await expect(page.getByTestId("share-bar")).toContainText("ยังขาด 50%");
  await expectAxeClean(page);
});

test("transfer: errors are summarised, shares cannot pass 100 %, the API's proration is shown", async ({ page }) => {
  await signInJuristic(page);
  await gotoOwner(page, `/juristic/register/${UNIT(1)}`);
  await page.getByTestId("transfer-start").first().click();
  await hydrated(page);

  // Next without a date: the summary takes focus and names the field.
  await page.getByTestId("transfer-next").first().click();
  await expect(page.getByTestId("transfer-errors")).toBeFocused();
  await expect(page.getByTestId("transfer-errors")).toContainText("กรอกวันที่โอน");

  await pickDate(page, /วันที่โอน/, "15", 1);
  await page.getByTestId("transfer-next").first().click();

  await page.getByTestId("transfer-add-buyer").click();
  await page.getByTestId("buyer-name").nth(0).fill("นายสมชาย ผู้ซื้อ");
  await page.getByTestId("buyer-name").nth(1).fill("นางสมศรี ผู้ซื้อ");
  await page.getByTestId("buyer-share").nth(0).fill("60");
  await page.getByTestId("buyer-share").nth(1).fill("50");
  await page.getByTestId("transfer-next").first().click();
  await expect(page.getByTestId("transfer-errors")).toContainText("เกิน 100%");
  await expect(page.getByTestId("transfer-shares-state")).toHaveAttribute("data-state", "over");

  await page.getByRole("button", { name: "แบ่งเท่ากัน" }).click();
  await expect(page.getByTestId("transfer-shares-state")).toHaveAttribute("data-state", "complete");
  await page.getByTestId("transfer-next").first().click();

  // Review: the unit number unlocks the record.
  await expect(page.getByTestId("transfer-review")).toContainText("คุณศิริพร วงศ์สุวรรณ");
  await expect(page.getByTestId("transfer-submit").first()).toBeDisabled();
  await page.getByTestId("transfer-confirm").fill("A-101");
  await page.getByTestId("transfer-submit").first().click();

  await expect(page.getByTestId("transfer-result")).toBeVisible();
  await expect(page.getByTestId("transfer-credit-notes")).toContainText("ใบลดหนี้ให้ผู้ขาย 2 ฉบับ");
  await expect(page.getByTestId("transfer-charges")).toContainText("ยอดเรียกเก็บผู้ซื้อ 2 รายการ");

  const [sent] = await received("owner.juristicRegister.transfer");
  expect(sent?.idempotencyKey).toBeTruthy();
  expect(sent?.body).toMatchObject({
    buyers: [
      { sharePct: "50", party: { displayName: "นายสมชาย ผู้ซื้อ", type: "person" } },
      { sharePct: "50", party: { displayName: "นางสมศรี ผู้ซื้อ", type: "person" } },
    ],
  });
  await expectAxeClean(page);
});

test("invite codes: a batch of QR cards for owners not yet in LINE", async ({ page }) => {
  await signInJuristic(page);
  await gotoOwner(page, "/juristic/register/invites");
  await page.getByTestId("invites-create").click();
  await expect(page.getByTestId("invite-card").first()).toBeVisible();
  const sent = await received("owner.units.inviteResident");
  expect(new Set(sent.map((request) => request.idempotencyKey)).size).toBe(sent.length);
  expect(sent.every((request) => request.body.channel === "line_qr")).toBe(true);
});
