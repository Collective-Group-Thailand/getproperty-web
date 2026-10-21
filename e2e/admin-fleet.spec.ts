import { expect, test } from "@playwright/test";

import {
  gotoAdmin,
  P,
  platformControl,
  platformReceived,
  resetPlatform,
  signInPlatform,
  typePhrase,
} from "./support/admin";
import { expectAxeClean } from "./support/staff";

const MANIFEST = {
  schema: 1,
  version: "0.5.0",
  arch: "arm64",
  channel: "stable",
  releasedAt: "2026-10-19T03:00:00Z",
  minAgentVersion: "0.3.0",
  artifact: {
    url: "https://device.getproperty.example/v1/device/ota/artifacts/0.5.0/getproperty-edge-0.5.0-linux-arm64",
    sha256: "ab".repeat(32),
    size: 18_234_112,
  },
  signature: { alg: "ed25519", keyId: "gp-ota-2026", value: "bWFuaWZlc3Qtc2lnbmF0dXJl" },
};

/**
 * F5 5.3 on the mock API: the fleet (online / degraded / offline per building, stock, filters), CSV
 * inventory import refused then accepted, a gateway's config applied against the version published,
 * commands and the log upload, ring, assignment and certificate revocation (typed), OTA releases and a
 * ring rollout whose progress arrives over SSE (no reload) with pause / resume / abort, and ingest
 * dead-letter replay; axe on each screen.
 */
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetPlatform();
});

test("fleet: connectivity per building, stock, filters; CSV import refused then imported", async ({ page }) => {
  await signInPlatform(page, "engineer");
  await gotoAdmin(page, "/devices");
  await expect(page.getByTestId("fleet-online")).toHaveText("1");
  await expect(page.getByTestId("fleet-offline")).toHaveText("1");
  await expect(page.getByTestId("fleet-degraded")).toHaveText("1");
  await expect(page.getByTestId("fleet-building").first()).toHaveAttribute("data-offline", "1");
  await expectAxeClean(page);
  await page.getByTestId("filter-status").selectOption("inventory");
  await expect(page).toHaveURL(/status=inventory/);
  await expect(page.locator('[data-testid="device-row"]:not([data-status="inventory"])')).toHaveCount(0);

  await page.getByTestId("import-devices").click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByTestId("import-csv")
    .fill("serial,kind,model,vendor\nGW-0100,gateway,GP-GW1,Collective\nX-1,toaster,T1,Acme");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog.getByTestId("import-error")).toHaveCount(1);
  await expect(dialog.getByTestId("import-error")).toContainText("Line 3");
  await dialog
    .getByTestId("import-csv")
    .fill(
      "serial,kind,model,vendor,driver,ownership\nGW-0100,gateway,GP-GW1,Collective,,platform_haas\nEM-9100,electric_meter,SDM120,Eastron,eastron_sdm120,platform_haas",
    );
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  const imports = await platformReceived("admin.devices.import");
  expect(imports.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await gotoAdmin(page, "/devices?q=GW-0100");
  await expect(page.getByTestId("device-row")).toHaveCount(1);
});

test("gateway: config applied vs published, commands with the log file, ring, revoke typed", async ({ page }) => {
  await signInPlatform(page, "engineer");
  await gotoAdmin(page, `/devices/${P.gwGarden}`);
  await expect(page.getByTestId("device-config")).toHaveAttribute("data-in-sync", "false");
  await expect(page.getByTestId("config-versions")).toContainText("v4");
  await expect(page.getByTestId("config-versions")).toContainText("v3");
  await expect(page.getByTestId("command-row").first()).toHaveAttribute("data-type", "upload_logs");
  await expectAxeClean(page);

  await page.getByTestId("send-command").click();
  const command = page.getByRole("dialog");
  await command.getByTestId("command-type").selectOption("identify");
  await command.getByTestId("form-submit").click();
  await expect(command).toHaveCount(0);
  await expect(page.locator('[data-testid="command-row"][data-type="identify"]')).toHaveCount(1);

  await page.getByTestId("set-ring").click();
  const ring = page.getByRole("dialog");
  await ring.getByTestId("ring-select").selectOption("pilot");
  await ring.getByTestId("form-submit").click();
  await expect(ring).toHaveCount(0);
  expect((await platformReceived("admin.devices.setRing")).at(-1)?.body).toMatchObject({ otaRing: "pilot" });

  await page.getByTestId("revoke-certificates").click();
  const revoke = page.getByRole("alertdialog");
  await revoke.getByTestId("revoke-reason").fill("Gateway reported stolen from the meter room");
  await typePhrase(revoke);
  await revoke.getByRole("button", { name: "Revoke certificates" }).click();
  await expect(revoke).toHaveCount(0);
  await expect
    .poll(async () => (await platformReceived("admin.devices.revokeCertificates")).at(-1)?.idempotencyKey)
    .toMatch(/^[0-9a-f-]{36}$/);
});

