import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * JW4 — the gate tablet (`/gate`) and the gate admin (`/juristic/gate`) against the mock (api J4.1 + J4.2 at b3e89b83):
 * the visitor loop with the mock SSE stream, the offline queue, an invite QR scanned with a mocked camera, the SOS
 * takeover, the PIN lockout, and the office's tablet code + reason-gated logs. Written for the deferred e2e run
 * (founder 2026-10-28) — not run in JW4.
 */

test.describe.configure({ mode: "serial" });

const LANDSCAPE = { width: 1180, height: 820 };
const control = (path: string, method: "GET" | "POST" = "POST") =>
  fetch(`${MOCK_API}${path}`, { method }).then((response) => response.json());
const reset = () => control("/__mock/gate/reset");

async function enrolAndSignIn(page: Page, pin = "1234") {
  await page.setViewportSize(LANDSCAPE);
  await page.goto(`${HOSTS.owner}/gate`);
  await page.getByTestId("enrol-code").fill("GATE-2569");
  await page.getByTestId("enrol-submit").click();
  await page.getByTestId("roster-guard").filter({ hasText: "สมชาย" }).click();
  for (const digit of pin) await page.locator(`[data-testid="pin-step"] [data-key="${digit}"]`).click();
  await page.getByTestId("pin-submit").click();
  await expect(page.getByTestId("gate-desk")).toBeVisible();
  await expect(page.getByTestId("waiting-row").first()).toBeVisible();
}

async function typePlate(page: Page, keys: string[], province = "กรุงเทพมหานคร") {
  await page.getByTestId("plate-category").click();
  const sheet = page.getByTestId("plate-sheet");
  for (const key of keys) await sheet.locator(`[data-key="${key}"]`).click();
  await sheet.locator('[data-key="next"]').click();
  await sheet.locator(`[data-province="${province}"]`).click();
}

async function chooseHouse(page: Page, number: string) {
  await page.getByTestId("destination").click();
  await page.getByTestId("destination-search").fill(number);
  await page.getByTestId("destination-option").filter({ hasText: number }).first().click();
}

test.beforeEach(reset);
test.afterAll(reset);

test("visitor loop: notify the house, the answer arrives on the stream, let in opens the barrier, exit", async ({
  page,
}) => {
  await enrolAndSignIn(page);
  await expectAxeClean(page);
  // J-CR: the list carries `overstayedAt` — the contractor inside since yesterday is marked without a stream event.
  await expect(page.getByTestId("inside-row").filter({ hasText: "3200" }).getByTestId("overstayed")).toBeVisible();
  await typePlate(page, ["1", "ก", "ข", "next", "4", "5", "2", "1"]);
  await page.getByTestId("kind-guest").click();
  await chooseHouse(page, "99/12");
  await page.getByTestId("id-last4").fill("4821");
  await expect(page.getByTestId("privacy-notice")).toContainText("90");
  await page.getByTestId("notify").click();
  await expect(page.getByTestId("entry-result")).toContainText("99/12");

  const row = page.getByTestId("waiting-row").filter({ hasText: "1กข 4521" });
  await expect(row).toHaveAttribute("data-state", "requested");
  await control("/__mock/gate/answer?answer=call-me");
  // J-CR: `callBackName` (first name) comes with the list.
  await expect(row.getByTestId("call-back")).toContainText("ขอให้โทรกลับ");
  await control("/__mock/gate/answer?answer=approve");
  await expect(row).toHaveAttribute("data-state", "approved");
  await expect(row.getByTestId("decided-by")).toContainText("อนุญาตเมื่อ");

  await row.getByTestId("let-in").click();
  await expect(page.getByTestId("notice")).toContainText("ไม้กั้น");
  const state = (await control("/__mock/gate", "GET")) as { received: { op: string; body: { reason?: string } }[] };
  expect(state.received.some((entry) => entry.op === "guard.gates.open" && entry.body.reason === "visit")).toBe(true);

  const inside = page.getByTestId("inside-row").filter({ hasText: "1กข 4521" });
  await expect(inside).toBeVisible();
  await inside.getByTestId("exit").click();
  await expect(inside).toHaveCount(0);
});

test("offline: the visit is queued with its clientRef, shown with the count, and sent once when back online", async ({
  page,
  context,
}) => {
  await enrolAndSignIn(page);
  await page.getByTestId("kind-delivery").click();
  await chooseHouse(page, "99/13"); // list cached while online
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByTestId("notify")).toContainText("ออฟไลน์");
  await page.getByTestId("notify").click();
  await expect(page.getByTestId("connection")).toContainText("(1)");
  await expect(page.getByTestId("inside-queued")).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("inside-queued")).toHaveCount(0);
  const state = (await control("/__mock/gate", "GET")) as {
    received: { op: string; body: { clientRef?: string; enteredOffline?: boolean } }[];
  };
  const creates = state.received.filter((entry) => entry.op === "guard.visits.create");
  expect(creates).toHaveLength(1);
  expect(creates[0]?.body.enteredOffline).toBe(true);
});

