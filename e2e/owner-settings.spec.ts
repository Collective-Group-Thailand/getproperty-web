import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { platformControl, resetPlatform } from "./support/admin";
import { expectAxeClean } from "./support/staff";
import { gotoOwner, hydrated, received, resetOwner, signInOwner, W } from "./support/owner";

const PROPERTY_BIG = "7b9f1c2e-3d4a-4f5b-8c6d-9e0f1a2b3c5e";
const OPEN_INVOICE = "8b000000-0000-4000-8000-000000000001";

/**
 * F2 2.6 on the mock API: company data (If-Match) and settings with their effective dates — tenant and
 * building — the bank account OTP step, rate plans with the utility cap and the D-021a acknowledgement,
 * members and invitations, notification routing, privacy (consents, DSR inbox), support access, the
 * subscription (plan, usage, invoices with QR and PDF, hardware, upgrade → site survey, read-only banner),
 * reports with exports downloaded through the BFF, insights; axe on each screen.
 */
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetOwner();
  await resetPlatform();
});

test("settings: company data saved with If-Match; effective dates shown; tenant and building settings", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, "/settings");
  await expect(page.getByTestId("company")).toBeVisible();
  await expect(page.getByTestId("company-vat-value")).toHaveText("จดทะเบียนแล้ว");
  await expect(page.locator('[data-testid="setting-row"][data-key="reminders.schedule"]')).toContainText("ตั้งแต่");
  await expectAxeClean(page);

  await page.getByTestId("edit-company").click();
  const company = page.getByRole("dialog");
  await company.getByTestId("company-display-name").fill("หอพักตัวอย่าง (สาขาหลัก)");
  await company.getByTestId("form-submit").click();
  await expect(company).toHaveCount(0);
  await expect(page.getByTestId("company")).toContainText("หอพักตัวอย่าง (สาขาหลัก)");
  const patches = await received("owner.tenant.update");
  expect(patches).toHaveLength(1);

  // Reminder days: a new version now, with its reason; the row shows the new value and its date.
  const reminders = page.getByTestId("settings-table-collections").locator('[data-key="reminders.schedule"]');
  await reminders.getByTestId("edit-reminders.schedule").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("reminder-days").fill("7, 1, 3, 14");
  await dialog.getByTestId("setting-reason").fill("เพิ่มการเตือนวันที่ 14");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(reminders.getByTestId("setting-reminders.schedule")).toContainText("1, 3, 7, 14");
  await expect(reminders).toHaveAttribute("data-scope", "tenant");
  const saved = await received("owner.settings.update");
  expect(saved.at(-1)?.body).toMatchObject({ value: [1, 3, 7, 14], reason: "เพิ่มการเตือนวันที่ 14" });

  // A change scheduled for later is sent with its Bangkok time and does not replace what is in force.
  const photo = page.getByTestId("settings-table-readings").locator('[data-key="readings.require_photo"]');
  await photo.getByTestId("edit-readings.require_photo").click();
  const later = page.getByRole("dialog");
  await later.getByTestId("setting-value").selectOption("false");
  await later.getByTestId("setting-effective").fill("2030-01-01T08:00");
  await later.getByTestId("setting-reason").fill("ช่างอ่านมิเตอร์เองตั้งแต่ปี 2030");
  await later.getByTestId("form-submit").click();
  await expect(later).toHaveCount(0);
  expect((await received("owner.settings.update")).at(-1)?.body).toMatchObject({
    effectiveFrom: "2030-01-01T01:00:00.000Z",
  });
  // …and its history shows the scheduled version above the one in force (GET /settings/{key}/versions).
  await photo.getByTestId("history-readings.require_photo").click();
  const history = page.getByRole("dialog");
  await expect(history.getByTestId("setting-version")).toHaveCount(2);
  await expect(history.getByTestId("setting-version").first()).toHaveAttribute("data-scheduled", "true");
  await expect(history.getByTestId("setting-version").first()).toContainText("ช่างอ่านมิเตอร์เองตั้งแต่ปี 2030");
  await expectAxeClean(page);
  await page.keyboard.press("Escape");
  await expect(history).toHaveCount(0);

  // Building (property) settings: the cut-off of the second property.
  await gotoOwner(page, `/settings?property=${PROPERTY_BIG}`);
  const cutoff = page.getByTestId("settings-table-property").locator('[data-key="billing.cutoff"]');
  await cutoff.getByTestId("edit-billing.cutoff").click();
  const cut = page.getByRole("dialog");
  await cut.getByTestId("cutoff-mode").selectOption("day");
  await cut.getByTestId("cutoff-day").fill("25");
  await cut.getByTestId("setting-reason").fill("ตัดรอบวันที่ 25");
  await cut.getByTestId("form-submit").click();
  await expect(cut).toHaveCount(0);
  await expect(cutoff).toHaveAttribute("data-scope", "property");
  await expect(cutoff.getByTestId("setting-billing.cutoff")).toContainText("25");
  await expectAxeClean(page);
});

