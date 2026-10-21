import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { expectAxeClean } from "./support/staff";
import { gotoOwner, hydrated, received, resetOwner, signInOwner } from "./support/owner";

/**
 * B6.2 / B6.3 owner screens on the mock API: e-Tax (the month's summary, the documents with the provider's
 * refusal, the detail with the signed files, retry with an Idempotency-Key), TM30 notifications (the 24-hour
 * deadline on the dashboard and the list, `tm30.data_missing` per person, the upload file per building streamed
 * through the BFF, the manual submission and a cancellation — no passport number anywhere in the lists) and
 * insights (KPIs, monthly series as SVG charts with their table fallback, opt-in benchmarks). Axe on each.
 */
test.describe.configure({ mode: "serial" });

const ETAX_REJECTED = "e7a00000-0000-4000-8000-000000000002";
const ETAX_SIGNED = "e7a00000-0000-4000-8000-000000000001";
const TM30_B101 = "7a300000-0000-4000-8000-000000000001";
const TM30_A302 = "7a300000-0000-4000-8000-000000000002";
const BUILDING_A = "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c";
const BUILDING_B = "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b7d";

test.beforeAll(async () => {
  await resetOwner();
});

test("e-Tax: summary, refused document, signed files, retry", async ({ page }) => {
  await signInOwner(page);
  const item = page.getByTestId("today-queue").locator('[data-kind="etax"]');
  await expect(item).toHaveAttribute("data-count", "1");
  await gotoOwner(page, "/reports/etax");
  await expect(page.getByTestId("reports-tab-etax")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("etax-count-signed")).toHaveAttribute("data-count", "1");
  await expect(page.getByTestId("etax-count-rejected")).toHaveAttribute("data-count", "1");
  await expect(page.getByTestId("etax-signed")).toContainText("฿4,500.00");
  await expect(page.getByTestId("etax-row")).toHaveCount(3);
  await expect(page.locator(`[data-testid="etax-row"][data-id="${ETAX_REJECTED}"]`)).toContainText("checksum");
  await expectAxeClean(page);

  await gotoOwner(page, "/reports/etax?status=signed");
  await expect(page.getByTestId("etax-row")).toHaveCount(1);
  await gotoOwner(page, `/reports/etax/${ETAX_SIGNED}`);
  await expect(page.getByTestId("etax-signed-pdf")).toBeVisible();
  await expect(page.getByTestId("etax-signed-xml")).toBeVisible();
  await expect(page.getByTestId("etax-retry")).toHaveCount(0);
  await expectAxeClean(page);

  await gotoOwner(page, `/reports/etax/${ETAX_REJECTED}`);
  await expect(page.getByTestId("etax-error")).toContainText("checksum");
  await page.getByTestId("etax-retry").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ส่งอีกครั้ง" }).click();
  await expect(page.getByTestId("etax-retry")).toHaveCount(0);
  await expect(page.getByTestId("etax-error")).toHaveCount(0);
  expect((await received("owner.etax.retry")).at(-1)?.idempotencyKey).toBeTruthy();
});

