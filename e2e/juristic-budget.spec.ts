import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * JW1a — budget → resolution → rate (J1.1b, D-304). A draft budget is approved with an adopted resolution of its
 * building; "สร้างอัตราจากงบนี้" previews what one unit pays a cycle (min / median / max) and the total check
 * "รวม = งบ ✓" from the API, then drafts a `budget_split` version that names the resolution. Rate plans name their
 * resolution (`rate_plan.resolution_required`). Written for the deferred e2e run (founder 2026-10-28).
 */

test.describe.configure({ mode: "serial" });

const JURISTIC_PHONE = "0810000010";
const DRAFT_BUDGET = "b0d6a001-0000-4000-8000-000000000001";
const DRAFT_RESOLUTION = "e5010a01-0000-4000-8000-000000000003";

const reset = () => fetch(`${MOCK_API}/__mock/owner/reset?part=juristic`, { method: "POST" });

async function signInJuristic(page: Page) {
  await signInWithOtp(page, HOSTS.owner, JURISTIC_PHONE);
  await hydrated(page);
}

test.beforeAll(reset);
test.afterAll(reset);

test("a draft resolution is adopted with its number typed", async ({ page }) => {
  await signInJuristic(page);
  await gotoOwner(page, `/juristic/resolutions/${DRAFT_RESOLUTION}`);
  await expect(page.getByTestId("resolution-paper")).toContainText("ปรับงบซ่อมบำรุงลิฟต์");
  await page.getByTestId("resolution-adopt").first().click();
  const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
  await dialog.getByRole("textbox").fill("3/2569");
  await dialog.getByRole("button", { name: "รับรองมติ" }).click();
  await expect(page.getByText("รับรองแล้ว").first()).toBeVisible();
  const [adopt] = await received("owner.juristicResolutions.adopt");
  expect(adopt?.idempotencyKey).toBeTruthy();
});

test("budget → approve → preview → rate draft", async ({ page }) => {
  await signInJuristic(page);
  await gotoOwner(page, `/juristic/budgets/${DRAFT_BUDGET}`);
  await expect(page.getByTestId("budget-total")).toContainText("฿1,234,567.89");

  // The preview works before approval; drafting waits for it.
  await expect(page.getByTestId("preview-check")).toHaveAttribute("data-ok", "true");
  await expect(page.getByTestId("preview-check")).toContainText("รวมทุกห้อง = งบ");
  await expect(page.getByTestId("rate-create-draft")).toHaveCount(0);

  await page.getByTestId("budget-approve").first().click();
  const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
  await dialog.getByTestId("budget-approve-resolution").selectOption("e5010a01-0000-4000-8000-000000000001");
  await dialog.getByRole("button", { name: "อนุมัติงบประมาณ" }).click();
  await expect(page.getByText("อนุมัติแล้ว").first()).toBeVisible();

  // Share by floor area: min / median / max from the API.
  await page.getByText("พื้นที่ห้อง", { exact: true }).click();
  await expect(page.getByTestId("preview-min")).toContainText("฿");
  await expect(page.getByTestId("preview-max")).toContainText("A-104");
  await page.getByTestId("rate-create-draft").click();
  await expect(page.getByTestId("rate-open-plans")).toBeVisible();

  const [draft] = await received("owner.juristicBudgets.createRateDraft");
  expect(draft?.idempotencyKey).toBeTruthy();
  expect(draft?.body).toMatchObject({ kind: "common_fee", splitBy: "area_sqm" });
  await expectAxeClean(page);
});

test("a common-fee version needs an adopted resolution", async ({ page }) => {
  await signInJuristic(page);
  await gotoOwner(page, "/billing/rate-plans");
  const plan = page.locator('[data-testid="rate-plan"][data-plan="เงินกองทุน อาคาร A"]');
  await plan.getByRole("button", { name: "ราคาใหม่" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("version-amount").fill("8333.33");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog.getByText("เลือกมติที่ประชุมที่รับรองอัตรานี้")).toBeVisible();
  await dialog.getByTestId("version-resolution").selectOption("e5010a01-0000-4000-8000-000000000001");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toBeHidden();
  const [saved] = await received("owner.ratePlans.saveVersion");
  expect(saved?.body).toMatchObject({ resolutionId: "e5010a01-0000-4000-8000-000000000001" });
});
