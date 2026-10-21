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
 * F5 5.1 on the mock API: tenants and their health, the subscription with typed suspend / reinstate and
 * a plan change, platform invoices with a payment and a credit note that a second person approves,
 * HaaS and field work, the pilot agreement with its seven KPIs, AI usage, per-tenant flags, and support
 * grants with the read-only "view as tenant" — no mutation control rendered — with axe on each screen.
 */
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetPlatform();
});

test("tenants: list with search, overview with health and signals", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, "/tenants");
  await expect(page.getByTestId("tenant-row").first()).toBeVisible();
  await expectAxeClean(page);
  await gotoAdmin(page, "/tenants?q=sample");
  await expect(page.getByTestId("tenant-row")).toHaveCount(1);
  await page.getByTestId("tenant-row").getByRole("link").click();
  await expect(page.getByTestId("tenant-title")).toBeVisible();
  await expect(page.getByTestId("tenant-health")).toBeVisible();
  await expect(page.getByTestId("health-units")).not.toBeEmpty();
  await expect(page.getByTestId("health-gateways")).toContainText("of");
  await expectAxeClean(page);
});

test("subscription: change plan, suspend and reinstate with the slug typed", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, `/tenants/${P.sample}/subscription`);
  await expect(page.getByTestId("subscription")).toHaveAttribute("data-state", "active");
  await expectAxeClean(page);

  await page.getByTestId("suspend").click();
  const suspend = page.getByRole("alertdialog");
  await suspend.getByTestId("suspend-reason").fill("Invoice PIV-2026-000041 unpaid for 45 days");
  await typePhrase(suspend);
  await suspend.getByRole("button", { name: "Suspend" }).click();
  await expect(page.getByTestId("subscription")).toHaveAttribute("data-state", "suspended");
  const suspended = await platformReceived("admin.subscriptions.suspend");
  expect(suspended.at(-1)?.body).toMatchObject({ confirm: "sample-dorm" });

  await page.getByTestId("reinstate").click();
  const reinstate = page.getByRole("alertdialog");
  await reinstate.getByTestId("reinstate-reason").fill("Paid by transfer");
  await typePhrase(reinstate);
  await reinstate.getByRole("button", { name: "Reinstate" }).click();
  await expect(page.getByTestId("subscription")).toHaveAttribute("data-state", "active");

  await page.getByTestId("change-plan").click();
  const change = page.getByRole("dialog");
  await change.getByRole("combobox").first().selectOption({ label: "Apartment Smart" });
  await change.getByTestId("form-submit").click();
  await expect(change).toHaveCount(0);
  const state = await platformControl<{ subscriptions: { tenantId: string; plan: { key: string } }[] }>("state");
  expect(state.subscriptions.find((sub) => sub.tenantId === P.sample)?.plan.key).toBe("apartment_smart");
  // Plan changes, suspensions and reinstatements carry an Idempotency-Key (required since api 048a8bd).
  for (const op of ["admin.subscriptions.changePlan", "admin.subscriptions.suspend", "admin.subscriptions.reinstate"])
    expect((await platformReceived(op)).at(-1)?.idempotencyKey, op).toMatch(/^[0-9a-f-]{36}$/);
  await expectAxeClean(page);
});

test("platform invoices: record a payment; a credit note needs a second person", async ({ page, browser }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, `/subscriptions/invoices/${P.invoiceOpen}`);
  await expect(page.getByTestId("platform-invoice-state")).toBeVisible();
  await expect(page.getByTestId("qr-image")).toBeVisible();
  await expectAxeClean(page);

  await page.getByTestId("request-credit-note").click();
  const credit = page.getByRole("alertdialog");
  await credit.getByTestId("credit-amount").fill("100.00");
  await credit.getByTestId("credit-reason").fill("Two rooms counted twice");
  await credit.getByRole("button", { name: /credit note/i }).click();
  await expect(credit).toHaveCount(0);
  // The maker is not offered the decision on their own credit note.
  await expect(page.getByTestId("approve-credit-note")).toHaveCount(0);

  const checker = await browser.newPage();
  await signInPlatform(checker, "checker");
  await gotoAdmin(checker, `/subscriptions/invoices/${P.invoiceOpen}`);
  await checker.getByTestId("approve-credit-note").click();
  const approve = checker.getByRole("alertdialog");
  await typePhrase(approve);
  await approve.getByRole("button", { name: "Approve" }).click();
  await expect(checker.getByTestId("approve-credit-note")).toHaveCount(0);
  const approvals = await platformReceived("admin.platformInvoices.approveCreditNote");
  expect(approvals.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await checker.close();

  await page.reload();
  await page.getByTestId("record-payment").click();
  const payment = page.getByRole("alertdialog");
  await payment.getByTestId("payment-reference").fill("KB-778812");
  await payment.getByTestId("payment-paid-at").fill("2026-10-20T10:00");
  await typePhrase(payment);
  await payment.getByRole("button", { name: "Record a payment" }).click();
  await expect(page.getByTestId("platform-invoice-state")).toContainText(/Paid/);
});

