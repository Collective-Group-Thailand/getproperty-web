import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { expectAxeClean, expectTargets48, hydrated, mock, sendThrough, signInStaff } from "./support/staff";

/**
 * F4 4.2 on the mock API: the move-out checklist beside the move-in, multi-shot photos compressed on
 * the device, the checklist kept while offline (and across a reload served by the service worker),
 * synced with If-Match when back online, the photo size budget, and completion with both signatures.
 */
test.describe.configure({ mode: "serial" });

const MOVE_OUT_A201 = "15e00000-0000-4000-8000-000000000002";
const MOVE_IN_A202 = "15e00000-0000-4000-8000-000000000003";
const PHOTO_BUDGET = 400 * 1024;

interface MockInspection {
  id: string;
  status: string;
  version: number;
  residentSigned: boolean;
  staffSigned: boolean;
  reportNumber: string | null;
  items: {
    itemKey: string;
    condition: string | null;
    notes: string | null;
    photoDocumentIds: string[];
    meterRegister: string | null;
  }[];
}

test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/staff/reset?part=inspections`, { method: "POST" });
});

async function openInspection(page: Page, id: string) {
  // Let the service worker take control first, so the page is cached for the offline reload.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.goto(`${HOSTS.staff}/inspections/${id}`);
  await expect(page.getByTestId("inspection-checklist")).toBeVisible();
  await hydrated(page);
}

const item = (page: Page, key: string) => page.locator(`[data-testid="inspection-item"][data-item="${key}"]`);

async function inspection(id: string): Promise<MockInspection> {
  return (await mock<MockInspection[]>("/__mock/staff/inspections")).find((candidate) => candidate.id === id)!;
}

test("move-out beside the move-in, photos, offline checklist kept on the device across a reload, synced when online", async ({
  page,
  context,
}) => {
  await signInStaff(page);
  await page
    .getByTestId("today-inspections")
    .getByRole("link", { name: /Move-out inspection A-201/ })
    .click();
  await expect(page.getByTestId("inspection-checklist")).toBeVisible();
  await openInspection(page, MOVE_OUT_A201);
  await expectAxeClean(page);
  await expectTargets48(page.locator("body"));

  // The move-in condition, note and photo are shown on the line.
  const walls = item(page, "walls");
  await expect(walls.getByTestId("move-in")).toContainText("At move-in: Fair · รอยตะปูเล็กน้อยข้างหน้าต่าง");
  await expect(walls.getByTestId("move-in").getByRole("img")).toHaveCount(1);

  // Two shots with the camera, compressed, handed over together; the move-in photo is beside the camera.
  await walls.getByTestId("add-photos").click();
  const shooter = page.getByTestId("photo-shooter");
  await expect(shooter.getByText("Move-in photo: take the same angle to compare")).toBeVisible();
  await expect(shooter.getByTestId("camera-capture")).toHaveAttribute("data-state", "live");
  await shooter.getByTestId("camera-shutter").click();
  await expect(shooter.getByTestId("camera-shots").getByRole("listitem")).toHaveCount(1);
  await shooter.getByTestId("camera-shutter").click();
  await expect(shooter.getByTestId("camera-shots").getByRole("listitem")).toHaveCount(2);
  await shooter.getByTestId("camera-done").click();
  await expect(walls.getByTestId("item-photos").getByRole("listitem")).toHaveCount(2);
  await expect(page.getByTestId("inspection-checklist")).toHaveAttribute("data-sync", "saved", { timeout: 15_000 });
  // Uploaded and sent: the line now shows the API's two photos, nothing waits on the device.
  await expect(walls.getByTestId("item-photos").getByRole("listitem")).toHaveCount(2);
  await expect(walls.locator('[data-uploaded="false"]')).toHaveCount(0);
  expect(
    (await inspection(MOVE_OUT_A201)).items.find((line) => line.itemKey === "walls")!.photoDocumentIds,
  ).toHaveLength(2);

  // Offline: every line gets a condition, a note and the meter register — kept on the device.
  await context.setOffline(true);
  for (const key of ["walls", "floor", "door_lock", "bathroom", "asset:aircon", "meter:electric"]) {
    await item(page, key)
      .getByText(key === "floor" ? "Fair" : "Good", { exact: true })
      .click();
  }
  await item(page, "floor").getByLabel("Note").fill("รอยขีดข่วนหน้าตู้");
  await item(page, "floor").getByLabel("Note").blur();
  await item(page, "meter:electric").getByTestId("register-button").click();
  for (const key of "9850.5") {
    await item(page, "meter:electric")
      .getByRole("button", { name: key === "." ? "Decimal point" : key, exact: true })
      .click();
  }
  await item(page, "meter:electric").getByRole("button", { name: "Save the register" }).click();
  await expect(page.getByTestId("sync-line")).toContainText("No signal");
  // "No signal" already shows from the earlier lines: wait for the register itself to reach IndexedDB before the
  // reload, or the reload can win the race with the write.
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          new Promise<unknown>((resolve) => {
            const open = indexedDB.open("gp-staff-inspections");
            open.onsuccess = () => {
              const request = open.result.transaction("drafts").objectStore("drafts").get(id);
              request.onsuccess = () =>
                resolve(
                  (request.result as { items?: Record<string, { meterRegister?: string | null }> } | undefined)
                    ?.items?.["meter:electric"]?.meterRegister ?? null,
                );
            };
          }),
        MOVE_OUT_A201,
      ),
    )
    .toBe("9850.5");

  expect((await inspection(MOVE_OUT_A201)).items.find((line) => line.itemKey === "floor")!.condition).toBeNull();

  // A reload without signal gets the worker's static offline page: no rendered page is ever cached (review H2).
  await page.reload().catch(() => undefined);
  await expect(page.getByRole("heading", { name: "ไม่มีการเชื่อมต่อ" })).toBeVisible();
  await expect(page.getByTestId("inspection-checklist")).toHaveCount(0);

  // Back online: the page opens with what was typed offline (kept in IndexedDB), and the draft is sent with
  // If-Match until the API has every line.
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId("inspection-checklist")).toBeVisible();
  await hydrated(page);
  await expect(item(page, "floor").getByLabel("Note")).toHaveValue("รอยขีดข่วนหน้าตู้");
  await expect(item(page, "floor").getByRole("radio", { name: "Fair" })).toBeChecked();
  await expect(item(page, "meter:electric").getByTestId("register-button")).toContainText("9,850.5 kWh");
  await expect(page.getByTestId("inspection-checklist")).toHaveAttribute("data-sync", "saved", { timeout: 20_000 });
  const saved = await inspection(MOVE_OUT_A201);
  expect(saved.status).toBe("in_progress");
  expect(saved.items.every((line) => line.condition !== null)).toBe(true);
  expect(saved.items.find((line) => line.itemKey === "floor")).toMatchObject({
    condition: "fair",
    notes: "รอยขีดข่วนหน้าตู้",
  });
  expect(saved.items.find((line) => line.itemKey === "meter:electric")!.meterRegister).toBe("9850.5");
  expect(saved.items.find((line) => line.itemKey === "walls")!.photoDocumentIds).toHaveLength(2);
});

test("a large photo is compressed on the device to the size budget before upload", async ({ page }) => {
  test.setTimeout(90_000);
  await signInStaff(page);
  await openInspection(page, MOVE_IN_A202);
  const walls = item(page, "walls");
  await walls.getByTestId("add-photos").click();

  // A 12-megapixel, noisy JPEG straight from a phone camera app.
  const original = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 3000;
    const context = canvas.getContext("2d")!;
    const image = context.createImageData(4000, 3000);
    for (let index = 0; index < image.data.length; index += 4) {
      image.data[index] = (index * 7) % 255;
      image.data[index + 1] = Math.random() * 255;
      image.data[index + 2] = (index / 4) % 255;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  });
  const buffer = Buffer.from(original, "base64");
  expect(buffer.byteLength).toBeGreaterThan(2 * 1024 * 1024);
  await page.getByTestId("photo-shooter").getByTestId("camera-file").setInputFiles({
    name: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    buffer,
  });
  // Decoding and re-encoding 12 megapixels takes a moment on a slow runner.
  await expect(page.getByTestId("camera-shots").getByRole("listitem")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("camera-done").click();
  await expect(page.getByTestId("inspection-checklist")).toHaveAttribute("data-sync", "saved", { timeout: 20_000 });

  const saved = await inspection(MOVE_IN_A202);
  const photoId = saved.items.find((line) => line.itemKey === "walls")!.photoDocumentIds[0]!;
  const file = (
    await mock<{ id: string; mimeType: string; storedBytes: number; kind: string }[]>("/__mock/staff/files")
  ).find((candidate) => candidate.id === photoId)!;
  expect(file).toMatchObject({ kind: "inspection_photo", mimeType: "image/jpeg" });
  expect(file.storedBytes).toBeLessThanOrEqual(PHOTO_BUDGET);
  expect(file.storedBytes).toBeLessThan(buffer.byteLength / 5);
});

async function sign(page: Page, pad: number) {
  const canvas = page.getByTestId("signature-pad").nth(pad);
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(box.x + 30 + step * 20, box.y + box.height / 2 + (step % 2 ? -25 : 25));
  }
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-empty", "false");
}

test("completes with the inspector's and the resident's signatures drawn on the device", async ({ page }) => {
  await signInStaff(page);
  await openInspection(page, MOVE_OUT_A201);
  await page.getByTestId("start-complete").click();
  const panel = page.getByTestId("complete-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("complete-submit")).toBeDisabled();
  await sign(page, 0);
  await sign(page, 1);
  await panel.getByLabel("Report notes").fill("คืนกุญแจครบ 2 ดอก");
  await expectAxeClean(page, "[data-testid=complete-panel]");
  await expectTargets48(panel);
  // The API records the completion but the answer is lost (review M1): pressing again sends the same key with
  // the same body and gets the recorded completion back.
  let lost = false;
  await page.route("**/bff/v1/staff/inspections/*/actions/complete", async (route) => {
    if (lost) return route.continue();
    lost = true;
    await sendThrough(route);
    await route.abort("connectionreset");
  });
  await page.getByTestId("complete-submit").click();
  await expect(panel.getByText("You need signal to complete the inspection.")).toBeVisible();
  await page.getByTestId("complete-submit").click();

  await expect(page.getByText("Inspection completed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open the report (PDF)" })).toBeVisible();
  const done = await inspection(MOVE_OUT_A201);
  expect(done).toMatchObject({ status: "signed", staffSigned: true, residentSigned: true });
  expect(done.reportNumber).toMatch(/^INS-/);
  // The draft (signatures included) is gone from the device once completed.
  const draft = await page.evaluate(
    (id) =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open("gp-staff-inspections");
        open.onsuccess = () => {
          const request = open.result.transaction("drafts").objectStore("drafts").get(id);
          request.onsuccess = () => resolve(request.result ?? null);
        };
      }),
    MOVE_OUT_A201,
  );
  expect(draft).toBeNull();
});
