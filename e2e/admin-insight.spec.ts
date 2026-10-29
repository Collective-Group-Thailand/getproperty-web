import { expect, test } from "@playwright/test";

import { MOCK_API } from "../playwright.config";
import { gotoAdmin, platformReceived, signInPlatform } from "./support/admin";
import { expectAxeClean } from "./support/staff";

/**
 * GW6 — the moderators' side of G8 / G9 (D-299, D-301; O-033, O-035): the review queue (approve, reject with a
 * reason — Idempotency-Key on each decision), owners' reports (dismiss), hidden reviews (restore); getbuild handoffs
 * with their delivery and a resend.
 */

test.describe.configure({ mode: "serial" });

const reset = async () => {
  for (const part of ["insight", "network"])
    await fetch(`${MOCK_API}/__mock/owner/reset?part=${part}`, { method: "POST" });
};

test.beforeAll(reset);
test.afterAll(reset);

test("reviews: approve and reject pending ones, dismiss a report, restore a hidden one", async ({ page }) => {
  await signInPlatform(page, "support");
  await gotoAdmin(page, "/listings");
  await page.getByTestId("listings-tab-reviews").click();
  const rows = page.getByTestId("admin-review-row");
  await expect(rows).toHaveCount(2);
  await expectAxeClean(page);

  await rows.first().getByTestId("review-approve").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /อนุมัติ|Approve/ })
    .click();
  await expect(rows).toHaveCount(1);
  const [approve] = await platformReceived("admin.reviews.approve");
  expect(approve?.idempotencyKey).toBeTruthy();

  await rows.first().getByTestId("review-reject").click();
  await page.getByTestId("review-reject-reason").fill("มีข้อมูลส่วนบุคคลของผู้อื่น");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /ไม่อนุมัติ|Reject/ })
    .click();
  await expect(page.getByTestId("admin-review-row")).toHaveCount(0);

  await page.getByTestId("reviews-tab-reported").click();
  const reported = page.locator('[data-testid="admin-review-row"][data-reported="true"]');
  await expect(reported).toHaveCount(1);
  await reported.getByTestId("review-dismiss-report").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /ปิดรายงาน|Dismiss/ })
    .click();
  await expect(reported).toHaveCount(0);

  await page.getByTestId("reviews-tab-hidden").click();
  await page.getByTestId("admin-review-row").first().getByTestId("review-restore").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /แสดงอีกครั้ง|Restore/ })
    .click();
  await expect(page.getByTestId("admin-review-row")).toHaveCount(0);
});

test("getbuild handoffs: delivery facts and a resend", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/listings/handoffs");
  const rows = page.getByTestId("admin-handoff-row");
  await expect(rows).toHaveCount(3);
  await expect(page.getByTestId("admin-handoff-error")).toContainText("503");
  await expectAxeClean(page);

  await rows.filter({ hasText: "B-0507" }).getByTestId("handoff-resend").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /ส่งใหม่|Resend/ })
    .click();
  await expect(page.getByTestId("admin-handoff-error")).toHaveCount(0);
  const [resend] = await platformReceived("admin.rentalHandoffs.resend");
  expect(resend?.idempotencyKey).toBeTruthy();
});