test("inventory gateway: assign to a tenant's building", async ({ page }) => {
  await signInPlatform(page, "engineer");
  await gotoAdmin(page, `/devices/${P.gwStock}`);
  await page.getByTestId("assign-device").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("assign-tenant").selectOption({ value: P.sample });
  await dialog.getByTestId("assign-building").selectOption({ index: 0 });
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  expect((await platformReceived("admin.devices.assign")).at(-1)?.body).toMatchObject({ tenantId: P.sample });
  await expect(page.getByTestId("provisioning-code")).toBeVisible();
  await page.getByTestId("provisioning-code").click();
  await expect(page.getByTestId("provisioning-code-value")).toHaveText(/^GP-/);
  await expectAxeClean(page);
});

test("OTA: register a signed release, plan a rollout; progress arrives over SSE; pause, resume, abort", async ({
  page,
}) => {
  await signInPlatform(page, "engineer");
  await gotoAdmin(page, "/ota");
  await expect(page.getByTestId("rollout-row").first()).toBeVisible();
  await expectAxeClean(page);

  await page.getByTestId("register-release").click();
  const register = page.getByRole("dialog");
  await register.getByTestId("release-manifest").fill(JSON.stringify(MANIFEST));
  await register.getByTestId("form-submit").click();
  // D-231: the binary is not in the product bucket yet — the form says which key to upload, and keeps the manifest.
  const notice = register.getByTestId("problem-notice");
  await expect(notice).toHaveAttribute("data-code", "ota.artifact_missing");
  await expect(notice).toContainText("releases/edge/0.5.0/getproperty-edge-0.5.0-linux-arm64");
  await expect(notice).toContainText("release-publisher");
  await expect(register.getByTestId("release-manifest")).toHaveValue(JSON.stringify(MANIFEST));
  await expectAxeClean(page);
  await platformControl(
    `ota/upload?key=releases/edge/0.5.0/getproperty-edge-0.5.0-linux-arm64&size=${MANIFEST.artifact.size}`,
    "POST",
  );
  await register.getByTestId("form-submit").click();
  await expect(register).toHaveCount(0);
  await expect(page.locator('[data-testid="release-row"][data-version="0.5.0"]')).toBeVisible();

  // The running canary rollout of 0.4.0: one gateway commanded, one applied.
  await gotoAdmin(page, `/ota/rollouts/${P.rollout}`);
  const live = page.getByTestId("rollout-live");
  await expect(live).toHaveAttribute("data-status", "running");
  await expect(page.getByTestId("count-applied")).toHaveText("1");
  await expectAxeClean(page);
  await platformControl(`ota/advance?rollout=${P.rollout}`, "POST");
  await expect(page.getByTestId("count-started")).toHaveText("1");
  await platformControl(`ota/advance?rollout=${P.rollout}`, "POST");
  await expect(page.getByTestId("count-applied")).toHaveText("2");
  await expect(live).toHaveAttribute("data-status", "completed");
  // Updated in place by the realtime events, not by a reload.
  expect(Number(await live.getAttribute("data-updates"))).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", /^\d+$/);

  // Pilot ring of the same release, now that canary completed: plan, start, pause, resume, abort.
  await gotoAdmin(page, "/ota");
  await page.getByTestId("plan-0.4.0-arm64").click();
  const plan = page.getByRole("dialog");
  await plan.getByTestId("rollout-ring").selectOption("pilot");
  await plan.getByTestId("form-submit").click();
  await expect(page).toHaveURL(/\/ota\/rollouts\//);
  await expect(page.getByTestId("rollout-live")).toHaveAttribute("data-status", "planned");
  await page.getByTestId("rollout-start").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("rollout-live")).toHaveAttribute("data-status", "running");
  await page.getByTestId("rollout-pause").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Pause" }).click();
  await expect(page.getByTestId("rollout-live")).toHaveAttribute("data-status", "paused");
  await page.getByTestId("rollout-resume").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Resume" }).click();
  await expect(page.getByTestId("rollout-live")).toHaveAttribute("data-status", "running");
  await page.getByTestId("rollout-abort").click();
  const abort = page.getByRole("alertdialog");
  await typePhrase(abort);
  await abort.getByRole("button", { name: "Abort" }).click();
  await expect(page.getByTestId("rollout-live")).toHaveAttribute("data-status", "aborted");
  await expect(page.getByTestId("rollout-controls").getByRole("button")).toHaveCount(0);
});

test("ingest dead letters: replay a refused payload", async ({ page }) => {
  await signInPlatform(page, "engineer");
  await gotoAdmin(page, "/ingest-dead-letters?replayed=false");
  const row = page.locator('[data-testid="ingest-row"][data-replayed="false"]').first();
  await expect(row).toBeVisible();
  await expectAxeClean(page);
  await row.getByRole("button", { name: "Replay" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Replay" }).click();
  await expect(page.locator('[data-testid="ingest-row"][data-replayed="false"]')).toHaveCount(0);
});