test("TM30: deadline on the dashboard, missing data per person, file per building, submission, cancel", async ({
  page,
}) => {
  await signInOwner(page);
  const item = page.getByTestId("today-queue").locator('[data-kind="tm30"]');
  await expect(item).toHaveAttribute("data-count", "2");
  await expect(item).toContainText("เลยกำหนด 24 ชม. แล้ว 1 ราย");
  await item.click();
  await expect(page.getByTestId("tm30")).toBeVisible();
  await hydrated(page);
  await expect(page.getByTestId("parties-tab-tm30")).toContainText("2");
  await expect(page.getByTestId("tm30-overdue-count")).toBeVisible();
  const overdue = page.locator(`[data-testid="tm30-row"][data-id="${TM30_A302}"]`);
  await expect(overdue).toHaveAttribute("data-overdue", "true");
  await expect(overdue.getByTestId("tm30-missing")).toContainText("เลขหนังสือเดินทาง");
  await expect(
    page.locator(`[data-testid="tm30-row"][data-id="${TM30_B101}"]`).getByTestId("tm30-deadline"),
  ).toContainText("เหลือ");
  // Lists never carry a passport number (D-148): the only identity data are names, units and nationality.
  await expect(page.getByTestId("tm30-list")).not.toContainText(/[A-Z]{1,2}\d{6,9}/);
  await expectAxeClean(page);

  // Building A: a person without the data the Immigration Bureau needs → 422 with what to complete.
  await page
    .locator(`[data-testid="tm30-building"][data-building="${BUILDING_A}"]`)
    .getByTestId("tm30-generate")
    .click();
  const refused = page.getByRole("alertdialog");
  await refused.getByRole("button", { name: "สร้างไฟล์" }).click();
  await expect(refused.getByTestId("problem-notice")).toHaveAttribute("data-code", "tm30.data_missing");
  await expect(refused).toContainText("Aung Kyaw (A-302): passportNo is required");
  await refused.getByRole("button", { name: "ยกเลิก" }).click();

  // Building B: the file is generated, downloaded through the BFF, then the submission recorded.
  await page
    .locator(`[data-testid="tm30-building"][data-building="${BUILDING_B}"]`)
    .getByTestId("tm30-generate")
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "สร้างไฟล์" }).click();
  await expect(page.getByText("สร้างไฟล์แล้ว ดาวน์โหลดได้จากรายการ")).toBeVisible();
  const row = page.locator(`[data-testid="tm30-row"][data-id="${TM30_B101}"]`);
  await expect(row).toHaveAttribute("data-status", "generated");
  expect((await received("owner.tm30.generate")).at(-1)?.idempotencyKey).toBeTruthy();
  const download = await page.request.get(`${HOSTS.owner}/bff/tm30-exports/${TM30_B101}/download`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("tm30-B-");
  expect(download.headers()["cache-control"]).toBe("no-store");
  expect((await page.request.get(`${HOSTS.owner}/bff/tm30-exports/not-a-uuid/download`)).status()).toBe(404);

  await gotoOwner(page, "/tm30");
  await expect(row).toHaveAttribute("data-status", "downloaded");
  await row.getByTestId("tm30-mark-submitted").click();
  const submit = page.getByRole("dialog");
  await submit.getByTestId("tm30-reference").fill("TM30-6611-000123");
  await submit.getByTestId("form-submit").click();
  await expect(row).toHaveAttribute("data-status", "submitted_manually");
  const marks = await received("owner.tm30.markSubmitted");
  expect(marks.at(-1)?.body).toMatchObject({ reference: "TM30-6611-000123" });
  expect(marks.at(-1)?.idempotencyKey).toBeTruthy();

  await overdue.getByTestId("tm30-cancel").click();
  const cancel = page.getByRole("alertdialog");
  await cancel.getByTestId("tm30-cancel-reason").fill("ผู้พักเป็นคนไทย บันทึกสัญชาติผิด");
  await cancel.getByRole("button", { name: "ไม่ต้องแจ้ง" }).click();
  await expect(overdue).toHaveAttribute("data-status", "cancelled");
  await gotoOwner(page, "/dashboard");
  await expect(page.getByTestId("today-queue").locator('[data-kind="tm30"]')).toHaveCount(0);
});

test("insights: KPIs, monthly charts with their tables, benchmarks after the Owner opts in", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/reports/insights");
  await expect(page.getByTestId("reports-tab-insights")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("insights-kpis")).toContainText("88.4%");
  await expect(page.getByTestId("insights-kpis")).toContainText("4.4 / 5");
  const charts = page.getByTestId("insight-series");
  await expect(charts.first().locator("svg")).toBeVisible();
  await expect(page.locator('[data-testid="insight-series"][data-metric="loss_pct"] details table')).toHaveCount(1);
  await expect(page.getByTestId("insights-benchmarks")).toHaveAttribute("data-opted-in", "false");
  await expectAxeClean(page);

  await page.getByTestId("insights-months-24").click();
  await expect(page).toHaveURL(/months=24/);
  await expect(page.getByTestId("benchmarks-opt-in").getByRole("switch")).toBeVisible();
  await page.getByTestId("benchmarks-opt-in").getByRole("switch").click();
  await expect(page.getByTestId("insights-benchmarks")).toHaveAttribute("data-opted-in", "true");
  await expect(page.getByTestId("benchmark-row")).toHaveCount(3);
  expect((await received("owner.consents.capture")).at(-1)?.body).toMatchObject({
    items: [{ purposeKey: "analytics.anonymised", granted: true }],
  });
  await expectAxeClean(page);
});
