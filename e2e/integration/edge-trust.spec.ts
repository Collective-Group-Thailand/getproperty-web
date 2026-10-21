import { expect, test } from "@playwright/test";

import { INT_CONTROL, INT_HOSTS } from "../../playwright.integration.config";

/**
 * Review H1 against the real getproperty-api: the sign-in Server Actions forward the end user's address — the
 * entry our edge appended (right-most, `TRUSTED_HOPS=1`), never the spoofed left-most one — and the API records it
 * on the session row (its throttle and audit key on the same `req.ip`).
 */
const control = async <T>(path: string): Promise<T> => (await fetch(`${INT_CONTROL}${path}`)).json() as Promise<T>;

test("the session the API records carries the end user's address, not the web server's", async ({ page }) => {
  const world = await control<{ staffPhone: string }>("/r2");
  // What Cloud Run's front end would pass on: a client-chosen entry, then the address it saw.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.7, 203.0.113.9" });
  await page.goto(`${INT_HOSTS.staff}/login`);
  await page.getByLabel(/เบอร์มือถือ|Mobile number/).fill(`0${world.staffPhone.slice(3)}`);
  await page.getByRole("button", { name: /ส่งรหัส|Send code/ }).click();
  await expect(page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ })).toBeVisible();
  const { code } = await control<{ code: string | null }>(
    `/sms/last-code?phone=${encodeURIComponent(world.staffPhone)}`,
  );
  await page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ }).fill(code!);
  await expect(page.getByTestId("staff-today")).toBeVisible();

  const { ip } = await control<{ ip: string | null }>(
    `/sessions/last-ip?phone=${encodeURIComponent(world.staffPhone)}`,
  );
  expect(ip).toBe("203.0.113.9");
});
