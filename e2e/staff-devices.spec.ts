import { expect, test, type Page } from "@playwright/test";

import { MOCK_API } from "../playwright.config";
import { mockRequests } from "./support/auth";
import { expectAxeClean, expectTargets48, gotoStaff, hydrated, mock, signInStaff } from "./support/staff";

/**
 * F4 4.3 on the mock API (building B): gateway provisioning by QR (typed serial where the browser has
 * no BarcodeDetector) with the network check over the realtime stream, the meter binding wizard's
 * validation and install with the register photo, the LED identify command, and a meter swap.
 */
test.describe.configure({ mode: "serial" });

const E_B101 = "a1000000-0000-4000-8000-000000000006";
const W_B101 = "a1000000-0000-4000-8000-000000000007";
const GATEWAY_B = "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e61";

test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/staff/reset?part=devices`, { method: "POST" });
});

async function devicesOfB(page: Page) {
  await signInStaff(page);
  await gotoStaff(page, "/devices");
  await page.getByTestId("building-select").selectOption({ label: "อาคาร B" });
  await expect(page.getByTestId("gateway-list")).toContainText("GP-GW-000125");
}

async function typeKeys(page: Page, value: string) {
  for (const key of value) {
    await page.getByRole("button", { name: key === "." ? "Decimal point" : key, exact: true }).click();
  }
}

async function scanTyped(page: Page, serial: string) {
  // During a client navigation the leaving screen's scan button can still be mounted for a moment.
  await expect(page.getByTestId("scan-button")).toHaveCount(1);
  await page.getByTestId("scan-button").click();
  // Headless Chromium has no BarcodeDetector: the panel offers the typed serial.
  await expect(page.getByTestId("scan-panel")).toHaveAttribute("data-mode", "manual", { timeout: 15_000 });
  await page.getByTestId("scan-manual").fill(serial);
  await page.getByRole("button", { name: "Use this serial" }).click();
}

test("devices of the building: work, gateways, meters by unit — axe and 48-px targets", async ({ page }) => {
  await devicesOfB(page);
  await expect(page.getByTestId("devices-provision").getByTestId("big-action-count")).toHaveText("1");
  await expect(page.getByTestId("devices-install").getByTestId("big-action-count")).toHaveText("1");
  await expect(page.locator(`[data-testid="meter-point"][data-asset="${E_B101}"]`)).toContainText("Read by hand");
  await expectAxeClean(page);
  await expectTargets48(page.locator("body"));
});

test("provision a gateway by QR: code, status page link, online over the realtime stream", async ({ page }) => {
  await devicesOfB(page);
  await page.getByTestId("devices-provision").click();
  await hydrated(page);
  await expect(page.getByTestId("provision")).toHaveAttribute("data-step", "scan");
  await scanTyped(page, "GP-GW-000124");

  await expect(page.getByTestId("provision")).toHaveAttribute("data-step", "code");
  await expect(page.getByTestId("provision-code")).toHaveText(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  // An Idempotency-Key per serial (required since api 048a8bd, triage F7 #2).
  const provisions = (await mockRequests("/v1/staff/devices/actions/provision")) as unknown as {
    idempotencyKey: string | null;
  }[];
  expect(provisions.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByTestId("network-check")).toContainText("Waiting since");
  await page.getByLabel("The gateway's LAN IP (from the router or the label)").fill("192.168.1.50");
  await expect(page.getByTestId("status-page-link")).toHaveAttribute("href", "http://192.168.1.50:8080/");
  await expectAxeClean(page);
  await expectTargets48(page.locator("main"));

  // The gateway bootstraps with the code and sends its first heartbeat: the API publishes
  // device.bootstrapped and device.online, and the page follows without polling.
  const online = await fetch(`${MOCK_API}/__mock/staff/devices/online?serial=GP-GW-000124`, { method: "POST" });
  expect(online.status).toBe(200);
  await expect(page.getByTestId("provision-online")).toContainText("Gateway GP-GW-000124 is online", {
    timeout: 20_000,
  });
});

test("binding wizard: inventory prefill, address validation, install reading photo, identify", async ({ page }) => {
  await devicesOfB(page);
  await page.getByTestId("devices-install").click();
  await hydrated(page);
  const wizard = page.getByTestId("install-wizard");
  await expect(wizard).toHaveAttribute("data-step", "device");
  await scanTyped(page, "sdm120-0042");
  // The device from the building's stock fills in what the installer would otherwise type.
  await expect(page.getByTestId("device-serial")).toHaveValue("SDM120-0042");
  await expect(page.getByLabel("Model")).toHaveValue("SDM120");
  await expect(page.getByLabel("Driver")).toHaveValue("eastron_sdm120");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(wizard).toHaveAttribute("data-step", "point");
  await page.getByText("B-101 · electricity").click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(wizard).toHaveAttribute("data-step", "wiring");
  await expect(page.getByLabel("Gateway")).toHaveValue(GATEWAY_B);
  await page.getByTestId("wiring-address").fill("300");
  await expect(page.getByText("The address must be 1 to 247")).toBeVisible();
  await expect(page.getByTestId("wiring-next")).toBeDisabled();
  await page.getByTestId("wiring-address").fill("12");
  await expect(page.getByTestId("wiring-next")).toBeEnabled();
  await expectTargets48(page.locator("main"));
  await page.getByTestId("wiring-next").click();

  await expect(wizard).toHaveAttribute("data-step", "reading");
  await expect(page.getByTestId("camera-capture")).toHaveAttribute("data-state", "live");
  await expect(page.getByTestId("install-submit")).toBeDisabled();
  await page.getByTestId("camera-shutter").click();
  await expect(page.getByTestId("install-photo")).toBeVisible();
  await typeKeys(page, "100.5");
  await page.getByTestId("install-submit").click();

  await expect(page.getByTestId("install-done")).toContainText("SDM120-0042 now reads B-101, starting at 100.5 kWh");
  const world = await mock<{ channels: { meterAssetItemId: string; address: number | null; busId: string }[] }>(
    "/__mock/staff/devices",
  );
  expect(world.channels.find((channel) => channel.meterAssetItemId === E_B101)).toMatchObject({
    busId: "bus1",
    address: 12,
  });
  const install = (
    await mock<{ assetItemId: string; isInstall: boolean; register: string; evidenceDocumentId: string }[]>(
      "/__mock/staff/readings",
    )
  ).find((reading) => reading.assetItemId === E_B101 && reading.isInstall)!;
  expect(install.register).toBe("100.5");
  expect(install.evidenceDocumentId).toBeTruthy();

  await page.getByRole("button", { name: "Blink the gateway's light (30 s)" }).click();
  await expect(page.getByTestId("identify-status")).toHaveAttribute("data-status", "done", { timeout: 10_000 });
});

test("swap a meter: final and initial registers with photos, reason, one request", async ({ page }) => {
  await devicesOfB(page);
  await page
    .locator(`[data-testid="meter-point"][data-asset="${W_B101}"]`)
    .getByRole("link", { name: "Replace the meter" })
    .click();
  await hydrated(page);
  const wizard = page.getByTestId("swap-wizard");
  await expect(wizard).toHaveAttribute("data-step", "point");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(wizard).toHaveAttribute("data-step", "old");
  await page.getByTestId("camera-shutter").click();
  await typeKeys(page, "60");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(wizard).toHaveAttribute("data-step", "new");
  await page.getByTestId("swap-serial").fill("SN-W-NEW-1");
  await page.getByTestId("camera-shutter").click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(wizard).toHaveAttribute("data-step", "confirm");
  await expect(page.getByTestId("swap-old-register")).toHaveText("60 m³");
  await page.getByLabel("Why it is replaced").fill("หน้าปัดแตก");
  await page.getByTestId("swap-submit").click();
  await expect(page.getByTestId("swap-done")).toBeVisible();

  const world = await mock<{ swaps: { oldAssignmentId: string; finalReadingId: string; firstReadingId: string }[] }>(
    "/__mock/staff/devices",
  );
  expect(world.swaps).toHaveLength(1);
  const swapRequests = await mock<{ idempotencyKey: string | null }[]>(
    `/__mock/requests?path=${encodeURIComponent("/v1/staff/devices/actions/swap")}`,
  );
  expect(swapRequests).toHaveLength(1);
  expect(swapRequests[0]!.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
});

test("gateway detail: identify and the LAN status page", async ({ page }) => {
  await signInStaff(page);
  await gotoStaff(page, `/devices/${GATEWAY_B}`);
  await expect(page.getByTestId("device-detail")).toContainText("GP-GW-000125");
  await page.getByLabel("Gateway IP").fill("10.0.0.7");
  await expect(page.getByTestId("status-page-link")).toHaveAttribute("href", "http://10.0.0.7:8080/");
  await page.getByLabel("Gateway IP").fill("8.8.8.8");
  await expect(page.getByTestId("status-page-link")).toHaveCount(0);
  await expectAxeClean(page);
  await expectTargets48(page.locator("body"));
});
