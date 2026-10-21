import { expect, test } from "@playwright/test";

import { gotoAdmin, P, platformReceived, resetPlatform, signInPlatform, typePhrase } from "./support/admin";
import { expectAxeClean } from "./support/staff";

/**
 * F11-4 (D-240) on the mock API: provider credentials — the platform page reached from the settings (no menu
 * key), the platform merchant set with write-only values (never shown again: not in the page, not in the
 * reopened form), a tenant's credentials on its own tab (rotate replaces the live one; the form refuses an
 * empty value before sending), revoke typed with the fingerprint; Idempotency-Key on every POST; the tab is
 * hidden from a platform user without `admin.provider_credential.manage`; axe on each screen and dialog.
 */
test.describe.configure({ mode: "serial" });

const SECRET = "sk_live_DO-NOT-SHOW-7f3a";

test.beforeAll(async () => {
  await resetPlatform();
});

test("platform merchant: list and filters, set with write-only values that are never shown again", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/settings");
  await page.getByTestId("provider-credentials-link").click();
  await expect(page.getByTestId("provider-credentials-page")).toBeVisible();
  await expect(page.getByTestId("credential-audit-note")).toContainText("provider_credential.decrypted");
  await expect(page.locator('[data-testid="credential-row"][data-live="true"]')).toHaveCount(3);
  await expectAxeClean(page);

  await page.getByTestId("filter-state").selectOption("all");
  await expect(page.getByTestId("credential-row")).toHaveCount(4);
  await expect(page.locator('[data-testid="credential-row"][data-live="false"]')).toContainText("replaced:");
  await page.getByTestId("filter-tenant").selectOption("platform");
  await expect(page).toHaveURL(/tenant=platform/);
  await expect(page.getByTestId("credential-row")).toHaveCount(1);
  await expect(page.getByTestId("credential-row")).toHaveAttribute("data-provider", "scb");

  await page.getByTestId("set-credential").click();
  const dialog = page.getByRole("dialog");
  // The platform's own merchant takes payment credentials only.
  await expect(dialog.getByTestId("credential-kind")).toBeDisabled();
  await dialog.getByTestId("credential-provider").selectOption("scb");
  await expect(dialog.getByTestId("credential-key")).toHaveCount(4);
  await expect(dialog.getByTestId("credential-value").first()).toHaveAttribute("type", "password");
  await expect(dialog.getByTestId("credential-value").first()).toHaveAttribute("autocomplete", "new-password");
  await expectAxeClean(page);
  await dialog.getByTestId("credential-merchant-ref").fill("SCB-BILLER-7781");
  const values = dialog.getByTestId("credential-value");
  for (let index = 0; index < 4; index += 1) await values.nth(index).fill(`${SECRET}-${index}`);
  await dialog.getByTestId("credential-reason").fill("New SCB keys from the bank portal (FIN-2026-031)");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);

  const sent = (await platformReceived("admin.providerCredentials.set")).at(-1);
  expect(sent?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(sent?.body).toMatchObject({
    tenantId: null,
    kind: "payment",
    provider: "scb",
    merchantRef: "SCB-BILLER-7781",
    values: { apiKey: `${SECRET}-0`, apiSecret: `${SECRET}-1`, billerId: `${SECRET}-2`, webhookSecret: `${SECRET}-3` },
  });
  // Replaced, not added: still one live platform credential, now with another fingerprint.
  await expect(page.getByTestId("credential-row")).toHaveCount(2);
  await expect(page.locator('[data-testid="credential-row"][data-live="true"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="credential-row"][data-live="true"]')).not.toHaveAttribute(
    "data-fingerprint",
    "e21c6a8b0f44",
  );
  await expect(page.locator("body")).not.toContainText(SECRET);
  // Reopening the form starts empty: nothing of the values stayed in the page.
  await page.getByTestId("set-credential").click();
  const again = page.getByRole("dialog");
  for (const value of await again.getByTestId("credential-value").all()) await expect(value).toHaveValue("");
  await again.getByRole("button", { name: /^(Cancel|ยกเลิก)$/ }).click();
});

