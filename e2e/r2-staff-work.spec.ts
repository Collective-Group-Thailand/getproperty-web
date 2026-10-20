import { expect, test } from "@playwright/test";

import { MOCK_API } from "../playwright.config";
import { expectAxeClean, expectTargets48, gotoStaff, hydrated, signInStaff } from "./support/staff";

/**
 * F4 4.4 on the mock API — the staff PWA's R2 work: Today from `GET /v1/staff/tasks` (groups by type and
 * floor, mine / everyone, a parcel handed over from the list with the PIN); a work order with its door code,
 * check-in, before photos with the fake camera, waiting for parts → resume, a cost, completion refused
 * without an after photo, after photo, complete; a request taken (a work order assigned to me); the parcel
 * intake (photo → unit → the resident is told) and a staff-confirmed hand-over — axe and 48-px targets on
 * every screen.
 */
test.describe.configure({ mode: "serial" });

const WO_POWER = "70000000-0000-4000-8000-000000000001";
const SR_LEAK = "5e700000-0000-4000-8000-000000000001";

async function r2<T>(): Promise<T> {
  return (await (await fetch(`${MOCK_API}/__mock/r2/state`)).json()) as T;
}

test.beforeAll(async () => {
  await fetch(`${MOCK_API}/__mock/r2/reset`, { method: "POST" });
});

test("Today lists the tasks by type and floor; a parcel is handed over from the list with the PIN", async ({
  page,
}) => {
  await signInStaff(page);
  const tasks = page.getByTestId("today-tasks");
  // Mine = assigned to me and unassigned (D-213): my repair on floor 2 and the building's preventive check.
  await expect(tasks.getByTestId("today-work-orders").getByRole("link")).toHaveCount(2);
  await expect(tasks.getByTestId("today-parcels").getByRole("link")).toHaveCount(2);
  await expect(tasks.getByTestId("today-inspections")).toBeVisible();
  await expect(tasks.getByTestId("today-work-orders").getByTestId("task-floor")).toHaveText([
    "Whole building",
    "ชั้น 2",
  ]);
  await expectAxeClean(page);
  await expectTargets48(page.locator("main"));

  await page.getByTestId("tasks-everyone").click();
  await expect(page).toHaveURL(/mine=0/);
  await expect(tasks.getByTestId("today-work-orders").getByRole("link")).toHaveCount(2);
  await page.getByTestId("tasks-mine").click();
  await hydrated(page);

  const parcel = tasks.getByTestId("today-parcels").getByTestId("task").filter({ hasText: "A-201" });
  await parcel.getByTestId("task-complete").click();
  await parcel.getByTestId("task-pin").fill("111111");
  await parcel.getByTestId("task-pin-submit").click();
  await expect(parcel.getByTestId("task-problem")).toBeVisible();
  await parcel.getByTestId("task-pin").fill("482913");
  await parcel.getByTestId("task-pin-submit").click();
  await expect(tasks.getByTestId("today-parcels").getByRole("link")).toHaveCount(1);
  const state = await r2<{ parcels: { unitNo: string; status: string; pickupConfirmedBy: string | null }[] }>();
  expect(state.parcels.find((one) => one.unitNo === "A-201")).toMatchObject({
    status: "picked_up",
    pickupConfirmedBy: "resident_pin",
  });
});

