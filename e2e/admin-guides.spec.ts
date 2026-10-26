import { expect, test } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInPlatform } from "./support/admin";
import { expectAxeClean } from "./support/staff";

/**
 * B7.13 — guides of the public site in the API (D-271): the platform team writes a draft, a second platform user
 * reviews and publishes it, and the public page reads it from the API.
 */

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/platform/reset`, { method: "POST" });
});

test("one platform user writes a guide, another publishes it, and it shows on the site", async ({ page }) => {
  await signInPlatform(page, "ops");
  await page.goto(`${HOSTS.admin}/guides`);
  await expect(page.getByTestId("guide-row")).toHaveCount(10);
  await expectAxeClean(page);

  await page.getByTestId("new-guide").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("guide-slug").fill("parking-rules");
  await dialog.getByTestId("guide-title").fill("Parking rules in a condo");
  await dialog.getByTestId("guide-summary").fill("Who may park where, and what the juristic person may charge.");
  await dialog
    .getByTestId("guide-answer")
    .fill("Each unit's parking right is in the condo's rules; read them before renting.");
  await dialog.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/guides\/[0-9a-f-]+$/);
  await expect(page.getByTestId("guide-state")).toHaveAttribute("data-state", "draft");

  // the body editor refuses text that is not JSON before asking the API
  await page.getByTestId("edit-guide-body").click();
  await page.getByTestId("guide-sections").fill("[{ not json");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toContainText("This is not valid JSON");
  await page.keyboard.press("Escape");

  // the last editor cannot publish their own guide
  await page.getByTestId("publish-guide").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reviewed, publish" }).click();
  await expect(page.getByRole("alertdialog").getByTestId("problem-notice")).toHaveAttribute(
    "data-code",
    "guide.same_reviewer",
  );
  const url = page.url();

  await page.context().clearCookies();
  await signInPlatform(page, "checker");
  await page.goto(url);
  await page.getByTestId("publish-guide").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reviewed, publish" }).click();
  await expect(page.getByTestId("guide-state")).toHaveAttribute("data-state", "published");
  await expectAxeClean(page);

  // the public site reads it from the API (a guide it has not cached yet shows at once)
  await page.goto(`${HOSTS.owner}/guides/parking-rules`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Parking rules in a condo");
});
