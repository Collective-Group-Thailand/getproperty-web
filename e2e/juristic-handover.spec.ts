import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * JW3b — the developer handover inbox (api J3.2 at 1e364785, D-333): อาคาร C waits (due, clean, no legal form sent),
 * อาคาร D has three problems and a receiving account the office does not hold, ซอย 3 is register-only and not due,
 * อาคาร E was accepted and waits for the juristic person's registration, อาคาร F was rejected. Written for the
 * deferred e2e run (founder 2026-10-28) — not run in JW3b.
 */

test.describe.configure({ mode: "serial" });

const HO = {
  dueC: "4a0d0a01-0000-4000-8000-000000000001",
  problemsD: "4a0d0a01-0000-4000-8000-000000000002",
  notDueSoi: "4a0d0a01-0000-4000-8000-000000000003",
  acceptedE: "4a0d0a01-0000-4000-8000-000000000004",
};
const reset = () => fetch(`${MOCK_API}/__mock/owner/reset?part=juristic`, { method: "POST" });
const flag = (query: string) => fetch(`${MOCK_API}/__mock/owner/handovers/flag?${query}`, { method: "POST" });
const OWNER = "0810000010";
const COMMITTEE = "0810000011";

async function signIn(page: Page, phone = OWNER) {
  await signInWithOtp(page, HOSTS.owner, phone);
  await hydrated(page);
}

async function typePhrase(dialog: ReturnType<Page["getByRole"]>) {
  const phrase = dialog.getByRole("textbox", { name: /^พิมพ์/ });
  await phrase.fill((await phrase.getAttribute("placeholder")) ?? "");
}

test.beforeEach(reset);
test.afterAll(reset);

test("the inbox opens on the waiting handovers, a clean one is accepted after the legal form is chosen", async ({
  page,
}) => {
  await signIn(page);
  await gotoOwner(page, "/juristic/handovers");
  await expect(page.getByTestId("handovers-tab-pending")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("handover-row")).toHaveCount(3);
  await expect(page.getByTestId("handover-row").filter({ hasText: "บ้านในสวน ซอย 3" })).toContainText(
    "ยังไม่ถึงวันส่งมอบ",
  );
  await expectAxeClean(page);

  await page.getByTestId("handover-row").filter({ hasText: "อาคาร C" }).click();
  await page.waitForURL(new RegExp(`/juristic/handovers/${HO.dueC}`));
  await hydrated(page);
  await expect(page.getByTestId("handover-problems")).toHaveCount(0);
  await expect(page.getByTestId("handover-bank-matched")).toBeVisible();
  await expect(page.getByTestId("handover-owners-attach")).toContainText("2");
  await expectAxeClean(page);

  // First try: the developer sent no legal form → the field becomes required.
  await page.getByTestId("handover-accept").click();
  const dialog = page.getByRole("alertdialog");
  await typePhrase(dialog);
  await dialog.getByRole("button", { name: "รับมอบ" }).click();
  await expect(dialog.getByTestId("handover-legal-form-needed")).toBeVisible();
  await dialog.getByTestId("handover-legal-form").selectOption("condo_act");
  await dialog.getByTestId("handover-notify").click(); // opening balances issued silently
  await dialog.getByRole("button", { name: "รับมอบ" }).click();
  await expect(dialog).toHaveCount(0);
  const [accepted] = (await received("owner.juristicHandovers.accept")).slice(-1);
  expect(accepted?.idempotencyKey).toBeTruthy();
  expect(accepted?.body).toMatchObject({ legalForm: "condo_act", notifyOpeningBalances: false });

  await expect(page.getByTestId("handover-applied")).toContainText("เท่ากับยอดที่ผู้พัฒนาส่งมา");
  await expect(page.getByTestId("handover-formed")).toBeVisible();
});

test("problems and the handover date keep accept disabled with the reason; reject sends the reason back", async ({
  page,
}) => {
  await signIn(page);
  await gotoOwner(page, `/juristic/handovers/${HO.problemsD}`);
  await expect(page.getByTestId("handover-problem-row")).toHaveCount(3);
  await expect(page.getByTestId("handover-units-problems")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("handover-accept")).toBeDisabled();
  await expect(page.getByTestId("handover-accept-reason")).toContainText("3 รายการ");
  await expect(page.getByTestId("handover-bank-unmatched")).toBeVisible();

  await page.getByTestId("handover-reject").click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByTestId("handover-reject-reason").fill("ห้อง D-303 ไม่มีชื่อเจ้าของ และ D-306 สัดส่วนเกิน 100%");
  await dialog.getByRole("button", { name: "ปฏิเสธ" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("handover-rejected")).toContainText("D-303");

  await gotoOwner(page, `/juristic/handovers/${HO.notDueSoi}`);
  await expect(page.getByTestId("handover-accept")).toBeDisabled();
  await expect(page.getByTestId("handover-accept-reason")).toContainText("รับมอบได้ตั้งแต่");
  await expect(page.getByTestId("handover-bank-none")).toBeVisible();
});

test("an owned unit is refused in words and nothing is recorded", async ({ page }) => {
  await flag("unitOwned=1");
  await signIn(page);
  await gotoOwner(page, `/juristic/handovers/${HO.dueC}`);
  await page.getByTestId("handover-accept").click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByTestId("handover-legal-form").selectOption("condo_act");
  await typePhrase(dialog);
  await dialog.getByRole("button", { name: "รับมอบ" }).click();
  await expect(dialog.getByTestId("handover-problem")).toHaveAttribute("data-code", "handover.unit_owned");
  await expect(dialog.getByTestId("handover-problem")).toContainText("เปิดทะเบียนเจ้าของร่วม");
});

test("the juristic person's registration is recorded once", async ({ page }) => {
  await signIn(page);
  await gotoOwner(page, `/juristic/handovers/${HO.acceptedE}`);
  await page.getByTestId("handover-formed").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("handover-registration-no").fill("นต.123/2569");
  await dialog.getByTestId("form-submit").click();
  // The field's own message (the problem notice repeats the API's answer).
  await expect(dialog.locator('[id$="-error"]', { hasText: "ระบุวันที่จดทะเบียน" })).toBeVisible();
  // The date picker (the hidden input only carries its value): the 1st of this month is never in the future.
  await dialog.getByRole("button", { name: /วันที่จดทะเบียน/ }).click();
  await page
    .getByRole("dialog", { name: "เลือกวันที่" })
    .getByRole("gridcell")
    .getByRole("button", { name: "1", exact: true })
    .click();
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("นต.123/2569").first()).toBeVisible();
  await expect(page.getByTestId("handover-formed")).toHaveCount(0);
});

test("the committee reviews read-only", async ({ page }) => {
  await signIn(page, COMMITTEE);
  await gotoOwner(page, `/juristic/handovers/${HO.dueC}`);
  await expect(page.getByTestId("handover-panel")).toContainText("ดูรายละเอียดได้");
  await expect(page.getByTestId("handover-accept")).toHaveCount(0);
  await expect(page.getByTestId("handover-reject")).toHaveCount(0);
});