test("a work order: door code, check-in, before photos, parts, a cost, after photo, complete", async ({ page }) => {
  await signInStaff(page);
  await page.getByTestId("today-work-orders").getByRole("link", { name: /A-202/ }).click();
  await hydrated(page);
  await expect(page.getByTestId("staff-work-order")).toHaveAttribute("data-status", "assigned");
  await page.getByTestId("access-show").click();
  await expect(page.getByTestId("access-pin")).toHaveText("730215");
  await expectAxeClean(page);
  await expectTargets48(page.locator("main"));

  await page.getByTestId("check-in").click();
  await expect(page.getByTestId("staff-work-order")).toHaveAttribute("data-status", "in_progress");

  await page.getByTestId("take-before").click();
  const camera = page.getByTestId("work-camera");
  await expect(camera.getByTestId("camera-capture")).toHaveAttribute("data-state", "live");
  await camera.getByTestId("camera-shutter").click();
  await camera.getByTestId("camera-done").click();
  await expect(page.getByTestId("photos-before").getByRole("listitem")).toHaveCount(1, { timeout: 15_000 });

  await page.getByTestId("parts-note").fill("รอเบรกเกอร์ 16A");
  await page.getByTestId("wait-parts").click();
  await expect(page.getByTestId("resume")).toBeVisible();
  await page.getByTestId("resume").click();
  await expect(page.getByTestId("wait-parts")).toBeVisible();

  await page.getByTestId("cost-description").fill("เบรกเกอร์ 16A");
  await page.getByTestId("cost-unit-price").fill("185.00");
  await page.getByTestId("cost-add").click();
  await expect(page.getByTestId("cost-line")).toHaveCount(1);
  await expect(page.getByTestId("cost-total")).toContainText("185.00");

  await page.getByTestId("completion-note").fill("เปลี่ยนเบรกเกอร์ ปลั๊กใช้งานได้");
  await page.getByTestId("complete").click();
  await expect(page.getByTestId("work-problem")).toBeVisible();

  await page.getByTestId("take-after").click();
  await expect(page.getByTestId("work-camera").getByTestId("camera-capture")).toHaveAttribute("data-state", "live");
  await page.getByTestId("work-camera").getByTestId("camera-shutter").click();
  await page.getByTestId("work-camera").getByTestId("camera-done").click();
  await expect(page.getByTestId("photos-after").getByRole("listitem")).toHaveCount(1, { timeout: 15_000 });
  await page.getByTestId("complete").click();
  await expect(page.getByTestId("staff-work-order")).toHaveAttribute("data-status", "done");
  await expectAxeClean(page);

  const state = await r2<{
    workOrders: { id: string; status: string; beforePhotoIds: string[]; afterPhotoIds: string[] }[];
  }>();
  const done = state.workOrders.find((one) => one.id === WO_POWER)!;
  expect(done.status).toBe("done");
  expect(done.beforePhotoIds).toHaveLength(1);
  expect(done.afterPhotoIds).toHaveLength(1);
});

test("a request is taken: a work order assigned to me", async ({ page }) => {
  await signInStaff(page);
  await gotoStaff(page, "/work-orders");
  await expect(page.getByTestId("open-requests").getByRole("link")).toHaveCount(2);
  await expectAxeClean(page);
  await page
    .getByTestId("open-requests")
    .getByRole("link", { name: /SR-2610-0001/ })
    .click();
  await hydrated(page);
  await expect(page.getByTestId("staff-request")).toBeVisible();
  await expectAxeClean(page);
  await expectTargets48(page.locator("main"));
  await page.getByTestId("request-take").click();
  await expect(page.getByTestId("staff-work-order")).toHaveAttribute("data-status", "assigned");
  const state = await r2<{ workOrders: { serviceRequestId: string | null; assignee: { id: string } | null }[] }>();
  expect(state.workOrders.find((one) => one.serviceRequestId === SR_LEAK)?.assignee?.id).toBe(
    "3b241101-e2bb-4255-8caf-4136c566a904",
  );
});

test("parcels: intake with the camera, a staff-confirmed hand-over", async ({ page }) => {
  await signInStaff(page);
  await gotoStaff(page, "/parcels");
  await expect(page.getByTestId("parcel")).toHaveCount(1);
  await expectAxeClean(page);
  await expectTargets48(page.locator("main"));

  await page.getByTestId("intake-photo").click();
  await expect(page.getByTestId("work-camera").getByTestId("camera-capture")).toHaveAttribute("data-state", "live");
  await page.getByTestId("work-camera").getByTestId("camera-shutter").click();
  await page.getByTestId("work-camera").getByTestId("camera-done").click();
  await expect(page.getByTestId("intake-preview")).toBeVisible();
  await page.getByTestId("intake-unit").selectOption({ label: "A-301 · ชั้น 3" });
  await page.getByTestId("intake-carrier").fill("Kerry");
  await page.getByTestId("intake-submit").click();
  await expect(page.getByTestId("intake-saved")).toContainText("A-301");
  await expect(page.getByTestId("parcel")).toHaveCount(2);

  const a301 = page.locator('[data-testid="parcel"][data-unit="A-301"]');
  await a301.getByTestId("pick-up").click();
  await a301.getByTestId("pick-up-staff").click();
  await expect(page.getByTestId("parcel")).toHaveCount(1);
  const state = await r2<{
    parcels: { unitNo: string; status: string; pickupConfirmedBy: string | null; carrier: string | null }[];
  }>();
  expect(state.parcels.find((one) => one.unitNo === "A-301" && one.carrier === "Kerry")).toMatchObject({
    status: "picked_up",
    pickupConfirmedBy: "staff",
  });
});
