import { expect, test, type Page } from "@playwright/test";

import { MOCK_API } from "../playwright.config";
import { gotoOwner, setBuilding, signInOwner, W } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * F2 2.7 on the mock API — service: the requests inbox with the SLA clock of each request (time left, the
 * API's two-hour warning, breached), a new request with a photo, triage → a work order assigned to staff
 * with a visit window, the work order's steps (check-in, before photo, waiting for parts → resume, a cost
 * line, completion refused without an after photo, after photo, complete) and the typed verification;
 * categories & SLA overrides; maintenance plans with the next-due list and an If-Match edit; the dashboard
 * queue (overdue requests, parcels waiting) and the unit drawer's open requests — axe on every screen.
 */
test.describe.configure({ mode: "serial" });

const SR = {
  leak: "5e700000-0000-4000-8000-000000000001",
  power: "5e700000-0000-4000-8000-000000000002",
  auto: "5e700000-0000-4000-8000-000000000003",
} as const;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function r2State<T>(): Promise<T> {
  return (await (await fetch(`${MOCK_API}/__mock/r2/state`)).json()) as T;
}

async function upload(scope: Pick<Page, "getByTestId">, testId: string, name = "photo.png") {
  await scope
    .getByTestId(testId)
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: "image/png", buffer: PNG });
  await expect(scope.getByTestId(`${testId}-state`)).toContainText(name, { timeout: 15_000 });
}

