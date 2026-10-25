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

/**
 * F5 5.2 on the mock API: the tariff manager — a version entered with the structure editor, verified
 * by a second user only (the maker is never offered `verify`), published with the date typed, diffed
 * against the version in force, and a sample bill at the new version — then platform settings
 * (effective-dated), notification templates (preview, test send, publish), the DSR console, audit search
 * with cursor pages, the outbox with replay and platform users; axe on each screen.
 */
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetPlatform();
});

test("tariff: enter → second person verifies → publish; diff and sample bill", async ({ page, browser }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/tariffs");
  await expect(page.getByTestId("tariff-row").first()).toBeVisible();
  await expectAxeClean(page);

  await gotoAdmin(page, `/tariffs/${P.tariffMea}`);
  await page.getByTestId("enter-version").click();
  const editor = page.getByRole("dialog");
  await editor.getByTestId("tariff-effective-from").fill("2030-01-01");
  await editor.getByTestId("tariff-source-url").fill("https://www.mea.or.th/tariff-2030");
  // A copy of the notice goes up as a platform file (/v1/admin/files presign → PUT → complete).
  await editor
    .getByTestId("tariff-source-file")
    .locator('input[type="file"]')
    .setInputFiles({
      name: "mea-2030.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% MEA tariff notice 2030\n"),
    });
  await expect(editor.getByTestId("tariff-source-file-name")).toContainText("mea-2030.pdf");
  await editor.getByTestId("ft-price").fill("0.4200");
  await editor.getByTestId("ft-period").fill("2030-01");
  await editor.getByTestId("enter-version-submit").click();
  await expect(editor).toHaveCount(0);
  const entered = await platformReceived("admin.utilityTariffs.enter");
  expect(entered.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(entered.at(-1)?.body).toMatchObject({
    effectiveFrom: "2030-01-01",
    structure: { ft: { pricePerUnit: "0.4200" } },
  });
  expect(entered.at(-1)?.body.sourceDocumentId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.locator('[data-testid^="source-document-"]')).toHaveCount(1);

  const workflow = page.getByTestId("tariff-workflow");
  await expect(workflow).toHaveAttribute("data-state", "entered");
  // The maker cannot verify their own version (D-021a two-person rule).
  await expect(page.getByTestId("verify-version")).toHaveCount(0);
  await expect(page.getByTestId("diff-row").first()).toBeVisible();
  await expect(page.locator('[data-testid="diff-row"][data-path="ft.pricePerUnit"]')).toContainText("0.4200");

  await page.getByTestId("sample-units").fill("150");
  await page.getByTestId("sample-form").getByRole("button").click();
  await expect(page.getByTestId("sample-result").getByTestId("charge")).toHaveCount(2);
  await expect(page.getByTestId("charge-total").first()).toContainText("฿");
  await expectAxeClean(page);

  const checker = await browser.newPage();
  await signInPlatform(checker, "checker");
  await gotoAdmin(checker, `/tariffs/${P.tariffMea}`);
  await checker.getByTestId("verify-version").click();
  const verify = checker.getByRole("alertdialog");
  const confirm = verify.getByRole("button", { name: "Verify" });
  await expect(confirm).toBeDisabled();
  await verify.getByRole("checkbox").click();
  await confirm.click();
  await expect(checker.getByTestId("tariff-workflow")).toHaveAttribute("data-state", "verified");
  await checker.getByTestId("publish-version").click();
  const publish = checker.getByRole("alertdialog");
  await typePhrase(publish);
  await publish.getByRole("button", { name: "Publish" }).click();
  await expect(publish).toHaveCount(0);
  // The version of 2030 (2573 in the Buddhist era) is published; the stepper moves on to the next pending one, if any.
  await expect(
    checker.locator('[data-testid="tariff-version"][data-state="published"]').filter({ hasText: /2030|2573/ }),
  ).toHaveCount(1);
  await checker.close();

  const state = await platformControl<{
    tariffs: {
      id: string;
      versions: { effectiveFrom: string; state: string; enteredBy: string; verifiedBy: string }[];
    }[];
  }>("state");
  const version = state.tariffs
    .find((tariff) => tariff.id === P.tariffMea)!
    .versions.find((v) => v.effectiveFrom === "2030-01-01")!;
  expect(version.state).toBe("published");
  expect(version.verifiedBy).not.toBe(version.enteredBy);
});

