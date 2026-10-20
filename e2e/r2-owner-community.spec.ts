import { expect, test, type Page } from "@playwright/test";

import { MOCK_API } from "../playwright.config";
import { gotoOwner, setBuilding, signInOwner, W } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * F2 2.7 on the mock API — access and community: locks with low battery; a lock's credentials, a resident's
 * code revoked with a typed confirmation and a reason, a visitor code whose PIN is shown once, the unlock log;
 * no arrears wording anywhere on the access screens (D-024 / D-071); an announcement composed with a
 * translation and a floor audience, published, read receipts, archived; the parcels log (receive with a
 * photo, a wrong PIN refused, the right PIN, a return); facilities with a booking approved and one rejected
 * with a reason; a new rules version and the acknowledgements; contacts — axe on every screen.
 */
test.describe.configure({ mode: "serial" });

const LOCK_A201 = "10c00000-0000-4000-8000-000000000001";
const ANNOUNCEMENT_WATER = "a7700000-0000-4000-8000-000000000001";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function received(
  op: string,
): Promise<{ op: string; idempotencyKey: string | null; body: Record<string, unknown> }[]> {
  const state = (await (await fetch(`${MOCK_API}/__mock/r2/state`)).json()) as {
    received: { op: string; idempotencyKey: string | null; body: Record<string, unknown> }[];
  };
  return state.received.filter((entry) => entry.op === op);
}

async function typePhrase(dialog: ReturnType<Page["getByRole"]>) {
  const phrase = dialog.getByRole("textbox", { name: /^พิมพ์/ });
  await phrase.fill((await phrase.getAttribute("placeholder")) ?? "");
}