test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/r2/reset`, { method: "POST" });
});

test("dashboard queue and the inbox with SLA clocks, filters and a new request", async ({ page }) => {
  await signInOwner(page);
  await setBuilding(page, W.buildingA);
  await gotoOwner(page, "/dashboard");
  const queue = page.getByTestId("today-queue");
  await expect(queue.getByText("แจ้งซ่อมเกิน SLA 1 รายการ")).toBeVisible();
  await expect(queue.getByText("พัสดุรอรับ 2 ชิ้น")).toBeVisible();
  // The counts are the API's (`DashboardAttentionDto`); the item opens the inbox filtered on the SLA breach.
  await queue.getByText("แจ้งซ่อมเกิน SLA 1 รายการ").click();
  await expect(page).toHaveURL(/sla=breached/);
  await expect(page.getByTestId("request-row")).toHaveCount(1);
  await expect(page.getByTestId("request-row")).toHaveAttribute("data-ref", "SR-2610-0002");

  await gotoOwner(page, "/service-requests");
  await expect(page.getByTestId("request-row")).toHaveCount(3);
  await expect(page.locator(`[data-ref="SR-2610-0002"] [data-testid="sla-timer"]`)).toHaveAttribute(
    "data-state",
    "breached",
  );
  await expect(page.locator(`[data-ref="SR-2610-0003"] [data-testid="sla-timer"]`)).toHaveAttribute(
    "data-state",
    "warning",
  );
  await expect(page.locator(`[data-ref="SR-2610-0001"] [data-testid="sla-timer"]`)).toHaveAttribute("data-state", "ok");
  await expect(page.locator(`[data-ref="SR-2610-0003"]`)).toContainText("มิเตอร์ไม่ส่งข้อมูลตามกำหนด");
  await expectAxeClean(page);

  await page.getByTestId("filter-category").selectOption({ label: "ประปา" });
  await expect(page.getByTestId("request-row")).toHaveCount(1);
  await page.getByTestId("filter-category").selectOption("");
  await expect(page.getByTestId("request-row")).toHaveCount(3);
  await page.getByTestId("filter-view").selectOption("all");
  await expect(page).toHaveURL(/view=all/);
  await expect(page.getByTestId("request-row")).toHaveCount(5);

  await page.getByTestId("new-request").click();
  const dialog = page.getByRole("dialog", { name: "แจ้งซ่อมใหม่" });
  await dialog.getByTestId("request-unit").selectOption({ label: "A-301" });
  await dialog.getByTestId("request-category").selectOption({ label: "ไฟฟ้า · SLA 24 ชม." });
  await dialog.getByTestId("request-description").fill("ไฟห้องน้ำกระพริบ");
  await upload(dialog, "request-photos", "bulb.png");
  await expectAxeClean(page);
  await dialog.getByTestId("form-submit").click();
  await expect(page.getByTestId("service-request")).toBeVisible();
  await expect(page.getByTestId("request-description")).toHaveText("ไฟห้องน้ำกระพริบ");
  await expect(page.getByTestId("request-photos").getByTestId("photo-thumb")).toHaveCount(1);
  const created = (
    await r2State<{
      received: { op: string; idempotencyKey: string | null; body: { photoDocumentIds?: string[] } }[];
    }>()
  ).received
    .filter((entry) => entry.op === "owner.serviceRequests.create")
    .at(-1)!;
  expect(created.idempotencyKey).toBeTruthy();
  expect(created.body.photoDocumentIds).toHaveLength(1);
});

test("the message thread and the resident's preferred visit on a request and its work order", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/service-requests/${SR.power}`);
  await expect(page.getByTestId("request-preferred-visit")).toHaveText("ช่วงเย็น");
  await expect(page.getByTestId("request-visit-confirmed")).toContainText("ผู้เช่ายืนยันนัดแล้ว");
  const thread = page.getByTestId("service-thread");
  await expect(thread.getByTestId("thread-message")).toHaveCount(2);
  await expect(thread.getByTestId("thread-message").first()).toHaveAttribute("data-author", "resident");
  await expectAxeClean(page);
  await thread.getByTestId("thread-input").fill("ช่างจะเข้าไปเย็นนี้ 18:30 นะคะ");
  await thread.getByTestId("thread-send").click();
  await expect(thread.getByTestId("thread-message")).toHaveCount(3);
  await expect(thread.getByTestId("thread-message").last()).toHaveAttribute("data-mine", "true");
  await expect(thread.getByTestId("thread-input")).toHaveValue("");
  const posted = (
    await r2State<{ received: { op: string; idempotencyKey: string | null; body: { body?: string } }[] }>()
  ).received.filter((entry) => entry.op === "owner.serviceRequests.postMessage");
  expect(posted.at(-1)?.body.body).toBe("ช่างจะเข้าไปเย็นนี้ 18:30 นะคะ");
  expect(posted.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);

  // A request without a preference says so; nothing is confirmed before a visit is planned.
  await gotoOwner(page, `/service-requests/${SR.auto}`);
  await expect(page.getByTestId("request-preferred-visit")).toHaveText("ไม่ได้ระบุ");
  await expect(page.getByTestId("request-visit-unconfirmed")).toHaveCount(0);
  await expect(page.getByTestId("thread-empty")).toBeVisible();
});

