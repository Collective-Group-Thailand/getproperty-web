import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { expectAxeClean } from "./support/staff";
import { gotoOwner, hydrated, ownerControl, received, resetOwner, signInOwner } from "./support/owner";

/**
 * The api release fixes on the owner console (triage F7, D-219–D-227) against the mock API: held payments
 * (D-220) — the dashboard item, "payments to check" with the reason and the payment it may repeat, dismiss
 * with a reason and confirm, both typed with the unit and sent with an Idempotency-Key; the slip reason
 * `possible_qr_duplicate`; the duplicate window setting; party link requests (D-226) — the dashboard item,
 * confirm, reject with a reason and the `409 party.link_request_not_pending` of a request decided in another
 * tab; a future-dated termination (D-219) that records the notice and keeps access until the move-out is
 * completed; the contract PDF hidden from Staff (D-222). Axe on every screen.
 */
test.describe.configure({ mode: "serial" });

const HELD = "9a9e0000-0000-4000-8000-000000000009";
const PAYMENT_QR = "9a9e0000-0000-4000-8000-000000000001";
const LINK_MALEE = "11c00000-0000-4000-8000-000000000001";
const LEASE_A302 = "1ea50000-0000-4000-8000-000000000302";
const PARTY_MALEE = "9a700000-0000-4000-8000-000000000002";

test.beforeAll(async () => {
  await resetOwner();
});

test("held payment: dashboard item, reason and the payment it repeats, dismiss with a reason", async ({ page }) => {
  await signInOwner(page);
  const item = page.getByTestId("today-queue").locator('[data-kind="heldPayments"]');
  await expect(item).toHaveAttribute("data-count", "1");
  await item.click();
  await expect(page.getByTestId("held-payments")).toBeVisible();
  await hydrated(page);
  const row = page.getByTestId("held-row");
  await expect(row).toHaveCount(1);
  await expect(row.getByTestId("held-reason")).toHaveAttribute("data-reason", "qr_already_paid");
  await expect(row.getByTestId("held-duplicate-of")).toHaveAttribute("href", `/payments/${PAYMENT_QR}`);
  await expect(page.getByTestId("money-tab-held")).toContainText("1");
  await expectAxeClean(page);

  await row.getByTestId("held-dismiss").click();
  const dialog = page.getByRole("alertdialog", { name: "ไม่รับเงินรายการนี้?" });
  await dialog.getByRole("textbox", { name: /^พิมพ์/ }).fill("A-201");
  // The reason is required before the dismissal can be sent.
  await expect(dialog.getByRole("button", { name: "ไม่รับรายการนี้", exact: true })).toBeDisabled();
  await dialog.getByTestId("held-dismiss-reason").fill("ธนาคารแจ้งรายการเดิมซ้ำ ตรวจกับ statement แล้ว");
  await dialog.getByRole("button", { name: "ไม่รับรายการนี้", exact: true }).click();
  await expect(page.getByTestId("held-row")).toHaveCount(0);
  const dismissals = await received("owner.payments.dismissHeld");
  expect(dismissals.at(-1)?.body).toMatchObject({ reason: "ธนาคารแจ้งรายการเดิมซ้ำ ตรวจกับ statement แล้ว" });
  expect(dismissals.at(-1)?.idempotencyKey).toBeTruthy();

  await gotoOwner(page, `/payments/${HELD}`);
  await expect(page.getByTestId("payment-dismissed")).toContainText("ธนาคารแจ้งรายการเดิมซ้ำ");
  await expect(page.getByTestId("held-actions")).toHaveCount(0);
});

