import { expect, test, type Page } from "@playwright/test";

import { expectAxeClean } from "./support/staff";
import { gotoOwner, hydrated, ownerControl, received, resetOwner, signInOwner, W } from "./support/owner";

/**
 * F2 2.2 on the mock API: residents (list, detail, sealed data with a purpose, invitation QR), the lease
 * wizard (deposit-cap refusal with its legal reference, a D-021a warning acknowledged and the request
 * repeated, contract preview, send for signature with an Idempotency-Key), the resident's signature
 * (mock control) and the lessor's countersignature, a notice with its acknowledgement, and the deposit
 * settlement workspace (inspection comparison, a refused and an accepted deduction, proposal, the
 * resident's answer, the refund with a typed confirmation) — with axe on each screen.
 */
test.describe.configure({ mode: "serial" });

const PARTY_SOMSAK = "9a700000-0000-4000-8000-000000000001";
const LEASE_A202 = "1ea50000-0000-4000-8000-000000000002";
const LEASE_A302 = "1ea50000-0000-4000-8000-000000000302";
const DEPOSIT_A303 = "de900000-0000-4000-8000-000000000303";
const DEPOSIT_B102 = "de900000-0000-4000-8000-000000001102";

test.beforeAll(async () => {
  await resetOwner();
});

async function pickDate(page: Page, field: string | RegExp, day: string, nextMonths = 0) {
  await page.getByRole("button", { name: field }).click();
  const calendar = page.getByRole("dialog", { name: "เลือกวันที่" });
  for (let step = 0; step < nextMonths; step += 1) await calendar.getByRole("button", { name: "เดือนถัดไป" }).click();
  await calendar.getByRole("gridcell").getByRole("button", { name: day, exact: true }).click();
}

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

test("residents: list, detail, sealed data revealed with a purpose, invitation QR", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/parties");
  await expect(page.getByTestId("party-row")).toHaveCount(8);
  await expectAxeClean(page);

  await gotoOwner(page, `/parties/${PARTY_SOMSAK}`);
  await expect(page.getByTestId("party-title")).toHaveText("สมศักดิ์ ใจดี");
  await expect(page.getByTestId("party-lease")).toHaveCount(1);
  await page.getByTestId("reveal-open").click();
  const reveal = page.getByRole("dialog", { name: "ดูข้อมูลส่วนบุคคลที่ปิดผนึก" });
  await expect(reveal.getByTestId("reveal-confirm")).toBeDisabled();
  await reveal.getByTestId("reveal-purpose").fill("ตรวจสัญญาก่อนต่ออายุ");
  await reveal.getByTestId("reveal-confirm").click();
  await expect(page.getByTestId("revealed")).toBeVisible();
  expect((await received("owner.parties.revealPii")).at(-1)?.body).toMatchObject({ purpose: "ตรวจสัญญาก่อนต่ออายุ" });

  await page.getByTestId("party-lease").getByTestId("invite-resident").click();
  const invite = page.getByRole("dialog", { name: "เชิญเข้าแอปผู้เช่า" });
  await invite.getByTestId("invitation-create").click();
  await expect(invite.getByTestId("invitation-qr")).toBeVisible();
  await expectAxeClean(page);
});

