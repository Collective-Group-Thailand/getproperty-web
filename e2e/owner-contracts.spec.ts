import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, ownerControl, received, signInOwner } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * GW3 — contract library & renewals (api G3; D-290, D-294, D-020 / D-158, D-062): the library with its legal-review
 * badge and disclaimer, copy → edit → diff → compliance (blocked in the สคบ. scope, warned outside) → publish; an
 * addendum written on a lease, sent, signed with the PDF's sha256 and a drawn signature; a renewal offered from the
 * lease with the API's suggestion, listed and withdrawn.
 */

test.describe.configure({ mode: "serial" });

const LEASE_A302 = "1ea50000-0000-4000-8000-000000000302";
const LANDLORD_PHONE = "0810000006";
const FORBIDDEN = "ผู้เช่าชำระค่าต่อสัญญา 1,000 บาท ";

test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/owner/reset?part=contracts`, { method: "POST" });
});
test.afterAll(async () => {
  await fetch(`${MOCK_API}/__mock/owner/reset?part=contracts`, { method: "POST" });
});

async function sign(page: Page) {
  const canvas = page.getByTestId("signature-pad");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(box.x + 30 + step * 20, box.y + box.height / 2 + (step % 2 ? -25 : 25));
  }
  await page.mouse.up();
}

/** Copies the Thai library addendum into my templates and lands in the editor. */
async function copyAddendum(page: Page) {
  await gotoOwner(page, "/contracts?kind=addendum&language=th");
  const platform = page.getByTestId("library-platform").getByTestId("library-template");
  await expect(platform).toHaveCount(1);
  await platform.getByTestId("library-copy").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("form-submit").click();
  await page.waitForURL(/\/contracts\/templates\//);
  await hydrated(page);
  await expect(page.getByTestId("template-title")).toContainText("ฉบับของฉัน");
}

async function save(page: Page) {
  await page.getByTestId("template-save").click();
  await expect(page.getByTestId("template-dirty")).toHaveCount(0);
}

test("the library: platform drafts by kind and language, legal-review badge and the disclaimer", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/leases");
  await page.getByTestId("contracts-tab-library").click();
  await expect(page).toHaveURL(`${HOSTS.owner}/contracts`);
  await hydrated(page);
  await expect(page.getByTestId("contract-disclaimer")).toContainText("ไม่ใช่คำแนะนำทางกฎหมาย");
  const platform = page.getByTestId("library-platform").getByTestId("library-template");
  await expect(platform).toHaveCount(8);
  await expect(platform.first().getByTestId("library-version")).toHaveCount(2);
  await expect(platform.first()).toContainText("รอตรวจทางกฎหมาย");
  await expect(page.getByTestId("library-mine")).toContainText("ยังไม่มีแม่แบบของคุณ");
  await expectAxeClean(page);

  await gotoOwner(page, "/contracts?kind=reservation&language=en");
  await expect(platform).toHaveCount(1);
  await expect(platform.getByTestId("library-version")).toHaveCount(1);
  await expect(platform.getByTestId("library-version")).toHaveAttribute("data-language", "en");
});

test("copy → edit → diff → compliance blocks in scope → publish refused, then published", async ({ page }) => {
  await signInOwner(page);
  await copyAddendum(page);
  await expect(page.getByTestId("template-status")).toContainText("ร่าง");
  await expect(page.getByTestId("template-status")).toContainText("รอตรวจทางกฎหมาย");
  await expect(page.getByTestId("template-base")).toBeVisible();
  await expect(page.getByTestId("contract-disclaimer")).toBeVisible();
  await expectAxeClean(page);

  const body = page.getByTestId("template-body");
  const original = await body.inputValue();
  expect(original).toContain("<section>");

  // A variable from the panel goes in at the cursor; one outside the catalogue is refused by the API on save.
  await body.focus();
  await body.press("ControlOrMeta+End");
  await page.locator('[data-testid="template-variable"][data-variable="lease.number"]').click();
  await expect(body).toHaveValue(/\{\{lease\.number\}\}$/);
  await body.fill(`${original}<p>{{tenant.secret}}</p>`);
  await expect(page.getByTestId("template-unknown")).toContainText("tenant.secret");
  await page.getByTestId("template-save").click();
  await expect(page.getByTestId("problem-notice")).toHaveAttribute("data-code", "contract.unknown_variable");

  // Forbidden wording added to a clause: the diff shows the changed clause, the check blocks it with ข้อ 5 (11).
  await body.fill(original.replace("{{addendum.clauses}}", `${FORBIDDEN}{{addendum.clauses}}`));
  await save(page);
  await page.getByRole("tab", { name: "เทียบกับต้นฉบับ" }).click();
  await expect(page.locator('[data-testid="diff-clause"][data-status="changed"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="diff-clause"][data-status="changed"]')).toContainText("ค่าต่อสัญญา");
  await page.getByTestId("template-check").click();
  const finding = page.locator('[data-testid="compliance-finding"][data-severity="block"]');
  await expect(finding).toHaveCount(1);
  await expect(finding).toContainText("ข้อ 5 (11)");
  await expect(page.getByTestId("compliance-result")).toHaveAttribute("data-publishable", "false");
  await expectAxeClean(page);

  await page.getByTestId("template-publish").click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "เผยแพร่" }).click();
  await expect(dialog.getByTestId("problem-notice")).toHaveAttribute("data-code", "compliance.forbidden_clause");
  await expect(dialog.getByTestId("problem-notice")).toContainText("ข้อ 5 (11)");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // Wording reverted: publishes (still pending legal verification).
  await body.fill(original);
  await save(page);
  await page.getByTestId("template-publish").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "เผยแพร่" }).click();
  await expect(page.getByTestId("template-status")).toContainText("เผยแพร่แล้ว");
  await expect(page.getByTestId("template-status")).toContainText("รอตรวจทางกฎหมาย");

  await gotoOwner(page, "/contracts");
  await expect(page.getByTestId("library-mine").getByTestId("library-template")).toHaveCount(1);
});

test("outside the สคบ. scope a forbidden clause is a warning and the template publishes", async ({ page }) => {
  await signInWithOtp(page, HOSTS.owner, LANDLORD_PHONE);
  await hydrated(page);
  await copyAddendum(page);
  const body = page.getByTestId("template-body");
  const original = await body.inputValue();
  await body.fill(original.replace("{{addendum.clauses}}", `${FORBIDDEN}{{addendum.clauses}}`));
  await save(page);
  await page.getByTestId("template-check").click();
  await expect(page.getByTestId("compliance-result")).toContainText("อยู่นอกขอบเขต");
  await expect(page.locator('[data-testid="compliance-finding"][data-severity="warn"]')).toHaveCount(1);
  await expect(page.getByTestId("compliance-result")).toHaveAttribute("data-publishable", "true");
  await page.getByTestId("template-publish").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "เผยแพร่" }).click();
  await expect(page.getByTestId("template-status")).toContainText("เผยแพร่แล้ว");
  // The warning stays on screen after publishing, with its legal reference.
  await expect(page.locator('[data-testid="compliance-finding"][data-severity="warn"]')).toContainText("ข้อ 5 (11)");
});

test("an addendum written on a lease: sent, signed with the PDF's sha256, then fully signed", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/leases/${LEASE_A302}`);
  await expect(page.getByTestId("lease-renewal")).toBeVisible();
  await page.getByTestId("lease-addendum").click();
  await hydrated(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("contract-kind")).toHaveValue("addendum");
  await expect(dialog.getByTestId("contract-lease")).toHaveValue(LEASE_A302);
  await dialog.getByTestId("clause-title").fill("สัตว์เลี้ยง");
  await dialog.getByTestId("clause-text").fill("อนุญาตแมวได้ 1 ตัว");
  await dialog.getByTestId("form-submit").click();
  await page.waitForURL(/\/contracts\/documents\/[0-9a-f-]{36}$/);
  await hydrated(page);
  const created = (await received("owner.contracts.create")).at(-1);
  expect(created?.body).toMatchObject({
    kind: "addendum",
    leaseId: LEASE_A302,
    variables: { clauses: [{ title: "สัตว์เลี้ยง", text: "อนุญาตแมวได้ 1 ตัว" }] },
  });
  await expect(page.getByTestId("contract-status")).toHaveAttribute("data-state", "draft");
  await expect(page.getByTestId("contract-status")).toContainText("รอตรวจทางกฎหมาย");
  await expect(page.getByTestId("contract-disclaimer")).toBeVisible();
  await expect(page.getByTestId("contract-signer")).toHaveCount(2);
  await expect(page.getByTestId("contract-values")).toContainText("อนุญาตแมวได้ 1 ตัว");
  await expectAxeClean(page);

  await page.getByTestId("contract-send").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ส่งให้ลงนาม" }).click();
  await expect(page.getByTestId("contract-status")).toHaveAttribute("data-state", "pending_signature");
  expect((await received("owner.contracts.sendForSignature")).at(-1)?.idempotencyKey).toBeTruthy();

  await page.getByTestId("contract-sign").click();
  const signDialog = page.getByRole("alertdialog");
  await expect(signDialog.getByTestId("contract-sign-sha")).toContainText(/[0-9a-f]{64}/);
  const confirm = signDialog.getByRole("button", { name: "ลงนามสัญญา" });
  await expect(confirm).toBeDisabled();
  await sign(page);
  await confirm.click();
  await expect(page.locator('[data-testid="contract-signer"][data-role="lessor"]')).toHaveAttribute(
    "data-signed",
    "true",
  );
  const signs = (await received("owner.contracts.sign")).at(-1);
  expect(signs?.idempotencyKey).toBeTruthy();
  expect(String(signs?.body.contractSha256)).toMatch(/^[0-9a-f]{64}$/);
  expect(String(signs?.body.signaturePng ?? "")).not.toHaveLength(0);

  // The resident signs in LINE (mock control): the contract is fully signed and downloadable.
  const contractId = page.url().split("/").at(-1)!;
  await ownerControl(`contracts/${contractId}/counterparty-sign`, "POST");
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId("contract-status")).toHaveAttribute("data-state", "signed");
  await expect(page.getByTestId("contract-pdf")).toBeVisible();

  await gotoOwner(page, "/contracts/documents");
  await expect(page.getByTestId("contract-row")).toHaveCount(1);
  await expect(page.getByTestId("contract-row")).toHaveAttribute("data-state", "signed");
  await expectAxeClean(page);
});