test("held payment: confirm books it — receipt, no longer waiting", async ({ page }) => {
  await resetOwner("money");
  await signInOwner(page);
  await gotoOwner(page, `/payments/${HELD}`);
  await expect(page.getByTestId("held-reason")).toBeVisible();
  await expect(page.getByTestId("receipt-pdf")).toHaveCount(0);
  await expectAxeClean(page);
  await page.getByTestId("held-confirm").click();
  const dialog = page.getByRole("alertdialog", { name: "บันทึกรับเงินรายการนี้?" });
  await expect(dialog).toContainText("A-201");
  await dialog.getByRole("textbox", { name: /^พิมพ์/ }).fill("A-201");
  await dialog.getByRole("button", { name: "ยืนยัน บันทึกรับ" }).click();
  await expect(page.getByTestId("receipt-pdf")).toBeVisible();
  await expect(page.getByTestId("held-actions")).toHaveCount(0);
  const confirms = await received("owner.payments.confirmHeld");
  expect(confirms.at(-1)?.idempotencyKey).toBeTruthy();

  await gotoOwner(page, "/payments/held");
  await expect(page.getByTestId("held-row")).toHaveCount(0);
});

test("slip reason possible_qr_duplicate and the duplicate window setting", async ({ page }) => {
  await signInOwner(page);
  await ownerControl("slips/qr-duplicate", "POST");
  await gotoOwner(page, "/payments/slips");
  await page.getByTestId("slip-row").filter({ hasText: "A-201" }).click();
  await expect(page.locator('[data-reason="possible_qr_duplicate"]')).toContainText("อาจซ้ำกับการจ่าย QR");
  await expect(page.getByTestId("slip-qr-duplicate")).toBeVisible();
  await expectAxeClean(page);

  await gotoOwner(page, "/settings");
  await expect(page.getByTestId("setting-payments.duplicate_window_hours")).toContainText("72");
});

test("link requests: dashboard item, reject with a reason, confirm, a request decided elsewhere", async ({ page }) => {
  await signInOwner(page);
  const item = page.getByTestId("today-queue").locator('[data-kind="linkRequests"]');
  await expect(item).toHaveAttribute("data-count", "1");
  await item.click();
  await expect(page.getByTestId("link-requests")).toBeVisible();
  await hydrated(page);
  await expect(page.getByTestId("parties-tab-linkRequests")).toContainText("1");
  const row = page.locator(`[data-request="${LINK_MALEE}"]`);
  await expect(row).toHaveAttribute("data-state", "pending");
  await expectAxeClean(page);

  // A second tab of the same Owner confirms first; this tab's confirmation then meets the 409.
  const other = await page.context().newPage();
  await other.goto(`${HOSTS.owner}/parties/link-requests`);
  await hydrated(other);
  await other.locator(`[data-request="${LINK_MALEE}"]`).getByTestId("link-confirm").click();
  await other.getByRole("alertdialog").getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(other.getByText("เชื่อมบัญชีแล้ว")).toBeVisible();
  await expect(other.locator(`[data-request="${LINK_MALEE}"]`)).toHaveCount(0);
  await other.close();

  await row.getByTestId("link-confirm").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByText("คำขอนี้มีผู้ตัดสินไปแล้ว รายการอัปเดตแล้ว")).toBeVisible();
  await expect(page.locator(`[data-request="${LINK_MALEE}"]`)).toHaveCount(0);
  const confirms = await received("owner.parties.confirmLinkRequest");
  expect(confirms).toHaveLength(2);
  expect(new Set(confirms.map((call) => call.idempotencyKey)).size).toBe(2);

  await gotoOwner(page, "/parties/link-requests?state=confirmed");
  await expect(page.locator(`[data-request="${LINK_MALEE}"]`)).toHaveAttribute("data-state", "confirmed");

  // Reject (a fresh request on another party): the reason is required.
  await ownerControl(`link-requests?party=${PARTY_MALEE}`, "POST");
  await gotoOwner(page, `/parties/${PARTY_MALEE}`);
  const pending = page.getByTestId("party-link-requests").getByTestId("link-request-row");
  await expect(pending).toHaveCount(1);
  await expectAxeClean(page);
  await pending.getByTestId("link-reject").click();
  const reject = page.getByRole("alertdialog");
  await expect(reject.getByRole("button", { name: "ปฏิเสธ", exact: true })).toBeDisabled();
  await reject.getByTestId("link-reject-reason").fill("ไม่ใช่ผู้เช่าห้องนี้");
  await reject.getByRole("button", { name: "ปฏิเสธ", exact: true }).click();
  await expect(page.getByTestId("party-link-requests")).toHaveCount(0);
  expect((await received("owner.parties.rejectLinkRequest")).at(-1)?.body).toMatchObject({
    reason: "ไม่ใช่ผู้เช่าห้องนี้",
  });
});

