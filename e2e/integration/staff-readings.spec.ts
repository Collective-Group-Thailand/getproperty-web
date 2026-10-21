import { expect, test } from "@playwright/test";

import { INT_CONTROL, INT_HOSTS } from "../../playwright.integration.config";

/**
 * F4 4.1 against the real getproperty-api (e2e/integration/harness.ts): a Staff member invited by the
 * owner signs in with the phone OTP on the staff host, opens the reading round of their building,
 * photographs a meter (Chromium's fake camera), types the register and submits it through the offline
 * queue → `POST /v1/staff/meter-readings` (photo presigned to the API's fake object storage, OCR fake)
 * → the reading is accepted and shows in the round as read; the API's round lists one meter less.
 */
const control = async <T>(path: string): Promise<T> => (await fetch(`${INT_CONTROL}${path}`)).json() as Promise<T>;

test("staff OTP sign-in → reading round → a manual reading with its photo → visible in the round", async ({ page }) => {
  const world = await control<{
    code: string;
    phone: string;
    tenantName: string;
    buildingName: string;
    meters: number;
  }>("/staff-invitation");
  expect(world.meters).toBe(2);

  // The browser's presigned PUT goes to the fake storage of the API process.
  await page.route("https://fake-s3.invalid/**", async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      await fetch(`${INT_CONTROL}/storage?url=${encodeURIComponent(request.url())}`, {
        method: "PUT",
        headers: { "content-type": request.headers()["content-type"] ?? "application/octet-stream" },
        body: new Uint8Array(request.postDataBuffer() ?? Buffer.alloc(0)),
      });
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", etag: '"x"' }, body: "" });
    }
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "PUT, GET",
          "access-control-allow-headers": "content-type",
        },
      });
    }
    return route.fulfill({ status: 404, body: "" });
  });

  await page.goto(`${INT_HOSTS.staff}/join?code=${encodeURIComponent(world.code)}`);
  await expect(page).toHaveURL(/\/login\?invitation=/);
  await page.getByLabel(/เบอร์มือถือ|Mobile number/).fill(`0${world.phone.slice(3)}`);
  await page.getByRole("button", { name: /ส่งรหัส|Send code/ }).click();
  await expect(page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ })).toBeVisible();
  const { code } = await control<{ code: string | null }>(`/sms/last-code?phone=${encodeURIComponent(world.phone)}`);
  expect(code).toMatch(/^\d{6}$/);
  await page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ }).fill(code!);

  await expect(page.getByTestId("staff-today")).toBeVisible();
  await expect(page.getByTestId("session-summary")).toContainText(world.tenantName);
  await expect(page.getByTestId("today-readings").getByTestId("big-action-count")).toHaveText("2");
  await page.getByTestId("today-readings").click();
  // A full page load: tap only once React has hydrated the round (the staff shell marks it).
  await page.waitForFunction(() => document.documentElement?.dataset.hydrated === "staff");

  await expect(page.getByTestId("round-item")).toHaveCount(2);
  const first = page.getByTestId("round-item").first();
  const assetItemId = await first.getAttribute("data-asset");
  await first.click();
  await expect(page.getByTestId("camera-capture")).toHaveAttribute("data-state", "live");
  await page.getByTestId("camera-shutter").click();
  await expect(page.getByTestId("reading-capture")).toHaveAttribute("data-step", "value");
  for (const key of "123.4") {
    await page.getByRole("button", { name: key === "." ? /จุดทศนิยม|Decimal point/ : key, exact: true }).click();
  }
  await page.getByTestId("capture-submit").click();

  const result = page.getByTestId("capture-result");
  await expect(result).toHaveAttribute("data-state", "sent", { timeout: 20_000 });
  await expect(page.getByTestId("result-register")).toHaveText("123.4 kWh");

  await page
    .getByRole("button", { name: /กลับไปที่รายการ|Back to the round/ })
    .last()
    .click();
  const done = page.locator(`[data-testid="round-done-item"][data-asset="${assetItemId}"]`);
  await expect(done).toHaveAttribute("data-state", "sent");
  await expect(done).toContainText(/รับค่าแล้ว|Accepted/);
  // The API's own round no longer lists the meter that was read.
  await expect(page.getByTestId("round-item")).toHaveCount(1);
  const round = await page.evaluate(async () => (await fetch("/bff/v1/staff/reading-rounds/current")).json());
  expect(round[0].remaining).toBe(1);
});
