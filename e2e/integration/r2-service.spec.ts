import { expect, test, type Page } from "@playwright/test";

import { INT_CONTROL, INT_HOSTS } from "../../playwright.integration.config";
import { requestOtp } from "./otp";

/**
 * F2 2.7 + F4 4.4 against the real getproperty-api (e2e/integration/harness.ts, the `/r2` world): a resident
 * reports a leak through the API (what getproperty-liff does); the owner opens it and creates a work order
 * assigned to the building's Staff member; the staff member checks in on the PWA, takes the before and the
 * after photo with the camera and completes it; the owner verifies it (typed). Then a parcel taken in on the
 * PWA (photo → unit) is handed over with the PIN the resident reads in their app (`GET /v1/resident/parcels`).
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

interface R2World {
  ownerPhone: string;
  staffPhone: string;
  tenantName: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitNo: string;
  residentName: string;
}

const control = async <T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> => {
  const response = await fetch(`${INT_CONTROL}${path}`, { method });
  const body = (await response.json()) as T;
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(body)}`);
  return body;
};

/** The browser's presigned PUTs land in the API process's fake object storage. */
async function routeStorage(page: Page) {
  await page.route("https://fake-s3.invalid/**", async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      await fetch(`${INT_CONTROL}/storage?url=${encodeURIComponent(request.url())}`, {
        method: "PUT",
        headers: { "content-type": request.headers()["content-type"] ?? "application/octet-stream" },
        body: new Uint8Array(request.postDataBuffer() ?? Buffer.alloc(0)),
      });
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", etag: '"x"' }, body: "" });
    }
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "PUT, GET",
          "access-control-allow-headers": "content-type",
        },
      });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}

async function hydrated(page: Page, zone: "owner" | "staff") {
  await page.waitForFunction((name) => document.documentElement?.dataset.hydrated === name, zone);
}

async function signInOwner(page: Page, world: R2World) {
  await page.goto(`${INT_HOSTS.owner}/login`);
  await page.getByLabel("เบอร์มือถือ").fill(`0${world.ownerPhone.slice(3)}`);
  await requestOtp(page);
  const { code } = await control<{ code: string | null }>(
    `/sms/last-code?phone=${encodeURIComponent(world.ownerPhone)}`,
  );
  await page.getByRole("textbox", { name: "หลักที่ 1" }).fill(code!);
  await expect(page).toHaveURL(`${INT_HOSTS.owner}/dashboard`);
  await expect(page.getByTestId("session-summary")).toContainText(world.tenantName);
  await hydrated(page, "owner");
}

async function signInStaff(page: Page, world: R2World) {
  await page.goto(`${INT_HOSTS.staff}/login`);
  await page.getByLabel(/เบอร์มือถือ|Mobile number/).fill(`0${world.staffPhone.slice(3)}`);
  await page.getByRole("button", { name: /ส่งรหัส|Send code/ }).click();
  await expect(page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ })).toBeVisible();
  const { code } = await control<{ code: string | null }>(
    `/sms/last-code?phone=${encodeURIComponent(world.staffPhone)}`,
  );
  await page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ }).fill(code!);
  await expect(page.getByTestId("staff-today")).toBeVisible();
  await hydrated(page, "staff");
}

async function shoot(page: Page, trigger: string, list: string) {
  await page.getByTestId(trigger).click();
  const camera = page.getByTestId("work-camera");
  await expect(camera.getByTestId("camera-capture")).toHaveAttribute("data-state", "live");
  await camera.getByTestId("camera-shutter").click();
  await camera.getByTestId("camera-done").click();
  await expect(page.getByTestId(list).getByRole("listitem")).toHaveCount(1, { timeout: 30_000 });
}

