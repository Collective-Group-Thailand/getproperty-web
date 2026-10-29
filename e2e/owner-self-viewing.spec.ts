import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * GW6 / G7 — self-viewing on the owner side (D-295; O-024): while `viewing.self.enabled` is off the availability
 * editor says why and offers no self window; once on, a window is marked self and saved with its mode. A self
 * viewing is confirmed (door codes issued, never shown), its access card and audited entry log read, the access
 * ended early (reason, Idempotency-Key); a visitor inside / an incident show up as attention on the enquiries page
 * and the viewing calendar.
 */

test.describe.configure({ mode: "serial" });

const LANDLORD_PHONE = "0810000006";
const LISTING = "8d4b2c1a-0000-4000-8000-00000000a001";

const control = (path: string) => fetch(`${MOCK_API}/__mock/owner/${path}`, { method: "POST" });
async function selfLead(stage: string): Promise<string> {
  const response = await control(`viewings/self?stage=${stage}`);
  return ((await response.json()) as { leadId: string }).leadId;
}
const reset = async () => {
  await control("reset?part=portfolio");
  await control("reset?part=settings");
};

async function signInLandlord(page: Page) {
  await signInWithOtp(page, HOSTS.owner, LANDLORD_PHONE);
  await hydrated(page);
}

// Each test starts from the seeded world: the calendar counts every self viewing of the week, so one left by the
// previous test (serial mode, same mock) would be counted too.
test.beforeEach(reset);
test.afterAll(reset);

test("availability: self viewing is not available yet, then a window is marked self and saved", async ({ page }) => {
  await signInLandlord(page);
  await gotoOwner(page, `/listings/${LISTING}`);
  const editor = page.getByTestId("listing-availability");
  await expect(editor.getByTestId("self-viewing-off")).toBeVisible();
  const mode = editor.getByTestId("listing-slot-mode").first();
  // A native <option disabled>: Playwright's toBeDisabled() follows ARIA and reports an option as enabled, so read
  // the state the browser enforces (a disabled option cannot be picked by the user) and that it is not the value.
  await expect(mode.locator('option[value="self"]')).toHaveJSProperty("disabled", true);
  await expect(mode).not.toHaveValue("self");
  await expectAxeClean(page);

  await control("viewings/self-enabled?on=1");
  await gotoOwner(page, `/listings/${LISTING}`);
  await expect(editor.getByTestId("self-viewing-on")).toContainText("5");
  await editor.getByTestId("listing-slot-mode").first().selectOption("self");
  await editor.getByTestId("listing-availability-save").click();
  // The "self viewing is on" callout is a status too: wait for the save confirmation itself.
  await expect(editor.getByRole("status").filter({ hasText: /บันทึกแล้ว|Saved/ })).toBeVisible();
  const [put] = (await received("owner.listings.setAvailability")).slice(-1);
  expect((put?.body.weekly as { mode?: string }[])[0]?.mode).toBe("self");
});

test("a self viewing is confirmed: codes issued but never shown; the entry log is read; access ended early", async ({
  page,
}) => {
  await control("viewings/self-enabled?on=1");
  const leadId = await selfLead("requested");
  await signInLandlord(page);
  await gotoOwner(page, `/leads/${leadId}`);
  const viewing = page.getByTestId("lead-viewing");
  await expect(viewing).toHaveAttribute("data-mode", "self");
  await viewing.getByTestId("viewing-confirm").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(/door code|รหัสประตู/);
  await dialog.getByRole("button", { name: "ยืนยันนัด" }).click();
  await expect(viewing).toHaveAttribute("data-state", "confirmed");
  const access = viewing.getByTestId("viewing-access");
  await expect(access).toHaveAttribute("data-access-state", "issued");
  await expect(access.getByTestId("viewing-access-window")).toBeVisible();
  await expectAxeClean(page);

  await access.getByTestId("viewing-access-log").click();
  const log = page.getByRole("dialog");
  await expect(log.getByTestId("viewing-access-log-empty")).toBeVisible();
  // Never a door code in the console (the mock issues six digits).
  await expect(log).not.toContainText(/\b\d{6}\b/);
  await log
    .getByRole("button", { name: /ปิด|Close/ })
    .first()
    .click();

  await access.getByTestId("viewing-end-access").click();
  await page.getByTestId("viewing-end-reason").fill("ผู้ชมขอเลื่อนนัด");
  await page.getByRole("dialog").getByTestId("form-submit").click();
  await expect(access).toHaveAttribute("data-access-state", "cancelled");
  const [end] = await received("owner.listingViewings.endAccess");
  expect(end?.idempotencyKey).toBeTruthy();
});

test("a visitor inside and an incident need the owner: enquiries, calendar, work order", async ({ page }) => {
  await control("viewings/self-enabled?on=1");
  const inside = await selfLead("entered");
  const incident = await selfLead("incident");
  await signInLandlord(page);
  await gotoOwner(page, "/leads");
  await expect(page.getByTestId("leads-urgent")).toBeVisible();

  await page.getByTestId("leads-calendar").click();
  await hydrated(page);
  await expect(page.getByTestId("viewing-calendar")).toBeVisible();
  await expect(page.getByTestId("calendar-urgent").getByRole("link")).toHaveCount(2);
  await expect(page.locator('[data-testid="calendar-viewing"][data-mode="self"]')).toHaveCount(2);
  await expectAxeClean(page);
  await page.getByTestId("calendar-next").click();
  await expect(page.getByTestId("calendar-week")).not.toHaveAttribute("data-week", "");

  await gotoOwner(page, `/leads/${incident}`);
  const access = page.getByTestId("viewing-access");
  await expect(access).toHaveAttribute("data-attention", "incident");
  await expect(access.getByTestId("viewing-incident")).toContainText("ก๊อกน้ำ");
  await expect(access.getByTestId("viewing-work-order")).toHaveAttribute("href", /\/work-orders\//);

  await gotoOwner(page, `/leads/${inside}`);
  const card = page.getByTestId("viewing-access");
  await expect(card).toHaveAttribute("data-attention", "inside");
  await card.getByTestId("viewing-access-log").click();
  await expect(page.getByTestId("viewing-access-events").getByRole("listitem")).toHaveCount(2);
  await expectAxeClean(page);
});