test("bank account: details → SMS OTP → a wrong code is refused → confirmed", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/settings/bank-accounts");
  await expect(page.getByTestId("bank-row")).toHaveCount(1);
  await expectAxeClean(page);
  await page.getByTestId("add-bank-account").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("bank-code").selectOption("014");
  await dialog.getByTestId("bank-account-no").fill("123-4-56789-0");
  await dialog.getByTestId("bank-account-name").fill("บริษัท หอพักตัวอย่าง จำกัด");
  await dialog.getByTestId("bank-submit").click();
  const otp = dialog.getByTestId("bank-otp");
  await expect(otp).toBeVisible();
  const created = await received("owner.bankAccounts.create");
  expect(created.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(created.at(-1)?.body).toMatchObject({ accountNo: "1234567890", bankCode: "014" });
  await expectAxeClean(page);

  await otp.getByRole("textbox", { name: /หลักที่ 1/ }).fill("000000");
  await expect(dialog.getByTestId("problem-notice")).toHaveAttribute("data-code", "auth.otp_invalid");
  await otp.getByRole("textbox", { name: /หลักที่ 1/ }).fill("123456");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-testid="bank-row"][data-state="active"]')).toHaveCount(2);
});

test("rate plans: the utility cap and a sample bill; a price above it needs the D-021a acknowledgement", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, "/billing/rate-plans");
  await expect(page.locator('[data-testid="cap-ref"][data-utility="electric"]').getByTestId("cap-rate")).toContainText(
    "150",
  );
  await expect(
    page.locator('[data-testid="rate-plan"][data-plan="ค่าไฟห้องพัก"]').getByTestId("cap-check"),
  ).toContainText("เกินเพดาน");
  await expectAxeClean(page);

  await page.getByTestId("sample-units").fill("200");
  await page.getByTestId("sample-bill").getByRole("button", { name: "คำนวณ" }).click();
  await expect(page.getByTestId("sample-result")).toBeVisible();
  await expect(page.getByTestId("sample-total")).toContainText("฿");

  const plan = page.locator('[data-testid="rate-plan"][data-plan="ค่าไฟห้องพัก"]');
  await plan.getByRole("button", { name: "ราคาใหม่" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("cap-hint")).toContainText("150");
  await dialog.getByTestId("version-price").fill("9.0000");
  await dialog.getByTestId("form-submit").click();
  const warning = dialog.getByTestId("problem-notice");
  await expect(warning).toHaveAttribute("data-code", "compliance.acknowledgement_required");
  await expect(warning).toContainText("ข้อ 4 (6)");
  await warning.getByRole("button", { name: "รับทราบและดำเนินการต่อ" }).click();
  await expect(dialog).toHaveCount(0);
  const versions = await received("owner.ratePlans.saveVersion");
  expect(versions.at(-1)?.body).toMatchObject({
    basis: "per_unit",
    tiers: { kind: "flat", pricePerUnit: "9.0000", unit: "kwh" },
  });
  expect((versions.at(-1)?.body.acknowledgementIds as string[]).length).toBe(1);
  await expect(plan.locator('[data-testid="rate-version"][data-in-force="true"]')).toContainText("9.0000");
  await expect(plan.locator('[data-testid="rate-version"][data-in-force="true"]')).toContainText("รับทราบแล้ว");

  // Water in tiers: built from the rows, within the cap.
  const water = page.locator('[data-testid="rate-plan"][data-plan="ค่าน้ำห้องพัก"]');
  await water.getByRole("button", { name: "ราคาใหม่" }).click();
  const tiers = page.getByRole("dialog");
  await tiers.getByTestId("price-mode").selectOption("tiered");
  await tiers.getByTestId("tier-upto-0").fill("10");
  await tiers.getByTestId("tier-price-0").fill("3.0000");
  await tiers.getByTestId("tier-price-1").fill("4.0000");
  await tiers.getByTestId("form-submit").click();
  await expect(tiers).toHaveCount(0);
  expect((await received("owner.ratePlans.saveVersion")).at(-1)?.body).toMatchObject({
    tiers: {
      kind: "tiered",
      tiers: [
        { fromUnits: "0", toUnits: "10" },
        { fromUnits: "10", toUnits: null },
      ],
    },
  });
  await expectAxeClean(page);
});