test("lease wizard: deposit cap refused with its legal reference, water minimum acknowledged, sent for signature", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, `/leases/new?unit=${W.unitA301}`);
  const wizard = page.getByTestId("lease-wizard");
  await expect(wizard).toHaveAttribute("data-step", "parties");
  await expect(page.getByTestId("wizard-next")).toBeDisabled();
  await page.getByTestId("party-search").fill("ปรีชา");
  await page.getByTestId("party-hits").getByTestId("choose-lessee").first().click();
  await expect(page.getByTestId("chosen-lessee")).toHaveText("ปรีชา มาใหม่");
  await expectAxeClean(page);
  // A new resident created inline (with the ID number the contract needs) becomes the lessee.
  await page.getByTestId("new-party").click();
  const party = page.getByRole("dialog", { name: "เพิ่มผู้เช่าหรือคู่สัญญา" });
  await party.getByRole("textbox", { name: /^ชื่อ/ }).fill("ณัฐ");
  await party.getByRole("textbox", { name: /^นามสกุล/ }).fill("เข้าใหม่");
  await party.getByRole("textbox", { name: /^เลขบัตร/ }).fill("1101700207030");
  await party.getByTestId("form-submit").click();
  await expect(page.getByTestId("chosen-lessee")).toHaveText("ณัฐ เข้าใหม่");
  await page.getByTestId("wizard-next").click();

  // Terms: nothing goes further until the start date and the rent are valid.
  await expect(wizard).toHaveAttribute("data-step", "terms");
  await expect(page.getByTestId("deposit-cap-hint")).toContainText("3");
  await page.getByTestId("lease-rent").fill("4500.00");
  await expect(page.getByTestId("wizard-next")).toBeDisabled();
  await pickDate(page, /วันเริ่มสัญญา/, "1", 1);
  await page.getByTestId("lease-deposit").fill("13500.00");
  await page.getByTestId("lease-advance").fill("4500.00");
  await expectAxeClean(page);
  await page.getByTestId("wizard-next").click();
  await expect(wizard).toHaveAttribute("data-step", "lines");
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("lease-create").click();

  // 13,500 + 4,500 > 3 months: refused, with the legal reference; no way around it here.
  const refusal = page.getByTestId("problem-notice");
  await expect(refusal).toHaveAttribute("data-code", "compliance.deposit_cap");
  await expect(refusal).toContainText("ข้อ 4 (3)");
  await expect(refusal.getByRole("button", { name: "รับทราบและดำเนินการต่อ" })).toHaveCount(0);
  await expectAxeClean(page);

  // Back to terms: the API's default deposit; a water minimum above the utility's own (D-021a warning).
  await page.getByRole("button", { name: "ย้อนกลับ" }).click();
  await page.getByRole("button", { name: "ย้อนกลับ" }).click();
  await page.getByTestId("lease-deposit").fill("");
  await page.getByTestId("lease-advance").fill("");
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("add-line").click();
  const line = page.getByTestId("lease-line").last();
  await line.getByRole("combobox").selectOption("water_minimum");
  await line.getByRole("textbox").first().fill("ค่าน้ำขั้นต่ำ");
  await line.getByRole("textbox").last().fill("150.00");
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("lease-create").click();
  const warning = page.getByTestId("problem-notice");
  await expect(warning).toHaveAttribute("data-code", "compliance.acknowledgement_required");
  await expect(warning).toContainText("ข้อ 4 (6)");
  await warning.getByRole("button", { name: "รับทราบและดำเนินการต่อ" }).click();

  await expect(wizard).toHaveAttribute("data-step", "contract");
  await expect(page.getByTestId("compliance-checks")).toBeVisible();
  const creates = await received("owner.leases.create");
  expect(creates.at(-1)?.body.acknowledgementIds).toHaveLength(1);
  await page.getByTestId("contract-preview").click();
  await expect(page.getByRole("dialog").locator("iframe")).toBeVisible();
  await page.keyboard.press("Escape");
  await expectAxeClean(page);

  await page.getByTestId("send-for-signature").click();
  await expect(page.getByTestId("lease-sent")).toBeVisible();
  const sends = await received("owner.leases.sendForSignature");
  expect(sends.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByTestId("invite-resident")).toBeVisible();
});

test("lease detail: the resident signs, the lessor countersigns, the timeline shows it", async ({ page }) => {
  await signInOwner(page);
  await ownerControl(`leases/${LEASE_A202}/resident-sign`, "POST");
  await gotoOwner(page, `/leases/${LEASE_A202}`);
  await expect(page.getByTestId("lease-title")).toContainText("A-202");
  await expect(page.getByTestId("lease-timeline")).toBeVisible();
  await expectAxeClean(page);

  await page.getByTestId("lease-countersign").click();
  const dialog = page.getByRole("alertdialog", { name: "เซ็นสัญญาในฐานะผู้ให้เช่า" });
  await expect(dialog.getByRole("button", { name: "เซ็น", exact: true })).toBeDisabled();
  await sign(page);
  await dialog.getByRole("button", { name: "เซ็น", exact: true }).click();
  await expect(page.getByTestId("lessor-signed")).toBeVisible({ timeout: 15_000 });
  const countersigns = await received("owner.leases.countersign");
  expect(countersigns.at(-1)?.idempotencyKey).toBeTruthy();
  expect(String(countersigns.at(-1)?.body.signaturePng ?? "")).not.toHaveLength(0);
  await expect(page.getByTestId("lease-timeline")).toContainText("สัญญามีผล");
});

