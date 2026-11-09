import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * JW3b — a PM company's console (api J3.3 at 1e364785, D-334): the portfolio of the three buildings it manages today
 * (aggregates only), a building's figures, the staff board (assign, overlap refused, end), the contracts (an offer
 * accepted, an expired offer, a termination), and the juristic office's side of the same contracts. A PM `staff`
 * member sees only his building. Written for the deferred e2e run (founder 2026-10-28) — not run in JW3b.
 */

test.describe.configure({ mode: "serial" });

const BUILDING_A = "5c8e0a01-0000-4000-8000-000000000001";
const MC = {
  riversideA: "3c0a0c01-0000-4000-8000-000000000001",
  offerB: "3c0a0c01-0000-4000-8000-000000000004",
  expiredOffer: "3c0a0c01-0000-4000-8000-000000000007",
  draftSoi: "3c0a0c01-0000-4000-8000-000000000006",
};
const reset = () => fetch(`${MOCK_API}/__mock/owner/reset?part=juristic`, { method: "POST" });
const PM = "0810000012";
const PM_STAFF = "0810000013";
const JURISTIC = "0810000010";

async function signIn(page: Page, phone = PM) {
  await signInWithOtp(page, HOSTS.owner, phone);
  await hydrated(page);
}

test.beforeEach(reset);
test.afterAll(reset);

test("the portfolio shows the managed buildings with their figures and the offers waiting", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/portfolio");
  await expect(page.getByTestId("pm-portfolio")).toBeVisible();
  await expect(page.getByTestId("pm-building")).toHaveCount(3);
  await expect(page.getByTestId("pm-offers-waiting")).toContainText("2");
  await expect(page.getByTestId("pm-privacy")).toBeVisible();
  await expectAxeClean(page);

  await page.getByTestId("pm-building").filter({ hasText: "อาคาร A" }).click();
  await page.waitForURL(new RegExp(`/portfolio/buildings/${BUILDING_A}`));
  await expect(page.getByTestId("pm-expiring")).toContainText("สัญญาบำรุงรักษาลิฟต์");
  await expect(page.getByTestId("pm-budget")).toContainText("83.4%");
  await expectAxeClean(page);
});

test("staff: assign, an overlap lands on the member field, end an assignment", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/portfolio/staff");
  await expect(page.getByTestId("staff-building")).toHaveCount(3);
  await expect(page.getByTestId("staff-unassigned")).toContainText("มานพ");
  await expectAxeClean(page);

  await page.getByTestId("staff-unassigned").getByTestId("staff-assign-person").first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByTestId("staff-assign-role").selectOption("technician");
  await dialog.getByTestId("staff-assign-shift").fill("จ.–ศ. 08:00–17:00");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  const [assigned] = (await received("owner.pmStaff.assign")).slice(-1);
  expect(assigned?.body).toMatchObject({ role: "technician", shift: "จ.–ศ. 08:00–17:00" });

  // The building manager of อาคาร A again → overlap.
  await page.getByTestId("staff-assign").first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByTestId("staff-assign-member").selectOption({ label: "อรุณี ผู้จัดการอาคาร" });
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toContainText("ช่วงวันที่ทับกัน");
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();

  await page.getByTestId("staff-person").filter({ hasText: "สมพงษ์" }).getByTestId("staff-end").click();
  dialog = page.getByRole("dialog");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await gotoOwner(page, "/portfolio/staff?view=history&current=all");
  await expect(page.locator('[data-testid="staff-assignment"][data-state="ended"]')).toHaveCount(2);
});

test("contracts: an offer is accepted, an expired one says why, a running one is terminated", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, "/portfolio/contracts");
  await expect(page.getByTestId("pm-contracts-tab-offered")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("management-contract-row")).toHaveCount(2);

  await gotoOwner(page, `/portfolio/contracts/${MC.expiredOffer}`);
  await expect(page.getByTestId("contract-offer-expired")).toBeVisible();
  await expect(page.getByTestId("contract-accept")).toHaveCount(0);

  await gotoOwner(page, `/portfolio/contracts/${MC.offerB}`);
  await page.getByTestId("contract-accept").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ตอบรับ" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByTestId("contract-access")).toBeVisible();
  const [accepted] = (await received("owner.pmContracts.accept")).slice(-1);
  expect(accepted?.idempotencyKey).toBeTruthy();

  await gotoOwner(page, `/portfolio/contracts/${MC.riversideA}`);
  await expect(page.getByTestId("contract-charge").first()).toBeVisible();
  await page.getByTestId("contract-terminate").click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByTestId("contract-terminate-reason").fill("บริษัทขอยุติการให้บริการตามข้อตกลง");
  const phrase = dialog.getByRole("textbox", { name: /^พิมพ์/ });
  await phrase.fill((await phrase.getAttribute("placeholder")) ?? "");
  await dialog.getByRole("button", { name: "บอกเลิกสัญญา" }).click();
  await expect(dialog).toHaveCount(0);
  await gotoOwner(page, "/portfolio");
  await expect(page.getByTestId("pm-building")).toHaveCount(2);
});

test("a PM staff member sees only the building he is assigned to", async ({ page }) => {
  await signIn(page, PM_STAFF);
  await gotoOwner(page, "/portfolio");
  await expect(page.getByTestId("pm-building")).toHaveCount(1);
  await gotoOwner(page, "/portfolio/staff");
  await expect(page.getByTestId("staff-assign")).toHaveCount(0);
});

test("the juristic office offers its draft and reads the fees as expense requests", async ({ page }) => {
  await signIn(page, JURISTIC);
  await gotoOwner(page, "/juristic/management-contracts?tab=draft");
  await expect(page.getByTestId("management-contract-row")).toHaveCount(1);
  await gotoOwner(page, `/juristic/management-contracts/${MC.draftSoi}`);
  await page.getByTestId("contract-offer").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "เสนอสัญญา" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByTestId("contract-cancel")).toBeVisible();

  await gotoOwner(page, `/juristic/management-contracts/${MC.riversideA}`);
  await expect(page.getByTestId("contract-charge").first()).toContainText("EXP-");
  await expect(page.getByTestId("contract-staff")).toContainText("อรุณี");
  await expectAxeClean(page);
});
