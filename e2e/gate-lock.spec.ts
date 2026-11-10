import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";

/**
 * Review W1 — the gate kiosk lock is the server's, not only the page's: a locked desk reloads onto the PIN pad, the
 * guard BFF refuses the desk's writes until a PIN is entered, and the PIN lifts the lock for the next reload too.
 */

test.describe.configure({ mode: "serial" });

const LANDSCAPE = { width: 1180, height: 820 };
const reset = () => fetch(`${MOCK_API}/__mock/gate/reset`, { method: "POST" });

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) await page.locator(`[data-testid="pin-step"] [data-key="${digit}"]`).click();
  await page.getByTestId("pin-submit").click();
}

test.beforeEach(reset);
test.afterAll(reset);

test("a locked desk stays locked across a reload until the PIN is entered", async ({ page }) => {
  await page.setViewportSize(LANDSCAPE);
  await page.goto(`${HOSTS.owner}/gate`);
  await page.getByTestId("enrol-code").fill("GATE-2569");
  await page.getByTestId("enrol-submit").click();
  await page.getByTestId("roster-guard").filter({ hasText: "สมชาย" }).click();
  await enterPin(page, "1234");
  await expect(page.getByTestId("gate-desk")).toBeVisible();
  await expect(page.getByTestId("notify")).toBeVisible();

  // The lock reaches the server (its answer is awaited so the reload cannot overtake it).
  const lockAnswer = page
    .waitForResponse((response) => response.url().endsWith("/bff/guard/session/lock"), { timeout: 5_000 })
    .catch(() => null);
  await page.getByTestId("lock").click();
  await expect(page.getByTestId("lock-screen")).toBeVisible();
  await lockAnswer;

  // The reload: the server renders the PIN pad, never the desk behind it.
  await page.reload();
  await expect(page.getByTestId("lock-screen")).toBeVisible();
  await expect(page.getByTestId("lock-screen")).toContainText("ใส่ PIN เพื่อทำงานต่อ");
  await expect(page.getByTestId("notify")).toHaveCount(0);
  await expect(page.getByTestId("lock")).toHaveCount(0);

  // The BFF refuses the desk's writes while locked, whatever the page does.
  const status = await page.evaluate(async () => {
    const response = await fetch("/bff/guard/v1/guard/gates/any/actions/open", {
      method: "POST",
      headers: { "content-type": "application/json", "x-getproperty-csrf": "1" },
      body: JSON.stringify({ reason: "visit" }),
    });
    return { status: response.status, code: ((await response.json()) as { code?: string }).code };
  });
  expect(status).toEqual({ status: 423, code: "gate.locked" });

  // The PIN unlocks, and the next reload opens the desk.
  await enterPin(page, "1234");
  await expect(page.getByTestId("lock-screen")).toHaveCount(0);
  await expect(page.getByTestId("notify")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("notify")).toBeVisible();
  await expect(page.getByTestId("lock-screen")).toHaveCount(0);
});