test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/r2/reset`, { method: "POST" });
});

test("locks: battery, credentials, revoke with a reason, a visitor code shown once, the unlock log", async ({
  page,
}) => {
  await signInOwner(page);
  await setBuilding(page, W.buildingA);
  await gotoOwner(page, "/access");
  await expect(page.getByTestId("lock-row")).toHaveCount(2);
  await expect(page.locator('[data-testid="lock-row"][data-battery="low"]')).toContainText("แบตใกล้หมด 15%");
  await expect(page.getByTestId("access-rule")).toContainText("ไม่ล็อกผู้เช่าเพราะค้างชำระ");
  await expect(page.locator("body")).not.toContainText(/ค้างจ่าย|ยอดค้าง|ใบแจ้งหนี้/);
  await expectAxeClean(page);

  await gotoOwner(page, `/access/${LOCK_A201}`);
  await expect(page.getByTestId("credential-row")).toHaveCount(1);
  await expect(page.getByTestId("event-row")).toHaveCount(3);
  await expectAxeClean(page);

  const resident = page.locator('[data-testid="credential-row"][data-kind="resident"]');
  await resident.getByTestId("credential-revoke").click();
  const revoke = page.getByRole("alertdialog", { name: /ยกเลิกสิทธิ์ของ สมศักดิ์ ใจดี/ });
  await expect(revoke).toContainText("ไม่ใช่การทวงหนี้");
  await revoke.getByTestId("revoke-reason").fill("ผู้เช่าทำรหัสหายและขอรหัสใหม่");
  await typePhrase(revoke);
  await revoke.getByRole("button", { name: "ยกเลิกสิทธิ์" }).click();
  await expect(page.locator('[data-testid="credential-row"][data-kind="resident"]')).toHaveCount(0);
  expect((await received("owner.access.revoke")).at(-1)?.body).toMatchObject({
    reason: "ผู้เช่าทำรหัสหายและขอรหัสใหม่",
  });

  await page.getByTestId("code-visitor").click();
  const visitor = page.getByRole("dialog", { name: "ออกรหัสให้ผู้มาติดต่อ" });
  await visitor.getByTestId("code-visitor-name").fill("ช่างประปา");
  await visitor.getByTestId("form-submit").click();
  await expect(page.getByTestId("issued-pin")).toHaveText(/^\d{6}$/);
  expect((await received("owner.access.visitorCode")).at(-1)?.idempotencyKey).toBeTruthy();
  await page.getByTestId("issued-hide").click();
  await expect(page.getByTestId("issued-pin")).toHaveCount(0);

  await page.getByTestId("credentials-all").click();
  await expect(page.locator('[data-testid="credential-row"][data-status="revoked"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="credential-row"][data-status="expired"]')).toHaveCount(1);
});

test("announcements: compose with a translation and floors, publish, read receipts, archive", async ({ page }) => {
  await signInOwner(page);
  await setBuilding(page, W.buildingA);
  await gotoOwner(page, "/announcements");
  await expect(page.getByTestId("announcement-row")).toHaveCount(3);
  await expectAxeClean(page);

  await gotoOwner(page, "/announcements/new");
  await page.getByTestId("announcement-title").fill("ตัดไฟซ่อมหม้อแปลง");
  await page.getByTestId("announcement-body").fill("การไฟฟ้าจะดับไฟวันอาทิตย์ 10:00–14:00 น.");
  await page.getByRole("radio", { name: "English" }).click();
  await page.getByTestId("translation-title-en").fill("Power cut");
  await page.getByTestId("translation-body-en").fill("No power on Sunday 10:00–14:00.");
  await page.getByRole("radio", { name: "บางชั้น" }).click();
  await page.getByTestId("audience-floors").getByRole("checkbox", { name: "ชั้น 2" }).click();
  await expectAxeClean(page);
  await page.getByTestId("announcement-save").click();
  await expect(page.getByTestId("announcement")).toBeVisible();
  const created = (await received("owner.announcements.create")).at(-1)!.body;
  expect(created).toMatchObject({
    publish: false,
    translations: { en: { title: "Power cut", body: "No power on Sunday 10:00–14:00." } },
  });
  expect((created.audienceFilter as { floorIds: string[] }).floorIds).toHaveLength(1);

  await page.getByTestId("announcement-publish").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "เผยแพร่" }).click();
  await expect(page.getByTestId("announcement-reads")).toBeVisible();
  await expect(page.getByTestId("announcement-body")).toHaveText("การไฟฟ้าจะดับไฟวันอาทิตย์ 10:00–14:00 น.");
  await expect(page.getByTestId("translation-en")).toContainText("Power cut");

  await gotoOwner(page, `/announcements/${ANNOUNCEMENT_WATER}`);
  await expect(page.getByTestId("read-count")).toHaveText("อ่านแล้ว 2 จาก 6 คน");
  await expect(page.getByTestId("read-row")).toHaveCount(2);
  await expectAxeClean(page);
  await page.getByTestId("announcement-archive").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "เก็บประกาศ" }).click();
  await expect(page.getByTestId("announcement-archive")).toHaveCount(0);
  await expect(page.getByTestId("read-row")).toHaveCount(2);
});

test("parcels: receive with a photo, a wrong PIN refused, the right PIN, a return", async ({ page }) => {
  await signInOwner(page);
  await setBuilding(page, W.buildingA);
  await gotoOwner(page, "/parcels");
  await expect(page.getByTestId("parcel-row")).toHaveCount(2);
  await expectAxeClean(page);

  await page.getByTestId("parcel-receive").click();
  const receive = page.getByRole("dialog", { name: "รับพัสดุเข้า" });
  await receive.getByTestId("parcel-photo").locator('input[type="file"]').setInputFiles({
    name: "parcel.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(receive.getByTestId("parcel-photo-state")).toContainText("parcel.png", { timeout: 15_000 });
  await receive.getByTestId("parcel-unit").selectOption({ label: "A-301" });
  await receive.getByTestId("parcel-carrier").fill("Flash");
  await receive.getByTestId("form-submit").click();
  await expect(page.getByTestId("parcel-row")).toHaveCount(3);

  const a201 = page.locator('[data-testid="parcel-row"][data-unit="A-201"]');
  await a201.getByTestId("parcel-pick-up").click();
  const pickUp = page.getByRole("alertdialog", { name: /มอบพัสดุของห้อง A-201/ });
  await pickUp.getByTestId("parcel-pin").fill("000000");
  await pickUp.getByRole("button", { name: "มอบพัสดุ" }).click();
  await expect(pickUp.getByTestId("problem-notice")).toHaveAttribute("data-code", "parcel.pin_mismatch");
  await pickUp.getByTestId("parcel-pin").fill("482913");
  await pickUp.getByRole("button", { name: "มอบพัสดุ" }).click();
  await expect(page.locator('[data-testid="parcel-row"][data-unit="A-201"]')).toHaveCount(0);

  const a202 = page.locator('[data-testid="parcel-row"][data-unit="A-202"]');
  await a202.getByTestId("parcel-return").click();
  const back = page.getByRole("alertdialog", { name: /ส่งคืนพัสดุของห้อง A-202/ });
  await back.getByTestId("parcel-return-reason").fill("ไม่มีผู้รับเกิน 7 วัน");
  await back.getByRole("button", { name: "ส่งคืน" }).click();
  await expect(page.getByTestId("parcel-row")).toHaveCount(1);
  await page.getByTestId("filter-view").selectOption("all");
  await expect(page.getByTestId("parcel-row")).toHaveCount(4);
});

test("facilities and bookings, building rules, contacts", async ({ page }) => {
  await signInOwner(page);
  await setBuilding(page, W.buildingA);
  await gotoOwner(page, "/community/facilities");
  await expect(page.getByTestId("facility-card")).toContainText("ห้องประชุมชั้น 1");
  await expect(page.getByTestId("booking-row")).toHaveCount(2);
  await expectAxeClean(page);
  const requested = page.locator('[data-testid="booking-row"][data-status="requested"]');
  await requested.getByTestId("booking-approve").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "อนุมัติ" }).click();
  await expect(page.locator('[data-testid="booking-row"][data-status="requested"]')).toHaveCount(0);
  await page.getByTestId("week-previous").click();
  await expect(page.getByTestId("booking-row")).toHaveCount(1);
  await page.getByTestId("booking-row").getByTestId("booking-no-show").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ไม่มาใช้" }).click();
  await expect(page.locator('[data-testid="booking-row"][data-status="no_show"]')).toHaveCount(1);

  await page.getByTestId("facility-edit").click();
  const edit = page.getByRole("dialog", { name: /แก้ไข ห้องประชุมชั้น 1/ });
  await edit.getByTestId("facility-slot").fill("30");
  await edit.getByTestId("form-submit").click();
  await expect(page.getByTestId("facility-card")).toContainText("ช่วงละ 30 นาที");

  await gotoOwner(page, "/community/rules");
  await expect(page.locator('[data-testid="rule-row"][data-state="in-force"]')).toHaveCount(1);
  await expect(page.getByTestId("ack-row")).toHaveCount(2);
  await expectAxeClean(page);
  await page.getByTestId("rule-add").click();
  const rule = page.getByRole("dialog", { name: "ออกระเบียบฉบับใหม่" });
  await rule.getByTestId("rule-body").fill("1. งดส่งเสียงดังหลัง 22:00 น.\n2. ห้ามสูบบุหรี่\n3. งดเลี้ยงสัตว์");
  await rule.getByTestId("form-submit").click();
  await expect(page.locator('[data-testid="rule-row"][data-state="scheduled"]')).toHaveCount(1);

  await gotoOwner(page, "/community/contacts");
  await expect(page.getByTestId("contact-row")).toHaveCount(3);
  await expectAxeClean(page);
  await page.getByTestId("contact-add").click();
  const contact = page.getByRole("dialog", { name: "เพิ่มเบอร์ติดต่อ" });
  await contact.getByTestId("contact-name").fill("การไฟฟ้านครหลวง");
  await contact.getByTestId("contact-phone").fill("1130");
  await contact.getByTestId("form-submit").click();
  await expect(page.getByTestId("contact-row")).toHaveCount(4);
  await page.getByTestId("contact-row").last().getByTestId("contact-remove").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ลบ" }).click();
  await expect(page.getByTestId("contact-row")).toHaveCount(3);
});
