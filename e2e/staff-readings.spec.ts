import { expect, test, type Page } from "@playwright/test";

import { MOCK_API } from "../playwright.config";
import { expectAxeClean, expectTargets48, gotoStaff, hydrated, mock, signInStaff } from "./support/staff";

/**
 * F4 4.1 on the mock API: Today, the reading round, the capture flow with Chromium's fake camera, the
 * API's review answer, a refused (unreadable) photo resolved by typing, and an offline reading replayed
 * with its original Idempotency-Key when the connection comes back.
 */
test.describe.configure({ mode: "serial" });

const METERS = {
  e201: "a1000000-0000-4000-8000-000000000001",
  w201: "a1000000-0000-4000-8000-000000000002",
  e202: "a1000000-0000-4000-8000-000000000003",
  w301: "a1000000-0000-4000-8000-000000000005",
};

interface MockReading {
  assetItemId: string;
  idempotencyKey: string;
  register: string;
  reviewState: string;
  source: string;
  evidenceDocumentId: string | null;
}

test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/staff/reset?part=readings`, { method: "POST" });
});

async function openMeter(page: Page, assetItemId: string) {
  await gotoStaff(page, "/readings");
  await page.locator(`[data-testid="round-item"][data-asset="${assetItemId}"]`).click();
  await expect(page.getByTestId("reading-capture")).toHaveAttribute("data-step", "photo");
}

async function shoot(page: Page) {
  await expect(page.getByTestId("camera-capture")).toHaveAttribute("data-state", "live");
  await expect(page.getByTestId("camera-guide")).toBeVisible();
  await page.getByTestId("camera-shutter").click();
  await expect(page.getByTestId("reading-capture")).toHaveAttribute("data-step", "value");
  await expect(page.getByTestId("capture-photo")).toBeVisible();
}

async function typeOnKeypad(page: Page, value: string) {
  for (const key of value) {
    await page.getByRole("button", { name: key === "." ? "Decimal point" : key, exact: true }).click();
  }
  await expect(page.getByTestId("keypad-value")).toHaveValue(value);
}

test("Today groups the work with counts, by floor", async ({ page }) => {
  await signInStaff(page);
  await expect(page.getByTestId("building-select")).toHaveValue("5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c");
  await expect(page.getByTestId("today-readings").getByTestId("big-action-count")).toHaveText("5");
  await expect(page.getByTestId("today-floors")).toContainText("ชั้น 2 · 3 left");
  // The inspections still open — staff-inspections.spec.ts completes one of the seeded two when it runs
  // first, so the count comes from the API rather than from the seed.
  const open = await page.evaluate(async () => {
    const page = (await (await fetch("/bff/v1/staff/inspections?perPage=50")).json()) as {
      data: { status: string }[];
    };
    return page.data.filter((inspection) => inspection.status === "scheduled" || inspection.status === "in_progress")
      .length;
  });
  expect(open).toBeGreaterThan(0);
  await expect(page.getByTestId("today-inspections").getByRole("link")).toHaveCount(open);
  await expectAxeClean(page);
  await expectTargets48(page.locator("body"));

  // Another building: the round follows the switcher (building B's meters belong to the devices spec).
  await page.getByTestId("building-select").selectOption({ label: "อาคาร B" });
  await expect(page.getByTestId("today-floors")).toContainText("ชั้น 1");
  await page.getByTestId("building-select").selectOption({ label: "อาคาร A" });
  await expect(page.getByTestId("today-readings").getByTestId("big-action-count")).toHaveText("5");
});

test("capture with the camera: photo → keypad → accepted, with OCR and the previous reading", async ({ page }) => {
  await signInStaff(page);
  await page.getByTestId("today-readings").click();
  await hydrated(page);
  await expect(page.getByTestId("round-items").first()).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Reading round progress" })).toHaveAttribute(
    "aria-valuetext",
    "0 of 5 read",
  );
  await expectAxeClean(page);
  await expectTargets48(page.locator("body"));

  await page.locator(`[data-testid="round-item"][data-asset="${METERS.e201}"]`).click();
  await shoot(page);
  await expect(page.getByTestId("reading-capture")).toContainText("Last 12,300 kWh");
  await typeOnKeypad(page, "12345.6");
  await expectAxeClean(page, "[data-testid=reading-capture]");
  await expectTargets48(page.getByTestId("reading-capture"));
  await page.getByTestId("capture-submit").click();

  const result = page.getByTestId("capture-result");
  await expect(result).toHaveAttribute("data-state", "sent");
  await expect(page.getByTestId("result-register")).toHaveText("12,345.6 kWh");
  await expect(page.getByTestId("result-ocr")).toContainText("95% sure");
  await expect(result).toContainText("Accepted for this billing cycle");

  const readings = await mock<MockReading[]>("/__mock/staff/readings");
  const sent = readings.find((reading) => reading.assetItemId === METERS.e201)!;
  expect(sent).toMatchObject({ register: "12345.600", source: "manual", reviewState: "accepted" });
  expect(sent.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  // The photo went to storage compressed on the device (≤ 400 KB JPEG) and is the reading's evidence.
  const files = await mock<{ id: string; mimeType: string; storedBytes: number }[]>("/__mock/staff/files");
  const photo = files.find((file) => file.id === sent.evidenceDocumentId)!;
  expect(photo.mimeType).toBe("image/jpeg");
  expect(photo.storedBytes).toBeGreaterThan(1000);
  expect(photo.storedBytes).toBeLessThanOrEqual(400 * 1024);

  // Next meter goes straight to the next one still to read; back to the round shows progress.
  await page.getByTestId("capture-next").click();
  await expect(page.getByTestId("reading-capture")).toHaveAttribute("data-step", "photo");
  await page.goBack();
  await expect(page.getByTestId("reading-round")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 of 5 read");
  await expect(page.locator(`[data-testid="round-done-item"][data-asset="${METERS.e201}"]`)).toContainText("Accepted");
});

test("a reading below the last one goes to the owner's review (plausibility)", async ({ page }) => {
  await signInStaff(page);
  await openMeter(page, METERS.e202);
  await shoot(page);
  await typeOnKeypad(page, "100");
  await page.getByTestId("capture-submit").click();
  const result = page.getByTestId("capture-result");
  await expect(result).toHaveAttribute("data-state", "sent");
  await expect(result).toContainText("This reading goes to the owner for review");
  await expect(result).toContainText("Needs review");
});

test("an unreadable photo is refused; typing the value keeps the photo", async ({ page }) => {
  await mock("/__mock/staff/ocr?mode=unreadable", "POST");
  try {
    await signInStaff(page);
    await openMeter(page, METERS.w201);
    await shoot(page);
    await page.getByTestId("capture-submit-ocr").click();
    const result = page.getByTestId("capture-result");
    await expect(result).toHaveAttribute("data-state", "conflict");
    await expect(result).toContainText("The reading was refused");
    await page.getByTestId("resolve-type").click();
    await expect(page.getByTestId("reading-capture")).toHaveAttribute("data-step", "value");
    await typeOnKeypad(page, "850.5");
    await page.getByTestId("capture-submit").click();
    await expect(result).toHaveAttribute("data-state", "sent");
  } finally {
    await mock("/__mock/staff/ocr?mode=ok", "POST");
  }
  const requests = await mock<{ idempotencyKey: string }[]>(
    `/__mock/requests?path=${encodeURIComponent("/v1/staff/meter-readings")}`,
  );
  const readings = await mock<MockReading[]>("/__mock/staff/readings");
  const accepted = readings.find((reading) => reading.assetItemId === METERS.w201)!;
  expect(accepted.evidenceDocumentId).not.toBeNull();
  // The typed reading is a new submission (new key), not a replay of the refused one.
  expect(new Set(requests.map((request) => request.idempotencyKey)).size).toBe(requests.length);
});

test("offline: the reading waits in IndexedDB and is replayed with its original Idempotency-Key", async ({
  page,
  context,
}) => {
  await signInStaff(page);
  await openMeter(page, METERS.w301);
  await shoot(page);
  await context.setOffline(true);
  await expect(page.getByTestId("offline-indicator")).toBeVisible();
  await typeOnKeypad(page, "15.5");
  await page.getByTestId("capture-submit").click();
  const result = page.getByTestId("capture-result");
  await expect(result).toHaveAttribute("data-state", "pending");
  await expect(result).toContainText("Saved on this phone");

  await page.getByRole("button", { name: "Back to the round" }).last().click();
  const waiting = page.locator(`[data-testid="round-done-item"][data-asset="${METERS.w301}"]`);
  await expect(waiting).toHaveAttribute("data-state", "pending");
  await expect(page.getByTestId("sync-badge")).toHaveAttribute("data-pending", "1");

  const key = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("gp-staff-queue");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction("entries").objectStore("entries").getAll();
          request.onsuccess = () =>
            resolve(
              (request.result as { state: string; idempotencyKey: string }[]).find((e) => e.state === "pending")!
                .idempotencyKey,
            );
        };
      }),
  );
  expect(
    (
      await mock<{ idempotencyKey: string }[]>(
        `/__mock/requests?path=${encodeURIComponent("/v1/staff/meter-readings")}`,
      )
    ).some((request) => request.idempotencyKey === key),
  ).toBe(false);

  await context.setOffline(false);
  await expect(waiting).toHaveAttribute("data-state", "sent", { timeout: 20_000 });
  await expect(page.getByTestId("sync-badge")).toHaveAttribute("data-pending", "0");
  const sent = (
    await mock<{ idempotencyKey: string }[]>(`/__mock/requests?path=${encodeURIComponent("/v1/staff/meter-readings")}`)
  ).filter((request) => request.idempotencyKey === key);
  expect(sent).toHaveLength(1);
  const reading = (await mock<MockReading[]>("/__mock/staff/readings")).find((r) => r.idempotencyKey === key)!;
  expect(reading).toMatchObject({ assetItemId: METERS.w301, register: "15.500" });
  expect(reading.evidenceDocumentId).not.toBeNull();
});
