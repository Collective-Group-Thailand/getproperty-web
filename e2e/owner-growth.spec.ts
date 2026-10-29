import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received, signInOwner } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * GW4 — distribution and growth billing on the owner console (api G4 + G5; D-288, D-296, D-297, D-298; O-027,
 * O-029): the Facebook Page (refused token stores nothing, connected, checked, disconnected), the listing's Page posts
 * with a failed one retried, the share kit's photo bundle, boosts and photo services "not on sale yet" until a price is
 * published, then bought (Idempotency-Key) → awaiting payment → paid → running, a free building boost, and the
 * agency's LINE OA add-on terms accepted when connecting.
 */

test.describe.configure({ mode: "serial" });

const LANDLORD_PHONE = "0810000006";
const AGENCY_PHONE = "0810000008";
const LISTING = "8d4b2c1a-0000-4000-8000-00000000a001";

const control = (path: string) => fetch(`${MOCK_API}/__mock/owner/growth/${path}`, { method: "POST" });
const resetGrowth = () => fetch(`${MOCK_API}/__mock/owner/reset?part=growth`, { method: "POST" });
const growthState = async () =>
  (await (await fetch(`${MOCK_API}/__mock/owner/growth`)).json()) as {
    boosts: { id: string; state: string; listingId: string | null; buildingId: string | null }[];
    orders: { id: string; state: string; listingId: string | null }[];
  };

async function signInLandlord(page: Page) {
  await signInWithOtp(page, HOSTS.owner, LANDLORD_PHONE);
  await hydrated(page);
}

test.beforeAll(resetGrowth);
test.afterAll(resetGrowth);

test("Facebook Page: a refused token stores nothing, then connected, checked again and disconnected", async ({
  page,
}) => {
  await signInLandlord(page);
  await gotoOwner(page, "/settings");
  await page.getByTestId("settings-tab-facebook_page").click();
  await expect(page.getByTestId("facebook-page")).toBeVisible();
  await expect(page.getByTestId("facebook-page-card")).toHaveCount(0);
  await expect(page.getByTestId("facebook-how")).toContainText("Marketplace");
  await expectAxeClean(page);

  await page.getByTestId("facebook-connect").click();
  let dialog = page.getByRole("dialog");
  await dialog.getByTestId("facebook-page-id").fill("102345678901234");
  await dialog.getByTestId("facebook-token").fill("fake-page-token-revoked-1");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog.getByTestId("problem-notice")).toHaveAttribute("data-code", "facebook.page_refused");
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();
  await expect(page.getByTestId("facebook-page-card")).toHaveCount(0);

  await page.getByTestId("facebook-connect").click();
  dialog = page.getByRole("dialog");
  await dialog.getByTestId("facebook-page-id").fill("102345678901234");
  await dialog.getByTestId("facebook-token").fill("fake-page-token-บ้านมาลี");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  const card = page.getByTestId("facebook-page-card");
  await expect(card).toHaveAttribute("data-state", "verified");
  await expect(card.getByTestId("facebook-page-name")).toHaveText("บ้านมาลี");
  // The token is never shown again (only the Page id).
  await expect(page.locator("body")).not.toContainText("fake-page-token");
  const sent = (await received("owner.socialChannels.connect")).at(-1);
  expect(sent?.idempotencyKey).toBeTruthy();

  await card.getByTestId("facebook-verify").click();
  await expect(card).toHaveAttribute("data-state", "verified");
});

test("listing page: the Page post, a failed one retried; the share kit's photo bundle", async ({ page }) => {
  await signInLandlord(page);
  await gotoOwner(page, `/listings/${LISTING}`);
  const posts = page.getByTestId("listing-posts");
  await expect(posts.getByTestId("social-post")).toHaveAttribute("data-state", "posted");
  await expect(posts.getByTestId("social-post-link")).toHaveAttribute("href", /facebook\.com\/102345678901234\/posts/);

  await control(`post-fail?listing=${LISTING}`);
  await page.reload();
  await hydrated(page);
  const failed = posts.locator('[data-testid="social-post"][data-state="failed"]');
  await expect(failed.getByTestId("social-post-error")).toContainText("Facebook answered 500");
  await failed.getByTestId("social-post-retry").click();
  await expect(posts.getByTestId("social-post")).toHaveAttribute("data-state", "queued");
  expect((await received("owner.listingSocialPosts.retry")).at(-1)?.idempotencyKey).toBeTruthy();

  await page.getByTestId("listing-share-open").click();
  const photos = page.getByTestId("listing-share-photos");
  await expect(photos.getByTestId("listing-share-photo").first()).toBeVisible();
  await expectAxeClean(page);
});