test("triage, a work order for staff with a visit window, the timeline", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/service-requests/${SR.leak}`);
  await expect(page.getByTestId("request-timeline").getByText("แจ้งเข้ามา")).toBeVisible();
  await expectAxeClean(page);

  await page.getByTestId("request-triage").click();
  const triage = page.getByRole("dialog", { name: /คัดกรอง SR-2610-0001/ });
  await triage.getByTestId("triage-priority").selectOption("high");
  await triage.getByTestId("form-submit").click();
  await expect(page.getByTestId("request-triage")).toHaveCount(0);
  await expect(page.getByTestId("request-timeline").getByText("คัดกรอง", { exact: true })).toBeVisible();

  await page.getByTestId("request-create-work-order").click();
  const create = page.getByRole("dialog", { name: /เปิดใบงานสำหรับ SR-2610-0001/ });
  await create.getByTestId("work-order-title").fill("เปลี่ยนก๊อกอ่างล้างหน้า A-201");
  await create.getByRole("radio", { name: "ทีมงาน" }).click();
  await create.getByTestId("assignee-member").selectOption({ label: "Somsak Staff · ทีมงาน" });
  await create.getByTestId("scheduled-at").fill("2030-01-15T09:00");
  await create.getByTestId("scheduled-until").fill("2030-01-15T12:00");
  await expectAxeClean(page);
  await create.getByTestId("form-submit").click();
  await expect(page.getByTestId("work-order")).toBeVisible();
  await expect(page.getByTestId("work-order-assignee")).toContainText("Somsak Staff");
  const state = await r2State<{ workOrders: { title: string; scheduledAt: string; access: unknown[] }[] }>();
  const workOrder = state.workOrders.find((one) => one.title === "เปลี่ยนก๊อกอ่างล้างหน้า A-201")!;
  expect(workOrder.scheduledAt).toBe("2030-01-15T02:00:00.000Z");
  expect(workOrder.access).toHaveLength(1);

  await gotoOwner(page, `/service-requests/${SR.leak}`);
  await expect(page.getByTestId("request-work-order")).toHaveCount(1);
  await expect(page.getByTestId("request-timeline").getByText("มอบหมายงาน")).toBeVisible();
});

test("work order steps: before photo, parts, cost, complete needs an after photo, verify typed", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/work-orders");
  await expect(page.getByTestId("work-order-row")).toHaveCount(3);
  await expectAxeClean(page);
  await page.getByRole("link", { name: "เปลี่ยนก๊อกอ่างล้างหน้า A-201" }).click();
  await expect(page.getByTestId("work-order")).toBeVisible();
  await expectAxeClean(page);

  await page.getByTestId("work-order-check-in").click();
  await expect(page.getByTestId("work-order-wait-parts")).toBeVisible();

  await upload(page.getByTestId("photos-before-card"), "photos-before", "before.png");
  await page.getByTestId("attach-before").click();
  await expect(page.getByTestId("work-order-before").getByTestId("photo-thumb")).toHaveCount(1);

  await page.getByTestId("work-order-wait-parts").click();
  const parts = page.getByRole("dialog", { name: /รออะไหล่/ });
  await parts.getByRole("textbox").fill("ก๊อกรุ่นเดิม");
  await parts.getByTestId("form-submit").click();
  await expect(page.getByTestId("work-order-resume")).toBeVisible();
  await page.getByTestId("work-order-resume").click();
  await expect(page.getByTestId("work-order-wait-parts")).toBeVisible();

  await page.getByTestId("cost-add").click();
  const cost = page.getByRole("dialog", { name: /ค่าใช้จ่ายของ/ });
  await cost.getByTestId("cost-description").fill("ก๊อกน้ำ");
  await cost.getByTestId("cost-quantity").fill("2");
  await cost.getByTestId("cost-unit-price").fill("120.00");
  await cost.getByTestId("form-submit").click();
  await expect(page.getByTestId("cost-row")).toHaveCount(1);
  await expect(page.getByTestId("work-order-cost-total")).toContainText("240.00");

  await page.getByTestId("work-order-complete").click();
  const complete = page.getByRole("dialog", { name: /เสร็จแล้ว\?/ });
  await complete.getByTestId("completion-note").fill("เปลี่ยนก๊อกใหม่ ทดสอบแล้วไม่รั่ว");
  await complete.getByTestId("form-submit").click();
  await expect(complete.getByTestId("problem-notice")).toHaveAttribute("data-code", "work_order.photo_required");
  await complete.getByRole("button", { name: "ยกเลิก" }).click();

  await upload(page.getByTestId("photos-after-card"), "photos-after", "after.png");
  await page.getByTestId("attach-after").click();
  await expect(page.getByTestId("work-order-after").getByTestId("photo-thumb")).toHaveCount(1);
  await page.getByTestId("work-order-complete").click();
  await page
    .getByRole("dialog", { name: /เสร็จแล้ว\?/ })
    .getByTestId("form-submit")
    .click();
  await expect(page.getByTestId("work-order-verify")).toBeVisible();

  await page.getByTestId("work-order-verify").click();
  const verify = page.getByRole("alertdialog", { name: /ตรวจรับ/ });
  await expect(verify).toContainText("240.00");
  const phrase = verify.getByRole("textbox", { name: /^พิมพ์/ });
  await phrase.fill((await phrase.getAttribute("placeholder")) ?? "");
  await expectAxeClean(page);
  await verify.getByRole("button", { name: "ตรวจรับงาน" }).click();
  await expect(page.getByTestId("work-order-actions")).toBeEmpty();
  await expect(page.getByTestId("work-order")).toContainText("ตรวจรับเมื่อ");
});

test("categories & SLA overrides, maintenance plans with the next-due list", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/service-categories");
  await expect(page.locator('[data-key="aircon"][data-source="tenant"]')).toBeVisible();
  await expectAxeClean(page);
  await page.getByTestId("category-edit-plumbing").click();
  const edit = page.getByRole("dialog", { name: /แก้ไขประเภท ประปา/ });
  await edit.getByTestId("category-sla").fill("12");
  await edit.getByTestId("form-submit").click();
  await expect(page.locator('[data-key="plumbing"]')).toHaveAttribute("data-source", "tenant");
  await expect(page.locator('[data-key="plumbing"] [data-testid="category-hours"]')).toHaveText("12 ชม.");
  await page.getByTestId("category-reset-plumbing").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ใช้ค่าเริ่มต้น" }).click();
  await expect(page.locator('[data-key="plumbing"]')).toHaveAttribute("data-source", "platform");

  await setBuilding(page, W.buildingA);
  await gotoOwner(page, "/maintenance");
  await expect(page.getByTestId("plan-row")).toHaveCount(2);
  await expect(page.getByTestId("plan-row").first()).toHaveAttribute("data-overdue", "true");
  await expectAxeClean(page);

  await page.getByTestId("plan-add").click();
  const plan = page.getByRole("dialog", { name: "เพิ่มแผนบำรุงรักษา" });
  // The building's own equipment (GET /v1/owner/buildings/{id}/asset-items); a unit narrows to its items.
  await expect(plan.getByTestId("plan-asset").locator("option", { hasText: "ปั๊มน้ำ · ปั๊มน้ำอาคาร A" })).toHaveCount(
    1,
  );
  await plan.getByTestId("plan-unit").selectOption({ label: "A-201" });
  await expect(
    plan.getByTestId("plan-asset").locator("option", { hasText: "เครื่องปรับอากาศ · แอร์ห้อง A-201" }),
  ).toHaveCount(1);
  await expect(plan.getByTestId("plan-asset").locator("option", { hasText: "ปั๊มน้ำ" })).toHaveCount(0);
  await plan.getByTestId("plan-unit").selectOption({ index: 0 });
  await plan.getByTestId("plan-asset").selectOption({ label: "ปั๊มน้ำ · ปั๊มน้ำอาคาร A" });
  await plan.getByTestId("plan-title").fill("ล้างปั๊มน้ำ");
  await plan.getByTestId("plan-interval").fill("180");
  await plan.getByTestId("form-submit").click();
  await expect(page.getByTestId("plan-row")).toHaveCount(3);

  await page.getByTestId("plan-row").first().getByTestId("plan-edit").click();
  const editPlan = page.getByRole("dialog", { name: /แก้ไขแผน/ });
  await editPlan.getByTestId("plan-interval").fill("365");
  await editPlan.getByTestId("form-submit").click();
  await expect(page.getByTestId("plan-row").first()).toContainText("ทุก 365 วัน");
});

test("the unit page lists its open service requests", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/units/${W.unitA301}`);
  await expect(page.getByTestId("unit-requests").getByRole("link")).toHaveCount(1);
  await expect(page.getByTestId("unit-requests")).toContainText("ไฟห้องน้ำกระพริบ");
  await expectAxeClean(page);
  await gotoOwner(page, `/service-requests/${SR.auto}`);
  await expect(page.getByTestId("request-sla").getByTestId("sla-timer")).toHaveAttribute("data-state", "warning");
});
