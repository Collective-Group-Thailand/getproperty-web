import { expect, type Page } from "@playwright/test";

/**
 * Asks for the SMS code on the sign-in page. The API enforces a resend gap per phone, and several specs
 * sign the same owner in, so a "too many requests" notice is waited out (15 s steps) and the request retried.
 */
export async function requestOtp(page: Page) {
  const firstDigit = page.getByRole("textbox", { name: "หลักที่ 1" });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.getByRole("button", { name: "ส่งรหัส" }).click();
    const limited = page.getByRole("alert").filter({ hasText: "ขอรหัสบ่อยเกินไป" });
    await expect(firstDigit.or(limited)).toBeVisible();
    if (await firstDigit.isVisible()) return;
    await page.waitForTimeout(15_000);
  }
  await expect(firstDigit).toBeVisible();
}
