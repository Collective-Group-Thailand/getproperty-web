import { expect, test } from "@playwright/test";

import { expectAxeClean } from "./support/staff";
import { gotoOwner, resetOwner, signInOwner } from "./support/owner";

/**
 * The operator's own LINE OA (D-254) on the mock API: connect a channel (a token LINE refuses is kept as failing
 * with the reason), copy the webhook URL, re-check, disconnect back to the shared getproperty OA.
 */
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetOwner();
});

test("LINE OA: connect, a refused token is shown with the reason, re-check, disconnect", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/settings");
  await page.getByTestId("settings-tab-line_oa").click();
  await expect(page.getByTestId("line-oa")).toBeVisible();
  await expect(page.getByTestId("line-oa-channel")).toHaveCount(0);
  await expect(page.getByTestId("line-oa-how")).toContainText("Use webhook");
  await expectAxeClean(page);

  await page.getByTestId("line-oa-connect").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("line-oa-channel-id").fill("1657000001");
  await dialog.getByTestId("line-oa-secret").fill("0123456789abcdef0123");
  await dialog.getByTestId("line-oa-token").fill("fake-token-revoked-by-line");
  await expectAxeClean(page);
  await dialog.getByTestId("line-oa-submit").click();
  await expect(dialog).toHaveCount(0);
  const failing = page.locator('[data-testid="line-oa-channel"][data-state="failing"]');
  await expect(failing).toContainText("LINE refused the channel access token (401)");
  await expect(failing).toContainText("เชื่อมต่อไม่ได้");

  // Fixed on LINE's side: connect again (replaces the failing one for the same scope).
  await page.getByTestId("line-oa-connect").click();
  await dialog.getByTestId("line-oa-channel-id").fill("1657000001");
  await dialog.getByTestId("line-oa-secret").fill("0123456789abcdef0123");
  await dialog.getByTestId("line-oa-token").fill("fake-token-หอพักตัวอย่าง");
  await dialog.getByTestId("line-oa-submit").click();
  const channel = page.getByTestId("line-oa-channel");
  await expect(channel).toHaveCount(1);
  await expect(channel).toHaveAttribute("data-state", "verified");
  await expect(channel).toContainText("หอพักตัวอย่าง");
  await expect(channel.getByTestId("line-oa-webhook")).toContainText("/webhooks/line/");
  await expect(channel.getByTestId("line-oa-linked")).toHaveText("ผู้เช่ายืนยันแล้ว 0 คน");
  await expectAxeClean(page);

  await channel.getByRole("button", { name: "ตรวจสอบอีกครั้ง" }).click();
  await expect(page.getByText("LINE ตอบรับแล้ว")).toBeVisible();

  await channel.getByRole("button", { name: "ยกเลิกการเชื่อม" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ยกเลิกการเชื่อม" }).click();
  await expect(page.getByTestId("line-oa-channel")).toHaveCount(0);
});