test("boosts and photo services are not on sale until priced; bought → awaiting payment → paid → running", async ({
  page,
}) => {
  await signInLandlord(page);
  await gotoOwner(page, `/listings/${LISTING}`);
  const promote = page.getByTestId("listing-promote");
  const week = promote.locator('[data-testid="boost-offer"][data-key="boost_listing_7d"]');
  await expect(week).toHaveAttribute("data-on-sale", "false");
  await expect(week.getByTestId("growth-unpriced")).toContainText("ยังไม่เปิดขาย");
  await expect(week.getByTestId("boost-buy-boost_listing_7d")).toHaveCount(0);
  await expect(promote.locator('[data-testid="media-offer"][data-key="media_verified_photo"]')).toContainText(
    "ยังไม่เปิดขาย",
  );

  await control("price?product=all");
  await page.reload();
  await hydrated(page);
  await expect(week.getByTestId("growth-price")).toContainText("฿535.00");
  await week.getByTestId("boost-buy-boost_listing_7d").click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("฿535.00");
  await confirm.getByRole("button", { name: "ยืนยันและออกใบแจ้งหนี้" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(week).toContainText("รอชำระเงิน");
  const row = promote.getByTestId("boost-row");
  await expect(row).toHaveAttribute("data-state", "pending_payment");
  await expect(row.getByTestId("boost-invoice")).toBeVisible();
  expect((await received("owner.boosts.boostListing")).at(-1)?.idempotencyKey).toBeTruthy();

  const boost = (await growthState()).boosts.find((b) => b.listingId === LISTING)!;
  await control(`pay?boost=${boost.id}`);
  await page.reload();
  await hydrated(page);
  await expect(row).toHaveAttribute("data-state", "active");
  await expect(row.getByTestId("boost-window")).toContainText("ถึง");

  // A photo service: a note for the photographer, an invoice, then the order waits for payment.
  await promote.getByTestId("media-order-verified_photo").click();
  const order = page.getByRole("alertdialog");
  await order.getByTestId("media-order-note").fill("สะดวกหลังบ่ายสาม");
  await order.getByRole("button", { name: "ยืนยันและออกใบแจ้งหนี้" }).click();
  await expect(order).toHaveCount(0);
  await expect(promote.getByTestId("media-order-row").first()).toHaveAttribute("data-state", "pending_payment");
  expect((await received("owner.mediaServices.order")).at(-1)?.body).toMatchObject({
    listingId: LISTING,
    service: "verified_photo",
    note: "สะดวกหลังบ่ายสาม",
  });

  await gotoOwner(page, "/promote");
  await expect(page.getByTestId("promotion")).toBeVisible();
  await page.getByTestId("promotion-tab-active").click();
  await expect(page.getByTestId("promotion-boosts").getByTestId("boost-row")).toHaveCount(1);
  await expect(page.getByTestId("promotion-media-orders").getByTestId("media-order-row")).not.toHaveCount(0);
  await expectAxeClean(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("promotion-boosts")).toBeVisible();
});

test("a free building boost starts at once for an apartment operator", async ({ page }) => {
  await control("free-building");
  await signInOwner(page);
  await gotoOwner(page, "/promote");
  const offer = page.getByTestId("building-boosts").getByTestId("boost-offer").first();
  await expect(offer.getByTestId("growth-free")).toBeVisible();
  await offer.getByTestId("boost-buy-boost_building_month").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "เริ่มโปรโมตฟรี" }).click();
  const row = page.getByTestId("promotion-boosts").locator('[data-testid="boost-row"][data-target="building"]');
  await expect(row).toHaveAttribute("data-state", "active");
  await expect(row).toContainText("ฟรี");
});

test("agency LINE OA: free while unpriced; once priced, connecting asks to accept the fees", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, AGENCY_PHONE);
  await hydrated(page);
  await gotoOwner(page, "/settings/line-oa");
  await expect(page.getByTestId("line-oa-addon")).toHaveAttribute("data-on-sale", "false");
  await expect(page.getByTestId("line-oa-addon-free")).toBeVisible();

  await control("price?product=addon");
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId("line-oa-addon-monthly")).toHaveText("฿990.00");
  await page.getByTestId("line-oa-connect").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("line-oa-channel-id").fill("1657000088");
  await dialog.getByTestId("line-oa-secret").fill("0123456789abcdef0123456789abcdef");
  await dialog.getByTestId("line-oa-token").fill("fake-token-บ้านดี-OA-0000000000");
  await expect(dialog.getByTestId("line-oa-addon-terms")).toContainText("฿1,500.00");
  await expect(dialog.getByTestId("line-oa-submit")).toBeDisabled();
  await dialog.getByTestId("line-oa-addon-accept").click();
  await dialog.getByTestId("line-oa-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("line-oa-channel")).toHaveAttribute("data-state", "verified");
  expect((await received("owner.messagingChannels.connect")).at(-1)?.body).toMatchObject({
    acceptAddonVersionId: "0199f2a0-0000-7000-8000-0000000000cc",
  });
  await expect(page.getByTestId("line-oa-addon-invoice")).toHaveCount(1);
});