test("record a notice: short notice asks for the acknowledgement, then the lease shows it", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/leases/${LEASE_A302}`);
  await page.getByTestId("lease-notice").click();
  const dialog = page.getByRole("dialog", { name: "บันทึกการแจ้งเลิกสัญญา" });
  await pickDate(page, /วันย้ายออก/, "28");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog.getByTestId("problem-notice")).toHaveAttribute(
    "data-code",
    "compliance.acknowledgement_required",
  );
  await expect(dialog.getByTestId("problem-notice")).toContainText("ข้อ 4 (11)");
  await dialog.getByRole("button", { name: "รับทราบและดำเนินการต่อ" }).click();
  await expect(page.getByTestId("lease-notice-card")).toBeVisible();
  await expect(page.getByTestId("lease-actions").getByTestId("lease-begin-move-out")).toBeVisible();
  await expectAxeClean(page);
});

test("deposits: countdown and late refunds; settlement with comparison, deductions, proposal and refund", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, "/deposits");
  await expect(page.locator(`[data-testid="deposit-row"][data-late="true"]`)).toHaveCount(1);
  await expect(page.getByTestId("deposit-countdown").first()).toBeVisible();
  await expectAxeClean(page);

  await gotoOwner(page, `/deposits/${DEPOSIT_A303}`);
  await expect(page.getByTestId("comparison-line")).toHaveCount(4);
  await expect(page.locator('[data-testid="comparison-line"][data-changed="true"]')).toHaveCount(2);
  await expectAxeClean(page);

  // Normal wear cannot be deducted: refused with the legal reference.
  await page.getByTestId("add-deduction").click();
  const dialog = page.getByRole("dialog", { name: "เพิ่มรายการหักเงินประกัน" });
  await dialog.getByTestId("deduction-wear").selectOption("normal_wear");
  await dialog.getByTestId("deduction-description").fill("สีผนังซีด");
  await dialog.getByTestId("deduction-amount").fill("300.00");
  await dialog.getByTestId("form-submit").click();
  await expect(dialog.getByTestId("problem-notice")).toHaveAttribute("data-code", "compliance.deposit_wear");
  await expect(dialog.getByTestId("problem-notice")).toContainText("ข้อ 4 (4)");

  // Damage recorded at move-out, with its photo: accepted.
  await dialog.getByTestId("deduction-wear").selectOption("damage");
  await dialog.getByTestId("deduction-item").selectOption({ label: "room · ผนังและสี" });
  await dialog.getByTestId("deduction-description").fill("ซ่อมผนังเป็นรู");
  await dialog.getByTestId("deduction-amount").fill("850.00");
  await dialog.getByTestId("form-submit").click();
  await expect(page.getByTestId("deduction")).toHaveCount(1);
  await expect(page.getByTestId("deductions-total")).toHaveText("฿850.00");

  await page.getByTestId("settlement-propose").click();
  await page.getByRole("dialog").getByTestId("form-submit").click();
  await expect(page.getByTestId("proposed-refund")).toBeVisible();
  await expect(page.getByTestId("statement-pdf")).toBeVisible();

  await ownerControl(`deposits/${DEPOSIT_A303}/resident-response?answer=accepted`, "POST");
  await page.reload();
  await hydrated(page);
  await page.getByTestId("settlement-refund").click();
  const refund = page.getByRole("alertdialog", { name: "บันทึกการคืนเงินประกัน" });
  await refund.getByTestId("refund-method").selectOption("cash");
  const confirm = refund.getByRole("button", { name: "บันทึกการคืนเงิน" });
  await expect(confirm).toBeDisabled();
  await refund.getByLabel(/พิมพ์ A-303/).fill("A-303");
  await confirm.click();
  await expect(page.getByTestId("refunded")).toBeVisible();
  expect((await received("owner.deposits.recordRefund")).at(-1)?.idempotencyKey).toBeTruthy();
  await expectAxeClean(page);

  // The late one: B-102 is highlighted as late on its page too.
  await gotoOwner(page, `/deposits/${DEPOSIT_B102}`);
  await expect(page.getByText("คืนเงินประกันล่าช้า")).toBeVisible();
});