test("members, notification routing, privacy and support access", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/settings/members");
  await expect(page.getByTestId("member-row").first()).toBeVisible();
  await expectAxeClean(page);
  await page.getByTestId("invite-member").click();
  const invite = page.getByRole("dialog");
  await invite.getByTestId("invite-role").selectOption("manager");
  await invite.getByRole("textbox").first().fill("0812223344");
  await invite.getByTestId("form-submit").click();
  await expect(page.getByTestId("invitation-code")).not.toBeEmpty();
  await expect(page.getByTestId("invitation-row")).toHaveCount(2);
  expect((await received("owner.invitations.create")).at(-1)?.body).toMatchObject({
    role: "manager",
    channel: "sms",
    phone: "+66812223344",
  });

  await gotoOwner(page, "/settings/notifications");
  await expect(page.getByTestId("route-row").first()).toBeVisible();
  await expectAxeClean(page);
  const sms = page.getByTestId("route-invoice.issued-sms");
  await expect(sms).toHaveAttribute("aria-checked", "false");
  await sms.click();
  await expect(sms).toHaveAttribute("aria-checked", "true");
  // The switch turns on as it is clicked; the PUT may still be on its way to the API (seen on a loaded run).
  await expect
    .poll(async () => (await received("owner.notificationRoutes.update")).at(-1)?.body ?? null)
    .toMatchObject({ eventType: "invoice.issued", channel: "sms", enabled: true });

  await gotoOwner(page, "/settings/privacy");
  // Terms, anonymised analytics (B6.3 benchmarks, D-217) and product updates — as the API seeds them.
  await expect(page.getByTestId("consent-row")).toHaveCount(3);
  await page.getByTestId("consent-operator_product_updates").click();
  await expect(page.getByTestId("consent-operator_product_updates")).toHaveAttribute("aria-checked", "true");
  const dsr = page.getByTestId("dsr-row").first();
  await expect(dsr).toHaveAttribute("data-state", "in_progress");
  await expectAxeClean(page);
  await dsr.getByRole("button", { name: "ดำเนินการให้" }).click();
  const fulfil = page.getByRole("alertdialog");
  const input = fulfil.getByRole("textbox", { name: /^พิมพ์/ });
  await input.fill((await input.getAttribute("placeholder")) ?? "");
  await fulfil.getByRole("button", { name: "ดำเนินการให้" }).click();
  await expect(page.getByTestId("dsr-row").first()).toHaveAttribute("data-state", "fulfilled");
  await expect(page.getByTestId("dsr-row").first().getByRole("button", { name: "เปิดไฟล์ข้อมูล" })).toBeVisible();

  await gotoOwner(page, "/settings/support-access");
  await expect(page.getByTestId("support-row").first()).toHaveAttribute("data-state", "active");
  await expectAxeClean(page);
  await page.getByTestId("support-row").first().getByRole("button", { name: "ยุติสิทธิ์ทันที" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ยุติสิทธิ์ทันที" }).click();
  await expect(page.getByTestId("support-row").first()).toHaveAttribute("data-state", "revoked");
  const grants = await platformControl<{ grants: { tenantId: string; state: string }[] }>("state");
  expect(grants.grants.find((grant) => grant.tenantId === "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11")?.state).toBe(
    "revoked",
  );

  await gotoOwner(page, "/settings/audit-log");
  await expect(page.getByTestId("audit-row").first()).toBeVisible();
  await expectAxeClean(page);
  await gotoOwner(page, "/settings/access-grants");
  await expectAxeClean(page);
});

test("subscription: plan, usage, invoices with Thai QR and PDF, hardware, upgrade → site survey", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/subscription");
  await expect(page.getByTestId("plan-name")).toHaveText("Apartment Starter");
  await expect(page.getByTestId("usage-units")).not.toBeEmpty();
  await expect(page.getByTestId("platform-invoice-row").first()).toBeVisible();
  // D-276: storage against the allowance, with the reassurance that data is never deleted or locked
  await expect(page.getByTestId("storage-used")).toHaveText(/GB$/);
  await expect(page.getByTestId("storage").getByRole("progressbar")).toHaveAttribute("aria-valuetext", /ใช้ไป \d+%/);
  await expect(page.getByTestId("storage-note")).toContainText("ไม่ถูกลบหรือล็อก");
  await expectAxeClean(page);

  const surveys = await page.getByTestId("survey-row").count();
  await page.getByTestId("upgrade-smart").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("upgrade-building").selectOption(W.buildingA);
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("survey-row")).toHaveCount(surveys + 1);
  expect((await received("owner.subscription.upgrade")).at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);

  await gotoOwner(page, `/subscription/invoices/${OPEN_INVOICE}`);
  await expect(page.getByTestId("qr-image")).toBeVisible();
  // The popup asks for the signed URL; headless Chromium downloads the PDF, so the popup itself never leaves
  // about:blank — assert on the context-wide request instead of the popup's URL.
  const popup = page.waitForEvent("popup");
  const signed = page.context().waitForEvent("request", (request) => request.url().includes("/__files/"));
  await page.getByTestId("platform-invoice-pdf").click();
  await popup;
  await signed;
  await expectAxeClean(page);
});

