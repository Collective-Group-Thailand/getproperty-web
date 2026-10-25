import { expect, test } from "@playwright/test";

import { gotoAdmin, resetPlatform, signInPlatform } from "./support/admin";
import { expectAxeClean } from "./support/staff";

/**
 * The shared LINE OA's message rates (D-254) on the mock API: the rate in force, a new version entered by one
 * platform user, refused when the same user publishes it (maker-checker), published by a second user.
 */
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetPlatform();
});

test("message rates: enter → the maker cannot publish → a second user publishes", async ({ page, browser }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/subscriptions");
  await page.getByTestId("billing-tab-messaging").click();
  await expect(page.getByTestId("admin-messaging-rates")).toBeVisible();
  await expect(page.getByTestId("messaging-rate-current")).toContainText("฿0.1000");
  await expectAxeClean(page);

  await page.getByTestId("messaging-rate-enter").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("messaging-rate-free-tenant").fill("600");
  await dialog.getByTestId("messaging-rate-price").fill("0.08");
  await expectAxeClean(page);
  await dialog.getByTestId("messaging-rate-save").click();
  await expect(dialog).toHaveCount(0);
  const entered = page.locator('[data-testid="messaging-rate-row"][data-state="entered"]');
  await expect(entered).toContainText("600");
  await expect(entered).toContainText("฿0.0800");

  await entered.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("alertdialog").getByTestId("problem-notice")).toHaveAttribute(
    "data-code",
    "messaging_rate.same_checker",
  );

  const checker = await browser.newPage();
  await signInPlatform(checker, "checker");
  await gotoAdmin(checker, "/subscriptions/messaging");
  const row = checker.locator('[data-testid="messaging-rate-row"][data-state="entered"]');
  await row.getByRole("button", { name: "Publish" }).click();
  await checker.getByRole("alertdialog").getByRole("button", { name: "Publish" }).click();
  await expect(checker.locator('[data-testid="messaging-rate-row"][data-state="published"]')).toHaveCount(2);
  await checker.close();
});