test("platform settings: a new effective-dated version with a reason", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/settings?q=support.");
  const row = page.locator('[data-testid="setting-row"][data-key="support.grant_max_hours"]');
  await expect(row).toBeVisible();
  await expectAxeClean(page);
  await row.getByTestId("edit-support.grant_max_hours").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("setting-value").fill("12");
  await dialog.getByTestId("setting-reason").fill("Shorter support windows after the PDPA review");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("setting-value-support.grant_max_hours")).toHaveText("12");
});

test("storage (D-279): 5 GB free per type, an overage price and a pack set here; every tenant's usage", async ({
  page,
}) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/subscriptions/storage");
  const landlord = page.locator('[data-testid="storage-type-row"][data-type="landlord"]');
  await expect(landlord).toContainText("5 GB");
  await expect(landlord).toContainText("Not sold"); // platform users read the admin console in English
  await expect(page.getByTestId("storage-usage-row")).toHaveCount(4);
  await expect(page.getByTestId("storage-near-or-over")).toHaveText("2");
  await expectAxeClean(page);

  await page.getByTestId("edit-storage-allowance").click();
  let dialog = page.getByRole("dialog");
  await dialog.getByTestId("storage-price-landlord").fill("2.50");
  await dialog.getByTestId("storage-reason").fill("Sell extra space to landlords");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(landlord).toContainText("2.50");
  const sent = (await platformReceived("admin.settings.update")).at(-1)?.body;
  expect(sent?.value).toEqual({ apartment: null, condo_juristic: null, pm_company: null, landlord: "2.50" });

  await page.getByTestId("edit-storage-packs").click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Pack code 1").fill("plus-20");
  await dialog.getByLabel("GB 1", { exact: true }).fill("20");
  await dialog.getByLabel("THB/month 1").fill("49");
  await dialog.getByTestId("storage-reason").fill("First pack");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("storage-packs")).toContainText("+20 GB");
});

test("templates: preview a draft with sample data, send a test, publish", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/notification-templates");
  await expect(page.getByTestId("template-row").first()).toBeVisible();
  await expectAxeClean(page);
  await page.locator('[data-testid="template-row"][data-key="invoice.issued"]').getByRole("link").click();
  await expect(page.getByTestId("template-detail")).toBeVisible();
  const draft = page.locator('[data-testid="template-version"][data-state="draft"]').first();
  await draft.getByTestId("preview-template").click();
  const preview = page.getByRole("dialog");
  await preview.getByRole("button", { name: "Render" }).click();
  await expect(preview.getByTestId("template-preview")).toBeVisible();
  await preview.getByRole("button", { name: "Close" }).first().click();
  await page
    .locator('[data-testid="template-version"][data-state="published"]')
    .first()
    .getByTestId("test-send")
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Send me a test" }).click();
  await expect
    .poll(async () => (await platformControl<{ testSends: unknown[] }>("state")).testSends.length)
    .toBeGreaterThan(0);
  await draft.getByTestId("publish-template").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.locator('[data-testid="template-version"][data-state="draft"]')).toHaveCount(0);
  await expectAxeClean(page);
});

