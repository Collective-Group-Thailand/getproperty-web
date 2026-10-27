import { expect, test } from "@playwright/test";

import { MOCK_API } from "../playwright.config";
import { gotoOwner, received, signInOwner } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * GW1 — storage (api G1; D-285, D-286, D-292, O-022): the meter with its categories and legal-hold share, the 80 %
 * and 100 % banners, packages "not on sale yet" until a price is published, then bought (Idempotency-Key) → paid →
 * quota raised, and the largest files with bulk delete (legal holds and evidence locked) and restore.
 */

test.describe.configure({ mode: "serial" });

const resetStorage = () => fetch(`${MOCK_API}/__mock/owner/reset?part=storage`, { method: "POST" });
const control = (path: string) => fetch(`${MOCK_API}/__mock/owner/storage/${path}`, { method: "POST" });
const VIDEO = "0199f2a0-0000-7000-8000-000000000501";
const AS_BUILT = "0199f2a0-0000-7000-8000-000000000502";
const LEASE = "0199f2a0-0000-7000-8000-000000000510";

test.beforeAll(resetStorage);
test.afterAll(resetStorage);

test("the meter: quota, where the space goes, the legal-hold share; packages not on sale yet", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/subscription");
  await expect(page.getByTestId("storage-banner")).toHaveCount(0);
  await page.getByTestId("storage-manage").click();
  await expect(page.getByTestId("storage-page")).toBeVisible();

  await expect(page.getByTestId("storage-quota")).toHaveText("พื้นที่ฟรี 5 GB");
  await expect(page.getByTestId("storage-category")).toHaveCount(4);
  await expect(page.locator('[data-testid="storage-category"][data-category="system_legal"]')).toContainText(
    "เอกสารตามกฎหมาย",
  );
  await expect(page.getByTestId("storage-legal-hold")).toContainText("ลบไม่ได้จนครบระยะเวลาเก็บตามกฎหมาย");

  const offer = page.locator('[data-testid="storage-offer"][data-key="storage_plus_20"]');
  await expect(offer).toHaveAttribute("data-on-sale", "false");
  await expect(offer.getByTestId("storage-offer-unpriced")).toContainText("ยังไม่เปิดขาย");
  await expect(offer.getByTestId("storage-buy")).toHaveCount(0);
  await expectAxeClean(page);
});

test("largest files: legal holds and evidence are locked; bulk delete → deleted tab → restore", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/subscription/storage");
  const row = (id: string) => page.locator(`[data-testid="storage-file-row"][data-id="${id}"]`);
  await expect(row(LEASE).getByTestId("storage-file-locked")).toContainText("ต้องเก็บตามกฎหมาย");
  await expect(row(LEASE).getByTestId("storage-file-select")).toBeDisabled();
  await expect(page.locator('[data-testid="storage-file-row"][data-reason="evidence"]').first()).toContainText(
    "หลักฐาน",
  );

  await row(VIDEO).getByTestId("storage-file-select").click();
  await row(AS_BUILT).getByTestId("storage-file-select").click();
  await expect(page.getByTestId("storage-selected")).toContainText("เลือก 2 ไฟล์");
  await page.getByTestId("storage-delete").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("วิดีโอแนะนำหอพัก.mp4");
  await dialog.getByRole("button", { name: "ลบไฟล์ที่เลือก" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row(VIDEO)).toHaveCount(0);
  await expect(page.getByTestId("storage-pending-purge")).toBeVisible();
  const sent = (await received("owner.storage.deleteFiles")).at(-1)?.body as { documentIds: string[] };
  expect([...sent.documentIds].sort()).toEqual([VIDEO, AS_BUILT]);

  await page.getByTestId("storage-tab-deleted").click();
  await expect(page.getByTestId("storage-file-row")).toHaveCount(2);
  await expect(row(VIDEO)).toContainText("ลบถาวร");
  await expectAxeClean(page);
  await page.getByTestId("storage-select-all").click();
  await page.getByTestId("storage-restore").click();
  await expect(page.getByTestId("storage-file-row")).toHaveCount(0);
  await page.getByTestId("storage-tab-active").click();
  await expect(row(VIDEO)).toBeVisible();
});

test("80 % and 100 % banners; a published package is bought, paid and raises the quota", async ({ page }) => {
  await signInOwner(page);
  // Over the quota (a 1 GB custom allowance): the full banner, data kept, legal documents always issued.
  await control("quota?gb=1");
  await gotoOwner(page, "/subscription/storage");
  await expect(page.getByTestId("storage-banner")).toHaveAttribute("data-kind", "full");
  await expect(page.getByTestId("storage-banner")).toContainText("ใบเสร็จและเอกสารตามกฎหมายออกได้ตามปกติ");
  // Near it: the warning banner (amber, never red).
  await control("quota?gb=1.4");
  await gotoOwner(page, "/subscription");
  await expect(page.getByTestId("storage-banner")).toHaveAttribute("data-kind", "warning");
  await expect(page.getByTestId("storage-banner")).toContainText("ใกล้เต็ม");

  // The founder publishes a price (O-022) → the owner buys it.
  await control("price?key=storage_plus_20&price=49.00");
  await gotoOwner(page, "/subscription/storage");
  const offer = page.locator('[data-testid="storage-offer"][data-key="storage_plus_20"]');
  await expect(offer.getByTestId("storage-offer-price")).toContainText("52.43");
  await offer.getByTestId("storage-buy").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("20 GB");
  await expect(dialog).toContainText("52.43");
  await dialog.getByRole("button", { name: "ซื้อแพ็กเกจ" }).click();
  await expect(dialog).toHaveCount(0);
  const pack = page.getByTestId("storage-package");
  await expect(pack).toHaveAttribute("data-state", "pending_payment");
  await expect(pack.getByTestId("storage-package-invoice")).toContainText("PIV-");
  await expect(offer).toContainText("มีรายการรอชำระ");
  const order = (await received("owner.storage.purchasePackage")).at(-1);
  expect(order?.idempotencyKey).toBeTruthy();
  expect(order?.body).toMatchObject({ autoRenew: false });

  // Finance records the payment → active, the quota includes the package, the banner goes.
  const world = (await (await fetch(`${MOCK_API}/__mock/owner/storage`)).json()) as { packages: { id: string }[] };
  await control(`pay?package=${world.packages[0]!.id}`);
  await gotoOwner(page, "/subscription/storage");
  await expect(page.getByTestId("storage-package")).toHaveAttribute("data-state", "active");
  await expect(page.getByTestId("storage-quota")).toContainText("แพ็กเกจ 20 GB");
  await expect(page.getByTestId("storage-banner")).toHaveCount(0);
  await page.getByTestId("storage-auto-renew").getByRole("switch").click();
  await expect
    .poll(async () => (await received("owner.storage.setAutoRenew")).at(-1)?.body)
    .toEqual({ autoRenew: true });
  await expectAxeClean(page);

  // The purchase invoice opens on the subscription's invoice page.
  await page.getByTestId("storage-package-invoice").click();
  await expect(page.getByTestId("subscription-invoice")).toBeVisible();
});
