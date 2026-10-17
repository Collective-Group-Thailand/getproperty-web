import { expect, test } from "@playwright/test";

import { INT_CONTROL, INT_HOSTS } from "../../playwright.integration.config";

/**
 * F1 1.2 against the real getproperty-api (e2e/integration/harness.ts): the operator's phone OTP sign-in
 * through the invitation of a freshly onboarded tenant, into the owner shell; and the platform sign-in
 * with TOTP enrolment, into the admin shell.
 */
const control = async <T>(path: string): Promise<T> => (await fetch(`${INT_CONTROL}${path}`)).json() as Promise<T>;

test("operator OTP sign-in (invitation) → owner shell with tenant and role", async ({ page, context }) => {
  const invitation = await control<{ code: string; phone: string; tenantName: string }>("/invitation");
  await page.goto(`${INT_HOSTS.owner}/join?code=${encodeURIComponent(invitation.code)}`);
  await expect(page).toHaveURL(/\/login\?invitation=/);

  await page.getByLabel("เบอร์มือถือ").fill(`0${invitation.phone.slice(3)}`);
  await page.getByRole("button", { name: "ส่งรหัส" }).click();
  await expect(page.getByRole("textbox", { name: "หลักที่ 1" })).toBeVisible();
  const { code } = await control<{ code: string | null }>(
    `/sms/last-code?phone=${encodeURIComponent(invitation.phone)}`,
  );
  expect(code).toMatch(/^\d{6}$/);
  await page.getByRole("textbox", { name: "หลักที่ 1" }).fill(code!);

  await expect(page).toHaveURL(`${INT_HOSTS.owner}/dashboard`);
  await expect(page.getByTestId("session-summary")).toContainText(invitation.tenantName);
  await expect(page.getByTestId("tenant-role")).toHaveText("เจ้าของ");
  const names = (await context.cookies(INT_HOSTS.owner)).map((cookie) => cookie.name);
  expect(names).toEqual(expect.arrayContaining(["__Host-gp_at", "__Host-gp_rt", "__Host-gp_tenant"]));

  // The BFF reaches the real API with the session.
  const me = await page.evaluate(async () => (await fetch("/bff/v1/owner/me")).json());
  expect(me.currentTenant.displayName).toBe(invitation.tenantName);
});

test("platform sign-in with TOTP enrolment → admin shell", async ({ page }) => {
  await page.goto(`${INT_HOSTS.admin}/login`);
  await page.getByLabel("อีเมล").fill("support@getproperty.invalid");
  await page.getByRole("textbox", { name: "รหัสผ่าน", exact: true }).fill("getproperty-dev-only-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  await expect(page.getByTestId("totp-enrolment")).toBeVisible();
  await expect(page.getByRole("img", { name: "คิวอาร์โค้ดสำหรับแอปยืนยันตัวตน" })).toBeVisible();
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  const { code } = await control<{ code: string }>(`/totp?secret=${encodeURIComponent(secret)}`);
  await page.getByLabel("รหัสจากแอปยืนยันตัวตน").fill(code);
  await page.getByRole("button", { name: "ยืนยันและเข้าสู่ระบบ" }).click();

  await expect(page).toHaveURL(`${INT_HOSTS.admin}/`);
  await expect(page.getByTestId("platform-user")).not.toBeEmpty();
  await expect(page.getByTestId("platform-roles")).toHaveText("ซัพพอร์ต");
});