test("a suspended tenant: the subscription page says read-only and what to do", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, "0810000003");
  await gotoOwner(page, "/subscription");
  await expect(page.getByTestId("subscription-read-only")).toBeVisible();
  await expect(page.getByTestId("upgrade-smart")).toHaveCount(0);
  await expectAxeClean(page);
});

test("reports: exports for the month downloaded through the BFF; VAT figures; insights", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/reports?period=2026-09");
  await expect(page.getByTestId("period-label")).toContainText("2569");
  await expect(page.locator('[data-testid="export-card"][data-kind="vat_pp30"]')).toBeVisible();
  await expect(page.getByTestId("pilot-kpis").locator("tbody tr")).toHaveCount(7);
  await expectAxeClean(page);

  const card = page.getByTestId("export-income_expense");
  await card.getByRole("button").click();
  const link = card.getByTestId("export-download");
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/bff\/exports\/[0-9a-f-]{36}\/download$/);
  expect((await received("owner.exports.create")).at(-1)?.body).toMatchObject({
    kind: "income_expense",
    params: { period: "2026-09" },
  });
  const response = await page.request.get(`${HOSTS.owner}${href}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain('filename="income_expense-2026-09.xlsx"');
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect((await response.body()).byteLength).toBeGreaterThan(0);
  // Another tenant's export id is refused by the API behind the BFF.
  expect(
    (await page.request.get(`${HOSTS.owner}/bff/exports/00000000-0000-4000-8000-000000000000/download`)).status(),
  ).toBe(404);
  await hydrated(page);
});