test("future-dated termination records the notice; access ends only when the move-out is completed", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, `/leases/${LEASE_A302}`);
  await page.getByTestId("lease-terminate").click();
  const dialog = page.getByRole("alertdialog", { name: "เลิกสัญญาเช่า" });
  await expect(dialog).toContainText("ถ้าเป็นวันหลังวันนี้จะบันทึกการบอกเลิกล่วงหน้า");
  await dialog.getByTestId("terminate-reason").selectOption("mutual_agreement");
  await dialog.getByRole("button", { name: /วันย้ายออก/ }).click();
  const calendar = page.getByRole("dialog", { name: "เลือกวันที่" });
  await calendar.getByRole("button", { name: "เดือนถัดไป" }).click();
  await calendar.getByRole("gridcell").getByRole("button", { name: "15", exact: true }).click();
  await dialog.getByRole("textbox", { name: /^พิมพ์/ }).fill("A-302");
  await dialog.getByRole("button", { name: "เลิกสัญญา", exact: true }).click();
  // The API checks the notice rule for a lessor's ground (D-020): acknowledged, the same request is repeated.
  const warning = dialog.getByTestId("problem-notice");
  await expect(warning).toHaveAttribute("data-code", "compliance.acknowledgement_required");
  await warning.getByRole("button", { name: "รับทราบและดำเนินการต่อ" }).click();
  await expect(page.getByText(/บันทึกการบอกเลิกแล้ว มีผล/)).toBeVisible();
  await expect(page.getByTestId("lease-notice-card")).toBeVisible();
  await expect(page.getByTestId("lease-notice-access")).toContainText("ผู้เช่ายังอยู่ในห้องและใช้รหัสประตูได้ตามปกติ");
  await expect(page.getByTestId("lease-termination-card")).toHaveCount(0);
  const terminate = (await received("owner.leases.terminate")).at(-1);
  expect(terminate?.idempotencyKey).toBeTruthy();
  expect(terminate?.body.acknowledgementIds).toHaveLength(1);
  expect(String(terminate?.body.effectiveDate) > new Date().toISOString().slice(0, 10)).toBe(true);
  await expectAxeClean(page);

  // The office starts the move-out (the API's sweep does it on the date); it is "ending" until completed.
  await page.getByTestId("lease-begin-move-out").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "เริ่มย้ายออก" }).click();
  await expect(page.getByTestId("lease-ending-card")).toBeVisible();
  await expect(page.getByTestId("lease-ending-card")).toContainText("ก่อนหน้านั้นผู้เช่ายังเข้าห้องได้");
  await page.getByTestId("lease-complete-move-out").click();
  const complete = page.getByRole("alertdialog", { name: "ยืนยันย้ายออกเรียบร้อย?" });
  await complete.getByRole("textbox", { name: /^พิมพ์/ }).fill("A-302");
  await complete.getByRole("button", { name: "ย้ายออกเรียบร้อย" }).click();
  await expect(page.getByTestId("lease-termination-card")).toBeVisible();
  await expect(page.getByTestId("lease-ending-card")).toHaveCount(0);
});

test("contract PDF: Staff sees why it is not offered (D-222); the Owner opens it", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, "0810000004");
  await page.goto(`${HOSTS.owner}/en/leases/${LEASE_A302}`);
  await expect(page.getByTestId("lease-contract-restricted")).toBeVisible();
  await expect(page.getByTestId("lease-contract-pdf")).toHaveCount(0);
  await expect(page.getByTestId("lease-contract-restricted").getByRole("button")).toBeDisabled();
  await expectAxeClean(page);

  const owner = await page.context().browser()!.newContext();
  const ownerPage = await owner.newPage();
  await signInOwner(ownerPage);
  await gotoOwner(ownerPage, `/leases/${LEASE_A302}`);
  await expect(ownerPage.getByTestId("lease-contract-pdf")).toBeVisible();
  await expect(ownerPage.getByTestId("lease-contract-restricted")).toHaveCount(0);
  await owner.close();
});