test("a renewal offered from the lease with the benchmark suggestion, listed and withdrawn", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/leases/${LEASE_A302}`);
  await page.getByTestId("renewal-offer").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("renewal-suggestion")).toContainText("ค่าเช่าเฉลี่ยของห้องใกล้เคียง");
  await expect(dialog.getByTestId("renewal-basis")).toContainText("k = 7");
  await expect(dialog.getByTestId("renewal-rent")).toHaveValue("6750.00");
  await dialog.locator('[data-testid="renewal-candidate"][data-source="current_rent"]').click();
  await expect(dialog.getByTestId("renewal-rent")).toHaveValue("6500.00");
  await dialog.getByTestId("renewal-rent").fill("6700");
  await expectAxeClean(page);
  await dialog.getByTestId("form-submit").click();
  await expect(dialog).toHaveCount(0);
  const offer = (await received("owner.renewals.offer")).at(-1);
  expect(offer?.idempotencyKey).toBeTruthy();
  expect(offer?.body).toMatchObject({ rent: "6700", months: 12 });
  const row = page.getByTestId("lease-renewal").getByTestId("renewal-row");
  await expect(row).toHaveAttribute("data-state", "offered");
  await expect(row.getByTestId("renewal-rents")).toContainText("6,700");
  await expect(page.getByTestId("renewal-offer")).toHaveCount(0);

  await page.getByTestId("lease-renewal").getByTestId("renewal-withdraw").waitFor();
  await gotoOwner(page, "/renewals");
  const open = page.getByTestId("renewal-row");
  await expect(open).toHaveCount(1);
  await expect(open).toContainText("A-302");
  await expectAxeClean(page);
  await open.getByTestId("renewal-withdraw").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ถอนข้อเสนอ" }).click();
  await expect(page.getByTestId("renewal-row")).toHaveCount(0);
  await page.getByTestId("renewals-tab-decided").click();
  await hydrated(page);
  await expect(page.getByTestId("renewal-row")).toHaveAttribute("data-state", "withdrawn");
});

test("the editor fits a 390 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInOwner(page);
  await gotoOwner(page, "/contracts?kind=reservation&language=th");
  await page.getByTestId("library-platform").getByTestId("library-open").click();
  await hydrated(page);
  await expect(page.getByTestId("template-body")).toHaveAttribute("readonly", "");
  await expect(page.getByTestId("contract-disclaimer")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expectAxeClean(page);
});
