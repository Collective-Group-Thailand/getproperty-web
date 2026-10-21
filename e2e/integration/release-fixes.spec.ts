import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { INT_CONTROL, INT_HOSTS } from "../../playwright.integration.config";
import { requestOtp } from "./otp";

/**
 * The api release fixes (triage F7) against the real getproperty-api at the pinned commit (the `/rel` world of
 * e2e/integration/harness.ts):
 *   - D-220: the provider pays the rent invoice's QR, then sends a second payment for the same QR — the API holds
 *     it (`qr_already_paid`); the owner finds it under "payments to check" and confirms it, typed with the unit;
 *     the API books it (confirmed, a receipt);
 *   - D-226: someone signs in to the resident app with the SMS code of a party's phone — no unit, a pending link
 *     request; the owner confirms it from the dashboard queue; the login's `me` no longer has requests pending;
 *   - D-219: the owner terminates the lease with a date after today — the API records the lessor's notice
 *     (`notice_given`, no termination) and the unit stays occupied.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

interface ReleaseWorld {
  ownerPhone: string;
  tenantName: string;
  buildingId: string;
  unitId: string;
  unitNo: string;
  leaseId: string;
  leaseEndDate: string;
  invoiceId: string;
  invoiceNumber: string;
  linkPartyId: string;
  linkPartyName: string;
}

const control = async <T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> => {
  const response = await fetch(`${INT_CONTROL}${path}`, { method });
  const body = (await response.json()) as T;
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(body)}`);
  return body;
};

async function hydrated(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "owner");
}

async function goto(page: Page, path: string) {
  await page.goto(`${INT_HOSTS.owner}${path}`);
  await hydrated(page);
}

/** A read through the owner zone's BFF with the browser's session (what the page itself would call). */
async function bff<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`${INT_HOSTS.owner}/bff${path}`);
  expect(response.status(), path).toBe(200);
  return (await response.json()) as T;
}

async function signInOwner(page: Page, world: ReleaseWorld) {
  await page.goto(`${INT_HOSTS.owner}/login`);
  await page.getByLabel("เบอร์มือถือ").fill(`0${world.ownerPhone.slice(3)}`);
  await requestOtp(page);
  const { code } = await control<{ code: string | null }>(
    `/sms/last-code?phone=${encodeURIComponent(world.ownerPhone)}`,
  );
  await page.getByRole("textbox", { name: "หลักที่ 1" }).fill(code!);
  await expect(page).toHaveURL(`${INT_HOSTS.owner}/dashboard`);
  await expect(page.getByTestId("session-summary")).toContainText(world.tenantName);
  await hydrated(page);
}

// One sign-in for the whole file: the API's OTP resend gap would otherwise slow every test down.
let context: BrowserContext;
let page: Page;
let world: ReleaseWorld;

test.beforeAll(async ({ browser }) => {
  world = await control<ReleaseWorld>("/rel");
  context = await browser.newContext();
  page = await context.newPage();
  await signInOwner(page, world);
});

test.afterAll(async () => {
  await context.close();
});