test("tenant tab: the form checks the document, rotate replaces the live credential, revoke is typed", async ({
  page,
}) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, `/tenants/${P.sample}`);
  await page.getByTestId("tenant-tab-credentials").click();
  await expect(page.getByTestId("tenant-credentials")).toBeVisible();
  await expect(page.locator('[data-testid="credential-row"][data-live="true"]')).toHaveCount(2);
  await expectAxeClean(page);

  // e-Tax for this tenant: an empty value is refused before anything is sent.
  const before = (await platformReceived("admin.providerCredentials.set")).length;
  await page.getByTestId("set-credential").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("credential-kind").selectOption("etax");
  await expect(dialog.getByTestId("credential-provider")).toHaveValue("inet");
  await expect(dialog.getByTestId("credential-merchant-ref")).toHaveCount(0);
  await expect(dialog.getByTestId("credential-key")).toHaveCount(3);
  await dialog.getByTestId("credential-value").nth(0).fill("inet-api-key");
  await dialog.getByTestId("credential-value").nth(1).fill("U-1234");
  await dialog.getByTestId("credential-reason").fill("INET account opened for e-Tax (OPS-2026-130)");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog.getByTestId("credential-problems")).toBeVisible();
  expect((await platformReceived("admin.providerCredentials.set")).length).toBe(before);
  await dialog.getByTestId("credential-value").nth(2).fill("inet-access-key");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-testid="credential-row"][data-kind="etax"]')).toHaveCount(1);

  // Rotate the TTLock account: kind and provider fixed, its key names as rows; the old one is replaced.
  const ttlock = page.locator('[data-testid="credential-row"][data-provider="ttlock"]');
  const oldFingerprint = await ttlock.getAttribute("data-fingerprint");
  await ttlock.getByTestId("rotate-credential").click();
  const rotate = page.getByRole("dialog");
  await expect(rotate.getByTestId("credential-provider")).toBeDisabled();
  await expect(rotate.getByTestId("credential-key")).toHaveCount(4);
  for (const value of await rotate.getByTestId("credential-value").all()) await value.fill("rotated-value");
  await rotate.getByTestId("credential-reason").fill("TTLock password changed (OPS-2026-131)");
  await rotate.getByTestId("form-submit").click();
  await expect(rotate).toHaveCount(0);
  await expect(page.locator('[data-testid="credential-row"][data-provider="ttlock"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="credential-row"][data-provider="ttlock"]')).not.toHaveAttribute(
    "data-fingerprint",
    oldFingerprint ?? "",
  );

  // Revoke the KBank merchant: typed with its fingerprint, a reason and an incident reference.
  const kbank = page.locator('[data-testid="credential-row"][data-provider="kbank"]');
  await kbank.getByTestId("revoke-credential").click();
  const revoke = page.getByRole("alertdialog");
  await expect(revoke).toContainText("QR");
  const confirm = revoke.getByRole("button", { name: /^(Revoke|เพิกถอน)$/ });
  await revoke.getByTestId("revoke-reason").fill("Key leaked in a support e-mail");
  await expect(confirm).toBeDisabled();
  await typePhrase(revoke);
  await expectAxeClean(page);
  await confirm.click();
  await expect(revoke).toHaveCount(0);
  await expect(page.locator('[data-testid="credential-row"][data-provider="kbank"]')).toHaveCount(0);
  const revoked = (await platformReceived("admin.providerCredentials.revoke")).at(-1);
  expect(revoked?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(revoked?.body).toMatchObject({ reason: "Key leaked in a support e-mail" });

  await page.getByTestId("filter-state").selectOption("all");
  await expect(page.locator('[data-testid="credential-row"][data-provider="kbank"]')).toContainText(
    "Key leaked in a support e-mail",
  );
});

test("a platform user without the permission sees no credentials tab", async ({ page }) => {
  await signInPlatform(page, "engineer");
  await gotoAdmin(page, `/tenants/${P.sample}`);
  await expect(page.getByTestId("tenant-tab-flags")).toBeVisible();
  await expect(page.getByTestId("tenant-tab-credentials")).toHaveCount(0);
});