test("invite QR: a mocked camera reads the token and the visitor is in", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeDetector {
      async detect() {
        return [{ rawValue: "gpv1.mock-invite-9921" }];
      }
      static async getSupportedFormats() {
        return ["qr_code"];
      }
    }
    Object.assign(window, { BarcodeDetector: FakeDetector });
    // A camera always yields frames: a canvas that is never drawn on gives a stream whose video never starts playing.
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const paint = () => {
      const context = canvas.getContext("2d")!;
      context.fillStyle = `hsl(${Date.now() % 360} 50% 50%)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    };
    paint();
    setInterval(paint, 100);
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => (canvas as HTMLCanvasElement & { captureStream: () => MediaStream }).captureStream(),
      },
    });
  });
  await enrolAndSignIn(page);
  await page.getByTestId("scan").click();
  await expect(page.getByTestId("scan-result")).toContainText("99/21");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("inside-row").first()).toBeVisible();
});

test("SOS: a resident's SOS takes over the screen, is acknowledged and resolved; the tablet raises its own", async ({
  page,
}) => {
  await enrolAndSignIn(page);
  await control("/__mock/gate/sos?kind=fire&unit=99/12");
  const banner = page.getByTestId("takeover-banner").first();
  await expect(banner).toContainText("99/12");
  await expect(banner).toHaveAttribute("role", "alert");
  await page.getByTestId("sos-acknowledge").click();
  await expect(banner).toHaveAttribute("role", "status");
  await page.getByTestId("sos-resolve").click();
  await page.getByTestId("resolve-incident-confirm").click();
  await expect(page.getByTestId("takeover-banner")).toHaveCount(0);

  await page.getByTestId("sos-button").click();
  await page.getByTestId("sos-dialog").getByTestId("kind-medical").click();
  await page.getByTestId("sos-send").click();
  await expect(page.getByTestId("takeover-banner").first()).toContainText("เจ็บป่วย");

  // The banner stays above the lock screen.
  await page.getByTestId("lock").click();
  await expect(page.getByTestId("lock-screen")).toBeVisible();
  await expect(page.getByTestId("takeover-banner").first()).toBeVisible();
});

test("PIN: a wrong PIN says so, and five wrong ones lock the guard until the API's time", async ({ page }) => {
  await page.setViewportSize(LANDSCAPE);
  await page.goto(`${HOSTS.owner}/gate`);
  await page.getByTestId("enrol-code").fill("GATE-2569");
  await page.getByTestId("enrol-submit").click();
  await page.getByTestId("roster-guard").filter({ hasText: "วิทยา" }).click();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (const digit of "0000") await page.locator(`[data-testid="pin-step"] [data-key="${digit}"]`).click();
    await page.getByTestId("pin-submit").click();
  }
  await expect(page.getByTestId("pin-step")).toContainText("ลองใหม่ได้ใน");
  await expect(page.locator('[data-testid="pin-step"] [data-key="1"]')).toBeDisabled();

  // J-CR: the roster carries `lockedUntil` — after a reload the guard reads when the lock ends, and the pad opens closed.
  await page.reload();
  await expect(page.getByTestId("roster-guard").filter({ hasText: "วิทยา" })).toContainText("ล็อกถึง");
  await page.getByTestId("roster-guard").filter({ hasText: "วิทยา" }).click();
  await expect(page.getByTestId("pin-step")).toContainText("ลองใหม่ได้ใน");
});

test("office: a new tablet's code is shown once; the visitor log asks for a reason first", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, "0810000010");
  await hydrated(page);
  await gotoOwner(page, "/juristic/gate");
  await page.getByTestId("tablet-new").first().click();
  await page.getByTestId("tablet-name").fill("แท็บเล็ตสำรอง");
  await page.getByRole("dialog").getByRole("button", { name: "สร้างรหัส" }).click();
  await expect(page.getByTestId("enrol-code-shown")).toHaveText(/GP-/);
  await expectAxeClean(page);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("enrol-code-shown")).toHaveCount(0);

  await gotoOwner(page, "/juristic/gate?tab=visits");
  await expect(page.getByTestId("reason-gate-visits")).toBeVisible();
  await page.getByTestId("log-reason").fill("ลูกบ้าน 99/11 สอบถามรถที่เข้าเมื่อวาน");
  await page.getByTestId("log-open").click();
  await expect(page.getByTestId("visit-log-row").first()).toBeVisible();
  await expect(page.getByTestId("log-reason-line")).toContainText("99/11");
});
