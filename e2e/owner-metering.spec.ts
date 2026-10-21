import { expect, test } from "@playwright/test";

import { expectAxeClean } from "./support/staff";
import { gotoOwner, hydrated, received, resetOwner, signInOwner, W } from "./support/owner";

/**
 * F2 2.5 on the mock API: meter points (health, last reading, filters, export link), a meter's usage
 * series with its bucket tabs and the chart's data-table fallback, the reading history with photos, the
 * review queue (accept / correct / reject with Idempotency-Keys), devices (ownership, commands) and the
 * loss workspace (report, trend chart with table, suspects, utility bill entry from a photo read by the
 * API, CSV) — with axe on each screen.
 */
test.describe.configure({ mode: "serial" });

const METER_E_A201 = "a1000000-0000-4000-8000-000000000001";
const METER_E_A301 = "a1000000-0000-4000-8000-000000000004";
const GATEWAY = "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e5f";

test.beforeAll(async () => {
  await resetOwner();
});

test("meter points: health, last reading, filters, review count, export link", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/meters?building=${W.buildingA}`);
  await expect(page.getByTestId("meter-row").first()).toBeVisible();
  await expect(page.getByTestId("readings-export")).toHaveAttribute(
    "href",
    new RegExp(`/bff/v1/owner/buildings/${W.buildingA}/meter-readings/export`),
  );
  await expect(page.getByTestId("meters-tab-reviews")).toContainText("2");
  await expectAxeClean(page);
  await gotoOwner(page, `/meters?building=${W.buildingA}&utility=water`);
  const rows = page.getByTestId("meter-row");
  await expect(rows.first()).toBeVisible();
  for (const utility of await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-utility")),
  ))
    expect(utility).toBe("water");
});

test("a smart meter's series: bucket tabs, line chart with its data table; history with photos", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/meters/${METER_E_A301}?building=${W.buildingA}`);
  await expect(page.getByTestId("meter-title")).toHaveText("E-A-301");
  const chart = page.getByTestId("meter-chart");
  await expect(chart.locator("svg[role=img]")).toBeVisible();
  await chart.getByText("ดูเป็นตาราง").click();
  await expect(chart.locator("table tbody tr").first()).toBeVisible();
  await page.getByTestId("bucket-1d").click();
  await expect(page).toHaveURL(/bucket=1d/);
  await hydrated(page);
  await expect(page.getByTestId("meter-chart").locator("svg[role=img]")).toBeVisible();
  // 15-minute points, computed from raw points since D-241: same shape, same chart.
  await page.getByTestId("bucket-15m").click();
  await expect(page).toHaveURL(/bucket=15m/);
  await hydrated(page);
  await expect(page.getByTestId("meter-chart").locator("svg[role=img]")).toBeVisible();
  await expectAxeClean(page);

  await gotoOwner(page, `/meters/${METER_E_A201}?building=${W.buildingA}`);
  await expect(page.getByTestId("reading-row").first()).toBeVisible();
  await expect(page.getByTestId("meter-readings").getByTestId("photo-thumb").first()).toBeVisible();
  await expect(page.getByTestId("meter-chart")).toBeVisible();
});

test("review queue: correct one reading, reject the other", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/meters/reviews");
  const cards = page.getByTestId("review-card");
  await expect(cards).toHaveCount(2);
  await expectAxeClean(page);

  await page
    .locator('[data-testid="review-card"][data-reason="ocr_low_confidence"]')
    .getByTestId("review-correct")
    .click();
  const correct = page.getByRole("alertdialog", { name: "แก้ไขเลขมิเตอร์" });
  const register = correct.getByTestId("review-register");
  const current = await register.inputValue();
  await register.fill(current.replace(/^(\d+)/, (whole) => String(Number(whole) + 1)));
  await correct.getByTestId("review-note").fill("ตัวเลขหลักสุดท้ายอ่านผิด");
  await correct.getByRole("button", { name: "แก้ไข", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();

  await page.locator('[data-testid="review-card"][data-reason="out_of_band"]').getByTestId("review-reject").click();
  const reject = page.getByRole("alertdialog", { name: "ไม่รับค่านี้?" });
  await reject.getByTestId("review-reject-note").fill("จดผิดห้อง");
  await reject.getByRole("button", { name: "ไม่รับค่า", exact: true }).click();
  await expect(page.getByTestId("review-card")).toHaveCount(0);
  const decisions = await received("owner.readingReviews.decide");
  expect(decisions.map((decision) => decision.body.action)).toEqual(expect.arrayContaining(["correct", "reject"]));
  expect(decisions.every((decision) => decision.idempotencyKey)).toBe(true);
});

test("devices: rented / owned badges, gateway detail with channels and the identify command", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/devices");
  await expect(page.getByTestId("device-row").first()).toBeVisible();
  await expect(page.getByTestId("device-ownership").first()).toBeVisible();
  await expectAxeClean(page);

  await gotoOwner(page, `/devices/${GATEWAY}`);
  await expect(page.getByTestId("device-title")).toHaveText("GP-GW-000123");
  await expect(page.getByTestId("channel-row").first()).toBeVisible();
  // The broker connection (D-239) and labelled device events (meter_status_changed, T-13).
  await expect(page.getByTestId("mqtt-transport")).toHaveAttribute("data-ws-fallback", "false");
  await expect(page.locator('[data-testid="event-row"]:has([data-event-type="meter_status_changed"])')).toContainText(
    "มิเตอร์เปลี่ยนสถานะ",
  );
  await page.getByTestId("command-identify").click();
  await expect(page.getByTestId("command-row").first()).toBeVisible();
  await expectAxeClean(page);
});

test("loss workspace: report, trend with table, suspects, a water bill from its photo, CSV", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/loss?building=${W.buildingA}`);
  await expect(page.getByTestId("loss-pct")).toContainText("%");
  await expect(page.getByTestId("loss-thb")).toContainText("฿");
  await expect(page.getByTestId("suspect-row").first()).toBeVisible();
  await page.getByTestId("loss-chart").getByText("ดูเป็นตาราง").click();
  await expect(page.getByTestId("loss-chart").locator("table tbody tr")).toHaveCount(6);
  await expect(page.getByTestId("loss-csv")).toBeVisible();
  await expectAxeClean(page);

  await page.getByTestId("loss-tab-water").click();
  await hydrated(page);
  await expect(page.getByTestId("loss-no-invoice")).toBeVisible();
  await page.getByTestId("utility-invoice-add").click();
  const dialog = page.getByRole("dialog", { name: "บิลค่าน้ำประปา" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "mwa-bill.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(dialog.getByTestId("utility-invoice-prefilled")).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByTestId("ui-units")).toHaveValue("196.000");
  await expect(dialog.getByTestId("ui-amount")).toHaveValue("2410.75");
  await dialog.getByTestId("form-submit").click();
  await expect(page.getByTestId("utility-invoice-row")).toHaveCount(1, { timeout: 15_000 });
  const created = await received("owner.utilityInvoices.create");
  expect(created.at(-1)?.body).toMatchObject({ utility: "water", units: "196.000", amount: "2410.75" });
  expect(created.at(-1)?.idempotencyKey).toBeTruthy();
});
