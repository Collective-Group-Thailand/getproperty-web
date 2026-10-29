import { expect, test } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { gotoAdmin, platformReceived, signInPlatform } from "./support/admin";
import { signInWithOtp } from "./support/auth";
import { expectAxeClean } from "./support/staff";

/**
 * GW5 — sponsored LINE broadcasts on the admin console (api G6; D-300, D-291; O-023): the switch is off with its
 * reason; switching on needs LINE Thailand's written confirmation and a reason, and only changed values are sent; a
 * new consent text (th + en, Idempotency-Key) asks everyone again; a scheduled campaign is stopped with a reason and
 * the owner sees it.
 *
 * Written for the suite; not run in the sandbox (founder change 2026-10-28: web e2e deferred).
 */

test.describe.configure({ mode: "serial" });

const resetBroadcast = () => fetch(`${MOCK_API}/__mock/owner/reset?part=broadcast`, { method: "POST" });
const control = (path: string) => fetch(`${MOCK_API}/__mock/owner/broadcast/${path}`, { method: "POST" });

test.beforeAll(resetBroadcast);
test.afterAll(resetBroadcast);

test("settings: off with its reason; switched on with LINE's confirmation and a reason; only changes are sent", async ({
  page,
}) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/settings");
  await page.getByTestId("broadcast-settings-link").click();
  await expect(page.getByTestId("broadcast-status")).toHaveAttribute("data-enabled", "false");
  await expect(page.getByTestId("broadcast-consenting")).toHaveText("1,240");
  await expectAxeClean(page);

  await page.getByRole("switch").first().click();
  await page.getByTestId("broadcast-maxPerWeek").fill("1");
  await page.getByTestId("broadcast-save").click();
  await expect(page.getByTestId("broadcast-confirm-line")).toContainText(/LINE/);
  await page.getByTestId("broadcast-confirm-line").getByRole("checkbox").click();
  await page.getByTestId("broadcast-reason").fill("LINE Thailand confirmed by e-mail 2026-11-10 (O-023)");
  await page.getByTestId("broadcast-save").click();
  await expect(page.getByTestId("broadcast-status")).toHaveAttribute("data-enabled", "true");
  const put = (await platformReceived("admin.broadcast.updateSettings")).at(-1);
  expect(put?.body).toEqual({
    enabled: true,
    maxPerWeek: 1,
    reason: "LINE Thailand confirmed by e-mail 2026-11-10 (O-023)",
  });
});

test("consent text: a new version asks everyone again", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/settings/broadcast");
  await expect(page.getByTestId("consent-version")).toHaveText(/1/);
  await page.getByTestId("consent-publish").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("consent-th-title").fill("รับห้องแนะนำจาก getproperty (รวมโฆษณา) ฉบับที่ 2");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("consent-version")).toHaveText(/2/);
  await expect(page.getByTestId("broadcast-consenting")).toHaveText("0");
  const sent = (await platformReceived("admin.broadcast.publishConsentText")).at(-1);
  expect(sent?.idempotencyKey).toBeTruthy();
});

test("campaigns: a scheduled campaign is stopped with a reason; the owner sees why", async ({ browser }) => {
  await resetBroadcast();
  await control("enable");
  await control("price?price=0.5000");
  const owner = await browser.newPage();
  await signInWithOtp(owner, HOSTS.owner, "0810000006");
  await owner.goto(`${HOSTS.owner}/promote/broadcasts/new?listing=8d4b2c1a-0000-4000-8000-00000000a001`);
  await owner.getByTestId("campaign-name").fill("แคมเปญที่ต้องระงับ");
  await expect(owner.getByTestId("estimate-count")).toBeVisible();
  await owner.getByTestId("campaign-save").click();
  await owner.waitForURL(/\/promote\/broadcasts\/[0-9a-f-]{36}$/);
  await owner.getByTestId("campaign-schedule").click();
  await owner.getByRole("alertdialog").getByRole("button", { name: "ยืนยันและตั้งเวลา" }).click();
  await expect(owner.getByTestId("campaign-state")).toHaveAttribute("data-state", "scheduled");

  const admin = await browser.newPage();
  await signInPlatform(admin, "ops");
  await gotoAdmin(admin, "/listings");
  await admin.getByTestId("listings-tab-broadcasts").click();
  const row = admin.getByTestId("admin-campaign-row").first();
  await expect(row).toHaveAttribute("data-state", "scheduled");
  await expectAxeClean(admin);
  await row.getByTestId("campaign-reject").click();
  const dialog = admin.getByRole("alertdialog");
  await dialog.getByTestId("campaign-reject-reason").fill("ข้อความประกาศไม่ตรงกับห้องจริง");
  await dialog.getByRole("button", { name: /Stop campaign|ระงับแคมเปญ/ }).click();
  await expect(row).toHaveAttribute("data-state", "rejected");
  await expect(row.getByTestId("campaign-reject")).toHaveCount(0);

  await owner.reload();
  await expect(owner.getByTestId("campaign-state")).toHaveAttribute("data-state", "rejected");
  await expect(owner.getByTestId("campaign-rejected")).toContainText("ข้อความประกาศไม่ตรงกับห้องจริง");
});