test("held payment (D-220): a second payment of a paid QR is held; the owner confirms it and it is booked", async () => {
  const { held } = await control<{ held: { id: string; heldReason: string } }>("/rel/held", "POST");
  expect(held.heldReason).toBe("qr_already_paid");

  await goto(page, "/dashboard");
  const item = page.getByTestId("today-queue").locator('[data-kind="heldPayments"]');
  await expect(item).toHaveAttribute("data-count", "1");
  await item.click();
  await expect(page.getByTestId("held-payments")).toBeVisible();
  await hydrated(page);
  const row = page.locator(`[data-testid="held-row"][data-payment="${held.id}"]`);
  await expect(row.getByTestId("held-reason")).toHaveAttribute("data-reason", "qr_already_paid");
  await expect(row.getByTestId("held-duplicate-of")).toBeVisible();

  await row.getByTestId("held-confirm").click();
  const dialog = page.getByRole("alertdialog", { name: "บันทึกรับเงินรายการนี้?" });
  await dialog.getByRole("textbox", { name: /^พิมพ์/ }).fill(world.unitNo);
  await dialog.getByRole("button", { name: "ยืนยัน บันทึกรับ" }).click();
  await expect(page.locator(`[data-testid="held-row"][data-payment="${held.id}"]`)).toHaveCount(0, {
    timeout: 30_000,
  });

  const booked = await bff<{ status: string; heldReason: string | null; creditedAmount: string }>(
    page,
    `/v1/owner/payments/${held.id}`,
  );
  expect(booked.status).toBe("confirmed");
  // The invoice was already paid: the second transfer becomes the payer's credit (D-220, D-221).
  expect(booked.creditedAmount).not.toBe("0.00");
  await goto(page, `/payments/${held.id}`);
  await expect
    .poll(
      async () => {
        await page.reload();
        await hydrated(page);
        return page.getByTestId("receipt-pdf").count();
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId("held-actions")).toHaveCount(0);
});

test("link request (D-226): a phone sign-in links nothing until the owner confirms it", async () => {
  const before = await control<{ linkRequestsPending: number; units?: unknown[] }>("/rel/phone-sign-in", "POST");
  expect(before.linkRequestsPending).toBeGreaterThan(0);

  await goto(page, "/dashboard");
  const item = page.getByTestId("today-queue").locator('[data-kind="linkRequests"]');
  await expect(item).toHaveAttribute("data-count", "1");
  await item.click();
  await expect(page.getByTestId("link-requests")).toBeVisible();
  await hydrated(page);
  const row = page.getByTestId("link-request-row").filter({ hasText: world.linkPartyName });
  await expect(row).toHaveAttribute("data-state", "pending");
  await row.getByTestId("link-confirm").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByText("เชื่อมบัญชีแล้ว")).toBeVisible();
  await expect(page.getByTestId("link-request-row").filter({ hasText: world.linkPartyName })).toHaveCount(0);

  const requests = await bff<{ data: { partyId: string; state: string; linkId: string | null }[] }>(
    page,
    `/v1/owner/party-link-requests?partyId=${world.linkPartyId}&state=confirmed`,
  );
  expect(requests.data).toHaveLength(1);
  expect(requests.data[0]!.linkId).toBeTruthy();
  const after = await control<{ linkRequestsPending: number }>("/rel/resident-me");
  expect(after.linkRequestsPending).toBe(0);
});

test("future-dated termination (D-219): the notice is recorded, nothing closes", async () => {
  await goto(page, `/leases/${world.leaseId}`);
  await page.getByTestId("lease-terminate").click();
  const dialog = page.getByRole("alertdialog", { name: "เลิกสัญญาเช่า" });
  await dialog.getByTestId("terminate-reason").selectOption("mutual_agreement");
  await dialog.getByRole("button", { name: /วันย้ายออก/ }).click();
  const calendar = page.getByRole("dialog", { name: "เลือกวันที่" });
  await calendar.getByRole("button", { name: "เดือนถัดไป" }).click();
  await calendar.getByRole("gridcell").getByRole("button", { name: "15", exact: true }).click();
  await dialog.getByRole("textbox", { name: /^พิมพ์/ }).fill(world.unitNo);
  await dialog.getByRole("button", { name: "เลิกสัญญา", exact: true }).click();
  // The API checks the notice rule for a lessor's ground (D-020): acknowledged, the same request is repeated.
  const warning = dialog.getByTestId("problem-notice");
  await expect(warning).toHaveAttribute("data-code", "compliance.acknowledgement_required");
  await warning.getByRole("button", { name: "รับทราบและดำเนินการต่อ" }).click();
  await expect(page.getByText(/บันทึกการบอกเลิกแล้ว มีผล/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("lease-notice-access")).toBeVisible();

  const lease = await bff<{
    status: string;
    termination: unknown;
    notice: { by: string; reasonCode: string | null; effectiveDate: string | null } | null;
  }>(page, `/v1/owner/leases/${world.leaseId}`);
  expect(lease.status).toBe("notice_given");
  expect(lease.termination).toBeNull();
  expect(lease.notice).toMatchObject({ by: "lessor", reasonCode: "mutual_agreement" });
  expect(lease.notice!.effectiveDate! > new Date().toISOString().slice(0, 10)).toBe(true);
  const unit = await bff<{ status: string }>(page, `/v1/owner/units/${world.unitId}`);
  expect(unit.status).toBe("occupied");
});
