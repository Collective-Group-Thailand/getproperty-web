import { expect, test } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, signInOwner } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * B7.10 part 2 — verified people (D-267): the owner verifies at the e-KYC provider (the mock API stands in for the
 * fake provider, O-021) and the badge shows on listings, the owner page and leads.
 */

test.describe.configure({ mode: "serial" });
test.beforeEach(async () => {
  await fetch(`${MOCK_API}/__mock/owner/reset?part=identities`, { method: "POST" });
});

test("an owner is refused once, tries again and is verified", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/settings/verification");
  const status = page.getByTestId("verification-status");
  await expect(status).toHaveAttribute("data-state", "none");
  await expect(page.getByTestId("settings-tab-verification")).toHaveAttribute("aria-current", "page");
  await expectAxeClean(page);

  await page.getByTestId("verification-start").click();
  await expect(page).toHaveURL(/\/webhooks\/ekyc\/fake\/sessions\/fake-ekyc-/);
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("rejected. You can close this page.")).toBeVisible();

  await gotoOwner(page, "/settings/verification");
  await expect(status).toHaveAttribute("data-state", "rejected");
  await expect(page.getByTestId("verification-reason")).toContainText("could not be read");

  await page.getByTestId("verification-start").click();
  await expect(page).toHaveURL(/\/webhooks\/ekyc\/fake\/sessions\/fake-ekyc-/);
  await page.goBack();
  await gotoOwner(page, "/settings/verification");
  await expect(status).toHaveAttribute("data-state", "pending");
  await page.getByTestId("verification-continue").click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("approved. You can close this page.")).toBeVisible();

  await gotoOwner(page, "/settings/verification");
  await expect(status).toHaveAttribute("data-state", "verified");
  await expect(page.getByTestId("verification-verified")).toBeVisible();
  await expect(page.getByTestId("verification-start")).toHaveCount(0);
});

test("the badge shows on a verified owner's listing and page, and on a verified prospect's enquiry", async ({
  page,
}) => {
  await page.goto(`${HOSTS.owner}/rent/condo-ari-1br-sunlit`);
  await expect(page.getByTestId("listing-identity-verified")).toHaveText("ยืนยันตัวตนแล้ว");
  await page.getByTestId("listing-owner-link").click();
  await expect(page.getByTestId("owner-identity-verified")).toBeVisible();

  await signInWithOtp(page, HOSTS.owner, "0810000006");
  await expect(page).toHaveURL(`${HOSTS.owner}/portfolio`);
  await gotoOwner(page, "/leads/5e7a9c1b-0000-4000-8000-0000000e1001");
  await expect(page.getByTestId("lead-identity-verified")).toBeVisible();
});