test("DSR console, audit search with cursor pages, outbox replay", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/privacy");
  await expect(page.getByTestId("dsr-overdue")).toBeVisible();
  await expect(page.getByTestId("dsr-row").first()).toHaveAttribute("data-overdue", "true");
  await expectAxeClean(page);
  // A request where Collective is the controller (tenantId null) is moved here: verify → start → fulfil (typed).
  const own = "9f000000-0000-4000-8000-000000000004";
  // Tenant-controlled requests offer no action on the platform.
  await expect(page.getByTestId("dsr-actions-9f000000-0000-4000-8000-000000000001")).toHaveCount(0);
  for (const [action, label] of [
    ["verify", "Verify identity"],
    ["start", "Start"],
  ] as const) {
    await page.getByTestId(`dsr-${action}-${own}`).click();
    await page.getByRole("alertdialog").getByRole("button", { name: label }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  }
  await page.getByTestId(`dsr-fulfil-${own}`).click();
  const fulfil = page.getByRole("alertdialog");
  await typePhrase(fulfil);
  await fulfil.getByRole("button", { name: "Fulfil" }).click();
  await expect(fulfil).toHaveCount(0);
  await expect(page.getByTestId(`dsr-export-${own}`)).toBeVisible();
  const moved = await platformReceived("admin.dataSubjectRequests.transition");
  expect(moved).toHaveLength(3);
  await expectAxeClean(page);

  await gotoAdmin(page, "/audit");
  await expect(page.getByTestId("audit-row").first()).toBeVisible();
  await expectAxeClean(page);
  await page.getByTestId("filter-action").fill("support_grant.*");
  await page.getByTestId("filter-apply").click();
  await expect(page).toHaveURL(/action=support_grant/);
  for (const action of await page
    .getByTestId("audit-row")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-action"))))
    expect(action).toMatch(/^support_grant\./);

  await gotoAdmin(page, "/outbox");
  const dead = page.locator('[data-testid="outbox-message"][data-state="dead"]').first();
  await expect(dead).toBeVisible();
  await expectAxeClean(page);
  await dead.getByRole("button", { name: "Replay" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Replay" }).click();
  await expect(page.locator('[data-testid="outbox-message"][data-state="dead"]')).toHaveCount(0);
  await page
    .locator('[data-testid="outbox-delivery"][data-state="dead"]')
    .first()
    .getByRole("button", { name: "Replay" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Replay" }).click();
  await expect(page.locator('[data-testid="outbox-delivery"][data-state="dead"]')).toHaveCount(0);
});

test("platform users: create with roles, grant and revoke a role; integration events placeholder", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/platform-users");
  await expect(page.getByTestId("user-row").first()).toBeVisible();
  await expectAxeClean(page);
  await page.getByTestId("create-user").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("user-name").fill("Nida Finance");
  await dialog.getByTestId("user-email").fill("nida@example.com");
  await dialog.getByTestId("user-role-finance").click();
  await dialog.getByTestId("user-password").fill("temporary-password-123");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  const row = page.locator('[data-testid="user-row"][data-email="nida@example.com"]');
  await expect(row.getByTestId("user-role")).toHaveCount(1);
  await row.getByRole("button", { name: "Grant a role" }).click();
  const grant = page.getByRole("dialog");
  await grant.getByTestId("grant-role").selectOption("support");
  await grant.getByTestId("form-submit").click();
  await expect(row.getByTestId("user-role")).toHaveCount(2);
  await row.locator('[data-role="support"]').getByRole("button", { name: "Revoke" }).click();
  const revoke = page.getByRole("alertdialog");
  await typePhrase(revoke);
  await revoke.getByRole("button", { name: "Revoke" }).click();
  await expect(row.getByTestId("user-role")).toHaveCount(1);
  const created = await platformReceived("admin.platformUsers.create");
  expect(created.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);

  // Integration events of the bridge (GET /v1/admin/integration-events): filters in the URL, no payloads.
  await gotoAdmin(page, "/integration-events");
  await expect(page.getByTestId("integration-event")).toHaveCount(3);
  await expectAxeClean(page);
  await page.getByTestId("filter-state").selectOption("dead");
  await page.getByTestId("integration-filters").getByRole("button").click();
  await expect(page).toHaveURL(/state=dead/);
  await expect(page.getByTestId("integration-event")).toHaveCount(1);
  await expect(page.getByTestId("integration-event")).toHaveAttribute("data-state", "dead");
  await expect(page.getByTestId("integration-event")).toContainText("getbuild bridge 503");
});
