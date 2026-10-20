import { expect, test, type Page } from "@playwright/test";

import { INT_CONTROL, INT_HOSTS } from "../../playwright.integration.config";
import { requestOtp } from "./otp";

/**
 * F5 + F2 2.6 against the real getproperty-api (e2e/integration/harness.ts, the `/f5` world): a platform
 * admin enters a new utility tariff version in the tariff manager and a second platform admin verifies
 * and publishes it (the maker is never offered `verify`); the admin sets the trial length to zero in the
 * platform settings and subscribes the console tenant to Apartment Starter; the hourly subscription job
 * (run by the harness) issues the first platform invoice; the tenant's owner sees it on the subscription
 * page with its Thai QR.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

interface F5World {
  adminEmail: string;
  adminPassword: string;
  adminSecret: string;
  checkerEmail: string;
  checkerPassword: string;
  tenantName: string;
  ownerPhone: string;
}

const control = async <T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> => {
  const response = await fetch(`${INT_CONTROL}${path}`, { method });
  const body = (await response.json()) as T;
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(body)}`);
  return body;
};

async function hydrated(page: Page, zone: "admin" | "owner") {
  await page.waitForFunction((z) => document.documentElement.dataset.hydrated === z, zone);
}

async function gotoAdmin(page: Page, path: string) {
  await page.goto(`${INT_HOSTS.admin}${path}`);
  await hydrated(page, "admin");
}

/** Password, then the authenticator: the enrolled admin types a code, a new user enrols first (D-164). */
async function signInPlatform(page: Page, email: string, password: string, secret?: string) {
  await page.goto(`${INT_HOSTS.admin}/login`);
  await page.getByLabel("อีเมล").fill(email);
  await page.getByRole("textbox", { name: "รหัสผ่าน", exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  if (secret) {
    lastAdminStep = Math.floor(Date.now() / 30_000);
    const { code } = await control<{ code: string }>(`/totp?secret=${encodeURIComponent(secret)}`);
    await page.getByLabel("รหัสจากแอปยืนยันตัวตน").fill(code);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  } else {
    await expect(page.getByTestId("totp-enrolment")).toBeVisible();
    const enrolled = (await page.getByTestId("totp-secret").textContent())!.trim();
    const { code } = await control<{ code: string }>(`/totp?secret=${encodeURIComponent(enrolled)}`);
    await page.getByLabel("รหัสจากแอปยืนยันตัวตน").fill(code);
    await page.getByRole("button", { name: "ยืนยันและเข้าสู่ระบบ" }).click();
  }
  await expect(page).toHaveURL(`${INT_HOSTS.admin}/`);
  await hydrated(page, "admin");
}

async function typePhrase(dialog: ReturnType<Page["getByRole"]>) {
  const input = dialog.getByRole("textbox", { name: /^พิมพ์/ });
  await input.fill((await input.getAttribute("placeholder")) ?? "");
}

let world: F5World;
let tariffPath = "";
let lastAdminStep = 0;

test.beforeAll(async () => {
  world = await control<F5World>("/f5");
});

test("tariff manager: one admin enters a version, a second admin verifies and publishes it", async ({ browser }) => {
  const maker = await browser.newPage();
  await signInPlatform(maker, world.adminEmail, world.adminPassword, world.adminSecret);
  await gotoAdmin(maker, "/tariffs");
  const row = maker.locator('[data-testid="tariff-row"][data-provider="mea"]').first();
  await expect(row).toBeVisible();
  await row.getByRole("link").click();
  await expect(maker.getByTestId("tariff-detail")).toBeVisible();
  tariffPath = new URL(maker.url()).pathname;
  await hydrated(maker, "admin");

  await maker.getByTestId("enter-version").click();
  const editor = maker.getByRole("dialog");
  await editor.getByTestId("tariff-effective-from").fill("2030-01-01");
  await editor.getByTestId("tariff-source-url").fill("https://www.mea.or.th/web-integration-2030");
  // Every value is entered as the utility publishes it (the editor prefills only from a version in force).
  await editor.getByTestId("tier-price-0").fill("4.4217");
  await editor.getByTestId("ft-price").fill("0.3972");
  await editor.getByTestId("ft-period").fill("2030-01");
  await editor.getByTestId("tariff-ceiling").fill("4.8189");
  await editor.getByTestId("enter-version-submit").click();
  await expect(editor).toHaveCount(0);
  await expect(maker.getByTestId("tariff-workflow")).toHaveAttribute("data-state", "entered");
  // The API never offers the maker `verify` on their own version.
  await expect(maker.getByTestId("verify-version")).toHaveCount(0);
  await maker.close();

  const checker = await browser.newPage();
  await signInPlatform(checker, world.checkerEmail, world.checkerPassword);
  await gotoAdmin(checker, tariffPath);
  await checker.getByTestId("verify-version").click();
  const verify = checker.getByRole("alertdialog");
  await verify.getByRole("checkbox").click();
  await verify.getByRole("button", { name: "ตรวจแล้ว" }).click();
  await expect(checker.getByTestId("tariff-workflow")).not.toHaveAttribute("data-state", "entered");
  await checker.getByTestId("publish-version").click();
  const publish = checker.getByRole("alertdialog");
  await typePhrase(publish);
  await publish.getByRole("button", { name: "เผยแพร่" }).click();
  await expect(publish).toHaveCount(0);
  await expect(
    checker.locator('[data-testid="tariff-version"][data-state="published"]').filter({ hasText: "2573" }),
  ).toHaveCount(1);
  await checker.close();
});

test("the admin subscribes the console tenant; the hourly job issues the invoice; the owner sees it with its QR", async ({
  browser,
}) => {
  const admin = await browser.newPage();
  // An authenticator code is accepted once: the admin's second sign-in waits for the next 30-second step.
  if (Math.floor(Date.now() / 30_000) === lastAdminStep) await admin.waitForTimeout(30_500 - (Date.now() % 30_000));
  await signInPlatform(admin, world.adminEmail, world.adminPassword, world.adminSecret);
  // Trial length 0 (platform setting, effective now) so the subscription is invoiced at the next run.
  await gotoAdmin(admin, "/settings?q=subscription.trial_days");
  const row = admin.locator('[data-testid="setting-row"][data-key="subscription.trial_days"]');
  await row.getByTestId("edit-subscription.trial_days").click();
  const setting = admin.getByRole("dialog");
  await setting.getByTestId("setting-value").fill("0");
  await setting.getByTestId("setting-reason").fill("web integration: invoice at once");
  await setting.getByTestId("form-submit").click();
  await expect(setting).toHaveCount(0);
  await expect(admin.getByTestId("setting-value-subscription.trial_days")).toHaveText("0");

  await gotoAdmin(admin, "/tenants?q=web-integration-f2");
  await admin.getByTestId("tenant-row").first().getByRole("link").click();
  await expect(admin.getByTestId("tenant-title")).toHaveText(world.tenantName);
  const tenantPath = new URL(admin.url()).pathname;
  await gotoAdmin(admin, `${tenantPath}/subscription`);
  await admin.getByTestId("subscribe").click();
  const subscribe = admin.getByRole("dialog");
  await subscribe.locator('select[name="planKey"]').selectOption("apartment_starter");
  await subscribe.getByTestId("form-submit").click();
  await expect(subscribe).toHaveCount(0);
  await expect(admin.getByTestId("subscription")).toBeVisible();

  const sweep = await control<{ invoices: number }>("/f5/sweep", "POST");
  expect(sweep.invoices).toBeGreaterThanOrEqual(1);
  await gotoAdmin(admin, `${tenantPath}/invoices`);
  await expect(admin.getByTestId("platform-invoice-row").first()).toBeVisible();
  const number = (await admin.getByTestId("platform-invoice-row").first().getAttribute("data-number"))!;
  await admin.close();

  const owner = await browser.newPage();
  await owner.goto(`${INT_HOSTS.owner}/login`);
  await owner.getByLabel("เบอร์มือถือ").fill(`0${world.ownerPhone.slice(3)}`);
  await requestOtp(owner);
  const { code } = await control<{ code: string | null }>(
    `/sms/last-code?phone=${encodeURIComponent(world.ownerPhone)}`,
  );
  await owner.getByRole("textbox", { name: "หลักที่ 1" }).fill(code!);
  await expect(owner).toHaveURL(`${INT_HOSTS.owner}/dashboard`);
  await owner.goto(`${INT_HOSTS.owner}/subscription`);
  await hydrated(owner, "owner");
  await expect(owner.getByTestId("plan-name")).toHaveText("Apartment Starter");
  const invoiceRow = owner.locator(`[data-testid="platform-invoice-row"][data-number="${number}"]`);
  await expect(invoiceRow).toBeVisible();
  await invoiceRow.getByRole("link").click();
  await expect(owner.getByTestId("subscription-invoice")).toBeVisible();
  // The Thai QR comes from the platform's payment adapter just after the commit (subscriber).
  await expect(async () => {
    await owner.reload();
    await expect(owner.getByTestId("qr-image")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await owner.close();
});