test("hardware and field work: the HaaS register and site surveys", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, `/tenants/${P.sample}/hardware`);
  await expect(page.getByTestId("haas-row").first()).toBeVisible();
  await expectAxeClean(page);
  await gotoAdmin(page, `/tenants/${P.sample}/field-work`);
  await expect(page.getByTestId("site-survey-row").first()).toBeVisible();
  await page.getByTestId("survey-schedule").first().click();
  const schedule = page.getByRole("alertdialog");
  await schedule.getByTestId("survey-when").fill("2030-01-15T10:00");
  await schedule.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByTestId("site-survey-row").first()).toHaveAttribute("data-state", "scheduled");
  await expectAxeClean(page);
});

test("pilot: agreement terms and the seven KPIs, baseline against current", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, `/tenants/${P.sample}/pilot`);
  await expect(page.getByTestId("pilot-terms")).toBeVisible();
  const kpis = page.getByTestId("pilot-kpis");
  await expect(kpis.locator("tbody tr")).toHaveCount(7);
  await expect(kpis).toHaveAttribute("data-window", "90d");
  await kpis.getByRole("link", { name: "Last 30 days" }).click();
  await expect(page.getByTestId("pilot-kpis")).toHaveAttribute("data-window", "30d");
  await expectAxeClean(page);

  await gotoAdmin(page, `/tenants/${P.sample}/ai-usage`);
  await expect(page.getByTestId("ai-usage-row").first()).toBeVisible();
  await expectAxeClean(page);
  await gotoAdmin(page, "/ai-usage");
  await expect(page.getByTestId("ai-row").first()).toBeVisible();
  await expect(page.locator('[data-testid="ai-row"][data-slug="sample-dorm"]')).toHaveAttribute("data-overage", "true");
  await expectAxeClean(page);
});

test("feature flags per tenant: override with a reason", async ({ page }) => {
  await signInPlatform(page, "ops");
  await gotoAdmin(page, `/tenants/${P.sample}/flags`);
  await expect(page.getByTestId("tenant-flag").first()).toBeVisible();
  await page.getByTestId("flag-override-billing.auto_issue").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").first().selectOption({ index: 1 });
  await dialog.getByRole("textbox").last().fill("Pilot asked for auto-issue");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  const changes = await platformReceived("admin.featureFlags.update");
  expect(changes.at(-1)?.body).toMatchObject({ tenantId: P.sample, reason: "Pilot asked for auto-issue" });
  // Let the confirmation toast mount first, so axe measures it at rest rather than mid fade-in.
  await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
  await expectAxeClean(page);
});

test("support: request a grant; view as tenant is read-only with no mutation control", async ({ page }) => {
  await signInPlatform(page, "support");
  await gotoAdmin(page, `/tenants/${P.garden}/support`);
  await page.getByTestId("request-grant").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("grant-reason").fill("Owner asked for help with the rate plans");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("support-grant").first()).toBeVisible();
  await expectAxeClean(page);

  await gotoAdmin(page, `/tenants/${P.sample}/view`);
  const view = page.getByTestId("view-as");
  await expect(view).toHaveAttribute("data-readonly", "true");
  await expect(page.getByTestId("view-as-banner")).toBeVisible();
  await expect(page.getByTestId("view-member").first()).toBeVisible();
  // Read-only: the view renders no button, input or form that could change the tenant's data.
  await expect(view.locator("button, input, select, textarea, form")).toHaveCount(0);
  await expect(page.getByTestId("view-reads")).toBeVisible();
  await expectAxeClean(page);
});
