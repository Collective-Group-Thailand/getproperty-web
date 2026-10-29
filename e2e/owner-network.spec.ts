import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received, signInOwner } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * GW6 / G8 — getbuild rental handoff and employer housing (D-299; O-033, O-034). Public: the invitation page shows
 * the unit with the buyer's first name only; "not now" declines it; closed and unknown invitations are designed
 * states. Console: a landlord claims an invitation (rent, headline, address only when getbuild did not tell it) and
 * lands on the listing draft; an apartment account is told to use a landlord account. Employer housing: the
 * agreement, attaching a lease ("who pays"), payroll numbers, the month's statement, the payroll CSV and the TM30
 * filter.
 */

test.describe.configure({ mode: "serial" });

const LANDLORD_PHONE = "0810000006";
const TOKEN = {
  open: "q3K8xF0bW2yR9mT4vN6pL1sA7dE5gH0j",
  noAddress: "Zx9Lm2Qp7Rt4Vw1Ys6Bn3Kd8Hf5Jg0Ca",
  expired: "Ex9Pi7Re1Dt0Ok3En5Wa2It4In6Gm8Qs",
};
const AGREEMENT = "3e6a0000-0000-4000-8000-0000000e0001";
const LEASE_A201 = "1ea50000-0000-4000-8000-000000000001";

const reset = async () => {
  for (const part of ["network", "portfolio", "leases"])
    await fetch(`${MOCK_API}/__mock/owner/reset?part=${part}`, { method: "POST" });
};

async function signInLandlord(page: Page) {
  await signInWithOtp(page, HOSTS.owner, LANDLORD_PHONE);
  await hydrated(page);
}

test.beforeAll(reset);
test.afterAll(reset);

test("public invitation: the unit, the first name only, closed and unknown states", async ({ page }) => {
  await page.goto(`${HOSTS.owner}/handoff/${TOKEN.open}`);
  const invitation = page.getByTestId("handoff-invitation");
  await expect(invitation).toHaveAttribute("data-state", "invited");
  await expect(page.getByTestId("handoff-title")).toContainText("Somchai");
  await expect(page.getByTestId("handoff-facts")).toContainText("A-1203");
  await expect(page.getByTestId("handoff-claim")).toHaveAttribute("href", /\/listings\/handoffs\/claim\?token=/);
  await expect(page.getByTestId("handoff-signup")).toHaveAttribute("href", /\/signup\?next=/);
  await expectAxeClean(page);

  await page.goto(`${HOSTS.owner}/handoff/${TOKEN.expired}`);
  await expect(page.getByTestId("handoff-closed")).toBeVisible();
  await page.goto(`${HOSTS.owner}/handoff/NoSuchTokenNoSuchToken00`);
  await expect(page.getByTestId("handoff-not-found")).toBeVisible();
});

test("an apartment account is told to claim with a landlord account", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/listings/handoffs/claim?token=${TOKEN.open}`);
  await page.getByTestId("handoff-rent").fill("15000");
  await page.getByTestId("handoff-claim-submit").click();
  await expect(page.getByTestId("handoff-landlord-required")).toBeVisible();
});

test("a landlord claims an invitation and finishes the listing draft", async ({ page }) => {
  await signInLandlord(page);
  await gotoOwner(page, `/listings/handoffs/claim?token=${TOKEN.open}`);
  await expect(page.getByTestId("handoff-claim-facts")).toContainText("The Line Phahol");
  await expect(page.getByTestId("handoff-title-th")).not.toHaveValue("");
  await expect(page.getByTestId("handoff-address")).toHaveCount(0);
  await expectAxeClean(page);
  // No rent typed: refused on the field, nothing sent.
  await page.getByTestId("handoff-claim-submit").click();
  await expect(page.getByTestId("handoff-rent")).toHaveAttribute("aria-invalid", "true");
  expect(await received("owner.rentalHandoffs.claim")).toHaveLength(0);
  await page.getByTestId("handoff-rent").fill("15,000");
  await page.getByTestId("handoff-claim-submit").click();
  await page.waitForURL(/\/listings\/[0-9a-f-]{36}\?from=getbuild$/);
  const [claim] = await received("owner.rentalHandoffs.claim");
  expect(claim?.idempotencyKey).toBeTruthy();
  expect(claim?.body.rent).toBe("15000");

  await gotoOwner(page, "/listings");
  await page.getByTestId("listing-handoffs").click();
  await expect(page.getByTestId("handoff-row")).toHaveAttribute("data-state", "accepted");
  await expectAxeClean(page);

  // Claimed: the public page now says so.
  await page.goto(`${HOSTS.owner}/handoff/${TOKEN.open}`);
  await expect(page.getByTestId("handoff-closed")).toBeVisible();
});

test("an invitation without an address asks for it; the buyer may also say not now", async ({ page }) => {
  await signInLandlord(page);
  await gotoOwner(page, `/listings/handoffs/claim?token=${TOKEN.noAddress}`);
  await expect(page.getByTestId("handoff-address")).toBeVisible();

  await page.goto(`${HOSTS.owner}/handoff/${TOKEN.noAddress}`);
  await page.getByTestId("handoff-decline").click();
  await page.getByTestId("handoff-decline-submit").click();
  await expect(page.getByTestId("handoff-declined")).toBeVisible();
});

test("employer housing: attach a lease, payroll numbers, statement, payroll file, TM30 of the workers", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, "/leases");
  await page.getByTestId("contracts-tab-employers").click();
  await hydrated(page);
  const row = page.locator(`[data-testid="employer-row"]`).first();
  await expect(row).toHaveAttribute("data-state", "active");
  await expectAxeClean(page);

  await gotoOwner(page, `/leases/${LEASE_A201}`);
  const card = page.getByTestId("lease-employer");
  await card.getByTestId("lease-employer-attach").click();
  await page.getByTestId("lease-employer-pick").selectOption(AGREEMENT);
  await page.getByRole("dialog").getByTestId("form-submit").click();
  await expect(card.getByTestId("lease-employer-current")).toBeVisible();

  await gotoOwner(page, `/employers/${AGREEMENT}`);
  await expect(page.getByTestId("employer-leases").getByRole("listitem")).toHaveCount(1);
  const worker = page.getByTestId("employer-worker").first();
  await worker.getByTestId("employer-worker-number").fill("E-0042");
  await page.getByTestId("employer-workers-save").click();
  await expect(page.getByTestId("employer-workers").getByRole("status")).toBeVisible();
  await expect(page.getByTestId("statement-line").first()).toBeVisible();
  await expect(page.getByTestId("statement-total")).toContainText("฿");
  await expectAxeClean(page);

  await page.getByTestId("employer-payroll").getByRole("button").click();
  await expect(page.getByTestId("export-download")).toBeVisible();
  const [file] = await received("owner.employerAgreements.payrollExport");
  expect(file?.idempotencyKey).toBeTruthy();

  await page.getByTestId("employer-tm30").click();
  await expect(page.getByTestId("tm30-employer-filter")).toBeVisible();
});
