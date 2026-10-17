import { expect, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../../playwright.config";

/** Mock personas (mocks/README.md): OTP / authenticator code and password. */
export const CODE = "123456";
export const PASSWORD = "correct horse battery staple";
export const TENANT = {
  sample: { id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11", name: "หอพักตัวอย่าง" },
  branch: { id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c22", name: "อาคารสาขาสอง" },
  suspended: { id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c33", name: "หอพักระงับชั่วคราว" },
} as const;

/** Phone OTP sign-in on an operator host; ends wherever the app sends the user next. */
export async function signInWithOtp(page: Page, host: string, phone: string): Promise<void> {
  await page.goto(`${host}/login`);
  await page.getByLabel(/เบอร์มือถือ|Mobile number/).fill(phone);
  await page.getByRole("button", { name: /ส่งรหัส|Send code/ }).click();
  await page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ }).fill(CODE);
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

export async function mockRequests(path: string): Promise<{ tenantId: string | null; authorization: boolean }[]> {
  const response = await fetch(`${MOCK_API}/__mock/requests?path=${encodeURIComponent(path)}`);
  return (await response.json()) as { tenantId: string | null; authorization: boolean }[];
}

export async function expireAccess(user: string): Promise<void> {
  await fetch(`${MOCK_API}/__mock/expire-access?user=${user}`, { method: "POST" });
}

export async function expectOnOwnerDashboard(page: Page, tenantName: string): Promise<void> {
  await expect(page).toHaveURL(`${HOSTS.owner}/dashboard`);
  await expect(page.getByTestId("owner-dashboard")).toBeVisible();
  await expect(page.getByTestId("session-summary")).toContainText(tenantName);
}