test("a resident's request → owner assigns staff → staff completes with photos → owner verifies; a parcel picked up with the PIN", async ({
  page,
  context,
}) => {
  const world = await control<R2World>("/r2");
  const request = await control<{ id: string; ref: string }>("/r2/resident-request", "POST");
  await routeStorage(page);

  // 1. The owner opens the resident's request and assigns a work order to the staff member.
  await signInOwner(page, world);
  await page.goto(`${INT_HOSTS.owner}/service-requests/${request.id}`);
  await hydrated(page, "owner");
  await expect(page.getByTestId("request-title")).toHaveText(request.ref);
  await expect(page.getByTestId("request-description")).toHaveText("ก๊อกน้ำในห้องน้ำรั่ว น้ำหยดทั้งคืน");
  await expect(page.getByTestId("request-sla").getByTestId("sla-timer")).toHaveAttribute("data-state", "ok");
  await page.getByTestId("request-create-work-order").click();
  const create = page.getByRole("dialog", { name: /เปิดใบงานสำหรับ/ });
  await create.getByTestId("work-order-title").fill(`ซ่อมก๊อก ${world.unitNo}`);
  await create.getByRole("radio", { name: "ทีมงาน" }).click();
  // The building's Staff member (the list also offers the owner and managers).
  const member = create.getByTestId("assignee-member");
  const staffOption = member.locator("option", { hasText: "· ทีมงาน" });
  await expect(staffOption).toHaveCount(1);
  await member.selectOption({ value: (await staffOption.getAttribute("value"))! });
  await create.getByTestId("form-submit").click();
  await expect(page.getByTestId("work-order")).toBeVisible({ timeout: 30_000 });
  const workOrderUrl = page.url();
  const workOrderId = workOrderUrl.split("/").pop()!;

  // The office writes in the request's thread (D-218); the work order shows the same thread.
  await page.goto(`${INT_HOSTS.owner}/service-requests/${request.id}`);
  await hydrated(page, "owner");
  const ownerThread = page.getByTestId("service-thread");
  await ownerThread.getByTestId("thread-input").fill("ช่างจะเข้าไปพรุ่งนี้ 10 โมงนะคะ");
  await ownerThread.getByTestId("thread-send").click();
  await expect(ownerThread.getByTestId("thread-message").last()).toHaveAttribute("data-mine", "true", {
    timeout: 30_000,
  });
  await expect(ownerThread.getByTestId("thread-message").last()).toHaveAttribute("data-author", "office");

  // 2. The staff member finishes it on the PWA: check-in, before and after photos, complete.
  const staff = await context.newPage();
  await routeStorage(staff);
  await signInStaff(staff, world);
  await expect(
    staff.getByTestId("today-work-orders").getByRole("link", { name: new RegExp(world.unitNo) }),
  ).toBeVisible();
  await staff
    .getByTestId("today-work-orders")
    .getByRole("link", { name: new RegExp(world.unitNo) })
    .click();
  await hydrated(staff, "staff");
  await expect(staff.getByTestId("staff-work-order")).toHaveAttribute("data-status", "assigned");
  // Door codes are fetched on tap (review H2); this building has no smart lock, so the API has none for the visit.
  await staff.getByTestId("access-show").click();
  await expect(staff.getByTestId("access-none")).toBeVisible();
  // The staff member reads the office's message in the work order's (the request's) thread and answers.
  const staffThread = staff.getByTestId("service-thread");
  await expect(staffThread.getByTestId("thread-message").filter({ hasText: "พรุ่งนี้ 10 โมง" })).toHaveCount(1);
  await staffThread.getByTestId("thread-input").fill("รับทราบครับ");
  await staffThread.getByTestId("thread-send").click();
  await expect(staffThread.getByTestId("thread-message").filter({ hasText: "รับทราบครับ" })).toHaveAttribute(
    "data-mine",
    "true",
    { timeout: 30_000 },
  );
  await staff.getByTestId("check-in").click();
  await expect(staff.getByTestId("staff-work-order")).toHaveAttribute("data-status", "in_progress", {
    timeout: 30_000,
  });
  await shoot(staff, "take-before", "photos-before");
  await shoot(staff, "take-after", "photos-after");
  await staff.getByTestId("completion-note").fill("เปลี่ยนซีลก๊อก ไม่รั่วแล้ว");
  await staff.getByTestId("complete").click();
  await expect(staff.getByTestId("staff-work-order")).toHaveAttribute("data-status", "done", { timeout: 30_000 });

  // 3. The owner verifies (typed); the request waits for the resident's rating.
  await page.goto(workOrderUrl);
  await hydrated(page, "owner");
  await expect(page.getByTestId("work-order-after").getByTestId("photo-thumb")).toHaveCount(1);
  await page.getByTestId("work-order-verify").click();
  const verify = page.getByRole("alertdialog", { name: /ตรวจรับ/ });
  const phrase = verify.getByRole("textbox", { name: /^พิมพ์/ });
  await phrase.fill((await phrase.getAttribute("placeholder")) ?? "");
  await verify.getByRole("button", { name: "ตรวจรับงาน" }).click();
  await expect(page.getByTestId("work-order")).toContainText("ตรวจรับเมื่อ", { timeout: 30_000 });
  const verified = await page.evaluate(
    async (id) => (await fetch(`/bff/v1/owner/work-orders/${id}`)).json(),
    workOrderId,
  );
  expect(verified).toMatchObject({ status: "verified" });
  const after = await page.evaluate(
    async (id) => (await fetch(`/bff/v1/owner/service-requests/${id}`)).json(),
    request.id,
  );
  expect(after.status).toBe("done");
  const thread = await page.evaluate(
    async (id) => (await fetch(`/bff/v1/owner/service-requests/${id}/messages`)).json(),
    request.id,
  );
  expect(thread.data.map((message: { body: string; mine: boolean }) => [message.body, message.mine])).toEqual(
    expect.arrayContaining([
      ["ช่างจะเข้าไปพรุ่งนี้ 10 โมงนะคะ", true],
      ["รับทราบครับ", false],
    ]),
  );

  // 4. A parcel: intake on the PWA, the resident reads the PIN in their app, hand-over with it.
  await staff.goto(`${INT_HOSTS.staff}/parcels`);
  await hydrated(staff, "staff");
  await staff.getByTestId("intake-photo").click();
  await expect(staff.getByTestId("work-camera").getByTestId("camera-capture")).toHaveAttribute("data-state", "live");
  await staff.getByTestId("work-camera").getByTestId("camera-shutter").click();
  await staff.getByTestId("work-camera").getByTestId("camera-done").click();
  await staff.getByTestId("intake-unit").selectOption({ value: world.unitId });
  await staff.getByTestId("intake-carrier").fill("Kerry");
  await staff.getByTestId("intake-submit").click();
  await expect(staff.getByTestId("intake-saved")).toContainText(world.unitNo, { timeout: 30_000 });

  const parcels = await control<{ data: { id: string; status: string; pin: string | null; carrier: string | null }[] }>(
    "/r2/resident-parcels",
  );
  const parcel = parcels.data.find((one) => one.carrier === "Kerry");
  expect(parcel?.pin, JSON.stringify(parcels)).toMatch(/^\d{6}$/);
  const card = staff.locator(`#parcel-${parcel!.id}`);
  await card.getByTestId("pick-up").click();
  await card.getByTestId("pick-up-pin").fill(parcel!.pin!);
  await card.getByTestId("pick-up-submit").click();
  await expect(staff.locator(`#parcel-${parcel!.id}`)).toHaveCount(0, { timeout: 30_000 });
  const picked = await control<{ data: { id: string; status: string; pickupConfirmedBy: string | null }[] }>(
    "/r2/resident-parcels",
  );
  expect(picked.data.find((one) => one.id === parcel!.id)).toMatchObject({
    status: "picked_up",
    pickupConfirmedBy: "resident_pin",
  });
});
