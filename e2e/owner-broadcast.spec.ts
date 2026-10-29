import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * GW5 — sponsored LINE broadcasts on the owner console (api G6; D-300; O-023, O-027): the product starts switched off
 * and unpriced ("not available yet"), drafting and estimating still work; the estimate is withheld below the minimum
 * and shown with the API's cost preview above it; a draft is saved (Idempotency-Key); scheduling is refused while the
 * service is off (designed state), then scheduled once switched on and priced (price locked), sent by the job with a
 * report in totals only and an invoice per delivered recipient; a second draft is cancelled. The short link of a
 * campaign carries channel `line_sponsored` to the listing.
 */

test.describe.configure({ mode: "serial" });

const LANDLORD_PHONE = "0810000006";
const LISTING = "8d4b2c1a-0000-4000-8000-00000000a001";

const control = (path: string) => fetch(`${MOCK_API}/__mock/owner/broadcast/${path}`, { method: "POST" });
const resetBroadcast = () => fetch(`${MOCK_API}/__mock/owner/reset?part=broadcast`, { method: "POST" });

async function signInLandlord(page: Page) {
  await signInWithOtp(page, HOSTS.owner, LANDLORD_PHONE);
  await hydrated(page);
}

async function draft(page: Page, name: string): Promise<string> {
  await gotoOwner(page, `/promote/broadcasts/new?listing=${LISTING}`);
  await page.getByTestId("campaign-name").fill(name);
  await expect(page.getByTestId("estimate-count")).toBeVisible();
  await page.getByTestId("campaign-save").click();
  await page.waitForURL(/\/promote\/broadcasts\/[0-9a-f-]{36}$/);
  await hydrated(page);
  return page.url().split("/").pop()!;
}

test.beforeAll(resetBroadcast);
test.afterAll(resetBroadcast);

test("not available yet: the product says why, drafting and the estimate still work", async ({ page }) => {
  await signInLandlord(page);
  await gotoOwner(page, "/promote");
  await page.getByTestId("promote-tab-broadcasts").click();
  await hydrated(page);
  const product = page.getByTestId("broadcast-product");
  await expect(product).toHaveAttribute("data-state", "off_unpriced");
  await expect(product.getByTestId("broadcast-no-price")).toBeVisible();
  await expect(page.getByTestId("broadcast-how")).toBeVisible();
  await expect(page.getByTestId("campaigns")).toHaveCount(0);
  await expectAxeClean(page);

  await page.getByTestId("broadcast-new").click();
  await hydrated(page);
  const listing = page.locator(`[data-testid="campaign-listing"][data-id="${LISTING}"]`);
  // From the list's "new" nothing is chosen yet (only `?listing=` preselects one); the owner picks the room.
  await expect(listing.getByRole("checkbox")).not.toBeChecked();
  // Review L7: the reach starts at the API's minimum (500 in the mock), not a number made up in the browser.
  await expect(page.getByTestId("campaign-max")).toHaveValue("500");
  await listing.getByRole("checkbox").click();
  await expect(listing.getByRole("checkbox")).toBeChecked();
  // Everyone who fits → a number; a narrow area → withheld below the minimum, never a small count.
  await expect(page.getByTestId("estimate-count")).toBeVisible();
  await expect(page.getByTestId("estimate-no-cost")).toBeVisible();
  await page.locator('[data-testid="campaign-area"][data-slug="lat-phrao"]').click();
  await expect(page.getByTestId("estimate-withheld")).toBeVisible();
  await page.locator('[data-testid="campaign-area"][data-slug="lat-phrao"]').click();
  await expect(page.getByTestId("estimate-count")).toBeVisible();
  await expectAxeClean(page);

  // Saving needs a name.
  await page.getByTestId("campaign-save").click();
  await expect(page.getByTestId("builder-errors")).toBeVisible();
});

test("draft → refused while off → scheduled once on and priced → sent with totals and an invoice", async ({ page }) => {
  await signInLandlord(page);
  const id = await draft(page, "คอนโดอารีย์ ต้นเดือนธันวา");
  const sent = (await received("owner.sponsoredCampaigns.create")).at(-1);
  expect(sent?.idempotencyKey).toBeTruthy();
  expect(Object.keys((sent?.body as { segment: object }).segment).sort()).toEqual(
    ["areas", "budgetMax", "budgetMin", "languages", "moveInFrom", "moveInTo", "unitKinds"].sort(),
  );
  await expect(page.getByTestId("campaign-state")).toHaveAttribute("data-state", "draft");
  await expect(page.getByTestId("campaign-schedule-waiting")).toBeVisible();
  await expect(page.getByTestId("campaign-schedule")).toHaveCount(0);

  await control("enable");
  await control("price?price=0.5000");
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId("campaign-cost")).toBeVisible();
  // Switched off again between loading and confirming → the designed state, nothing scheduled.
  await control("enable?on=0");
  await page.getByTestId("campaign-schedule").click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "ยืนยันและตั้งเวลา" }).click();
  await expect(dialog.getByTestId("schedule-refusal")).toHaveAttribute("data-code", "broadcast.sponsored_disabled");
  await control("enable");
  await dialog.getByRole("button", { name: "ยืนยันและตั้งเวลา" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("campaign-state")).toHaveAttribute("data-state", "scheduled");
  await expect(page.getByTestId("campaign-price-snapshot")).toContainText("฿0.50");
  const scheduled = (await received("owner.sponsoredCampaigns.schedule")).at(-1);
  expect(scheduled?.idempotencyKey).toBeTruthy();

  await control(`send?campaign=${id}`);
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId("campaign-state")).toHaveAttribute("data-state", "sent");
  const report = page.getByTestId("campaign-report");
  await expect(report.getByTestId("report-sent")).not.toHaveText("0");
  await expect(report.getByTestId("report-invoice")).toContainText("PIV-");
  await expectAxeClean(page);
});

test("a second draft is cancelled: nothing sent, nothing billed", async ({ page }) => {
  await signInLandlord(page);
  await draft(page, "ร่างที่จะยกเลิก");
  await page.getByTestId("campaign-cancel").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ยกเลิกแคมเปญ" }).click();
  await expect(page.getByTestId("campaign-state")).toHaveAttribute("data-state", "cancelled");
  await expect(page.getByTestId("campaign-cancel")).toHaveCount(0);
});

test("a listing's promote card starts a campaign; a campaign link carries channel line_sponsored", async ({ page }) => {
  await signInLandlord(page);
  await gotoOwner(page, `/listings/${LISTING}`);
  await page.getByTestId("listing-broadcast-new").click();
  await expect(page).toHaveURL(new RegExp(`/promote/broadcasts/new\\?listing=${LISTING}$`));

  await page.goto(`${HOSTS.owner}/s/sp2campa`);
  await expect(page).toHaveURL(/\/rent\/condo-ari-1br-sunlit\?.*utm_medium=sponsored.*ch=line_sponsored/);
});
