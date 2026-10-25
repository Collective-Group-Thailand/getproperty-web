import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInOwner, hydrated } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * B7.8 sign-in (D-255, D-283) — Google, Apple and LINE through the local test provider (`OAUTH_MODE=fake`): the
 * redirects, state cookie, API calls and refusals are the live code paths; only the provider's page is stood in for.
 */

test.describe.configure({ mode: "serial" });
test.beforeEach(async () => {
  await fetch(`${MOCK_API}/__mock/owner/reset?part=identities`, { method: "POST" });
});

async function asTestUser(page: Page, uid: string, email?: string) {
  const fake = page.getByTestId("oauth-fake");
  await expect(fake).toBeVisible();
  await fake.getByTestId("oauth-fake-uid").fill(uid);
  if (email !== undefined) await fake.getByTestId("oauth-fake-email").fill(email);
  await fake.getByTestId("oauth-fake-continue").click();
}

test("a landlord who linked Google signs in with it; an unknown account is told to link it first", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/login`);
  const buttons = page.getByTestId("oauth-buttons");
  await expect(buttons.getByRole("link")).toHaveText([
    "ดำเนินการต่อด้วย Google",
    "ดำเนินการต่อด้วย Apple",
    "ดำเนินการต่อด้วย LINE",
  ]);
  await expectAxeClean(page);

  await buttons.getByTestId("oauth-google").click();
  await asTestUser(page, "someone-new");
  await expect(page).toHaveURL(/\/login\?oauthError=auth\.identity_not_linked/);
  await expect(page.getByTestId("oauth-error")).toContainText("ยังไม่ได้เชื่อมกับ getproperty");

  await page.getByTestId("oauth-google").click();
  await page.getByTestId("oauth-fake-cancel").click();
  await expect(page.getByTestId("oauth-error")).toHaveAttribute("data-code", "oauth.cancelled");

  await page.getByTestId("oauth-google").click();
  await asTestUser(page, "landlord-google");
  await expect(page).toHaveURL(`${HOSTS.owner}/portfolio`);
  await hydrated(page);
  await expect(page.getByTestId("session-summary")).toContainText("มาลี มีสุข");
});

test("an owner adds Apple and LINE on the settings page, then removes Apple", async ({ page }) => {
  await signInOwner(page);
  await page.goto(`${HOSTS.owner}/settings/sign-in`);
  await hydrated(page);
  const view = page.getByTestId("sign-in-methods");
  await expect(view.getByTestId("sign-in-phone")).toContainText("1");
  await expect(view.getByTestId("sign-in-apple")).toHaveAttribute("data-linked", "false");
  await expectAxeClean(page);

  await view.getByTestId("sign-in-add-apple").click();
  await asTestUser(page, "owner-apple", "owner@example.com");
  await expect(page).toHaveURL(/\/settings\/sign-in\?linked=apple/);
  await expect(page.getByTestId("sign-in-linked")).toContainText("เพิ่ม Apple แล้ว");
  await expect(page.getByTestId("sign-in-apple")).toHaveAttribute("data-linked", "true");
  await expect(page.getByTestId("sign-in-apple")).toContainText("owner@example.com");

  await page.getByTestId("sign-in-add-line").click();
  await asTestUser(page, "U0000000000000000000000000owner1");
  await expect(page.getByTestId("sign-in-line")).toHaveAttribute("data-linked", "true");
  await expect(page.getByTestId("sign-in-line")).toContainText("เอาออกที่นี่ไม่ได้");

  await hydrated(page);
  await page.getByTestId("sign-in-remove-apple").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "เอาออก" }).click();
  await expect(page.getByTestId("sign-in-apple")).toHaveAttribute("data-linked", "false");
});

test("a landlord signs up with LINE after typing the name residents will see", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/signup`);
  await expect(page.getByTestId("landlord-signup")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("oauth-line").click();
  await expect(page.getByTestId("landlord-signup")).toContainText("กรอกชื่อ");
  await page.getByTestId("signup-name").fill("ธีระ เช่าดี");
  await page.getByTestId("oauth-line").click();
  await asTestUser(page, "U0000000000000000000000000signup");
  await expect(page).toHaveURL(/\/portfolio$/);
});

test("Google without a shared e-mail cannot open a new account", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/signup`);
  await expect(page.getByTestId("landlord-signup")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("signup-name").fill("ไม่มี อีเมล");
  await page.getByTestId("oauth-google").click();
  await asTestUser(page, "no-email-user", "");
  await expect(page).toHaveURL(/\/signup\?oauthError=auth\.identity_contact_required/);
  await expect(page.getByTestId("oauth-error")).toContainText("ไม่ได้แชร์อีเมล");
});
