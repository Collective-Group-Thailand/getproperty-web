import { expect, test, type Page } from "@playwright/test";

import { INT_CONTROL, INT_HOSTS } from "../../playwright.integration.config";

/**
 * F2 against the real getproperty-api (e2e/integration/harness.ts, the `/f2` world): the owner signs in,
 * imports the units of their building from the API's own Excel template, creates a lease in the wizard
 * (new resident inline, start today, utilities included), sends it for signature and invites the
 * resident; the resident signs through the API (what getproperty-liff does: LINE login, consent,
 * invitation, OTP); the owner countersigns; the billing cycle is computed and issued ("Issue all" with
 * the typed period); the fake KBank posts its signed callback for the invoice's QR; the worker confirms
 * the payment and the receipt shows on the invoice.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

const RESIDENT_PHONE = "+66810000031";
const RESIDENT_ID = "1101700207030";

interface F2World {
  phone: string;
  tenantName: string;
  buildingId: string;
  buildingName: string;
  propertyId: string;
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

async function bff<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (url) => (await fetch(url)).json(), `/bff${path}`) as Promise<T>;
}

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

async function signIn(page: Page, world: F2World) {
  await page.goto(`${INT_HOSTS.owner}/login`);
  await page.getByLabel("เบอร์มือถือ").fill(`0${world.phone.slice(3)}`);
  await page.getByRole("button", { name: "ส่งรหัส" }).click();
  await expect(page.getByRole("textbox", { name: "หลักที่ 1" })).toBeVisible();
  const { code } = await control<{ code: string | null }>(`/sms/last-code?phone=${encodeURIComponent(world.phone)}`);
  await page.getByRole("textbox", { name: "หลักที่ 1" }).fill(code!);
  await expect(page).toHaveURL(`${INT_HOSTS.owner}/dashboard`);
  await expect(page.getByTestId("session-summary")).toContainText(world.tenantName);
  await hydrated(page);
}

test("units import → lease wizard → resident signs → countersign → billing cycle → issue → paid → receipt", async ({
  page,
}) => {
  const world = await control<F2World>("/f2");
  await routeStorage(page);
  await signIn(page, world);

  // 1. Units from the API's own Excel template (floor 2 is created by the import).
  await goto(page, `/buildings/${world.buildingId}/import`);
  const workbook = Buffer.from(await (await fetch(`${INT_CONTROL}/f2/units.xlsx`)).arrayBuffer());
  await page.getByTestId("import-file").locator("input[type=file]").setInputFiles({
    name: "units.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook,
  });
  await page.getByRole("checkbox", { name: "สร้างชั้นที่ยังไม่มี" }).check();
  await page.getByTestId("import-preview").click();
  await expect(page.getByTestId("unit-import")).toHaveAttribute("data-step", "preview", { timeout: 30_000 });
  await expect(page.getByTestId("import-summary")).toContainText("ใหม่ 3");
  await page.getByTestId("import-commit").click();
  await expect(page.getByTestId("import-done")).toBeVisible({ timeout: 30_000 });
  const units = await bff<{ data: { id: string; unitNo: string }[] }>(
    page,
    `/v1/owner/units?buildingId=${world.buildingId}&perPage=50`,
  );
  const unit = units.data.find((candidate) => candidate.unitNo === "F-101");
  expect(unit, JSON.stringify(units)).toBeTruthy();

  // 2. The lease wizard: a new resident inline, start today, rent, utilities included.
  await goto(page, `/leases/new?unit=${unit!.id}`);
  const wizard = page.getByTestId("lease-wizard");
  await expect(wizard).toHaveAttribute("data-step", "parties");
  await page.getByTestId("new-party").click();
  const party = page.getByRole("dialog", { name: "เพิ่มผู้เช่าหรือคู่สัญญา" });
  await party.getByRole("textbox", { name: /^ชื่อ/ }).fill("ณัฐพล");
  await party.getByRole("textbox", { name: /^นามสกุล/ }).fill("ทดสอบระบบ");
  await party.getByRole("textbox", { name: /^เบอร์มือถือ/ }).fill(`0${RESIDENT_PHONE.slice(3)}`);
  await party.getByRole("textbox", { name: /^เลขบัตร/ }).fill(RESIDENT_ID);
  await party.getByTestId("form-submit").click();
  await expect(page.getByTestId("chosen-lessee")).toHaveText("ณัฐพล ทดสอบระบบ", { timeout: 15_000 });
  await page.getByTestId("wizard-next").click();
  await expect(wizard).toHaveAttribute("data-step", "terms");
  await page.getByRole("button", { name: /วันเริ่มสัญญา/ }).click();
  await page.getByRole("dialog", { name: "เลือกวันที่" }).getByRole("button", { name: "วันนี้" }).click();
  await page.getByTestId("lease-rent").fill("4500.00");
  await page.getByRole("radio", { name: "รวมในค่าเช่า" }).click();
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("lease-create").click();
  await expect(wizard).toHaveAttribute("data-step", "contract", { timeout: 30_000 });
  await expect(page.getByTestId("compliance-checks")).toBeVisible();
  await page.getByTestId("send-for-signature").click();
  await expect(page.getByTestId("lease-sent")).toBeVisible({ timeout: 30_000 });
  const leaseHref = await page.getByTestId("open-lease").getAttribute("href");
  const leaseId = leaseHref!.split("/").pop()!;

  // 3. The invitation; the resident signs through the API (getproperty-liff's calls).
  await page.getByTestId("invite-resident").click();
  const invite = page.getByRole("dialog", { name: "เชิญเข้าแอปผู้เช่า" });
  await invite.getByTestId("invitation-create").click();
  const code = (await invite.getByTestId("invitation-code").textContent())!.trim();
  expect(code.length).toBeGreaterThan(4);
  await page.keyboard.press("Escape");
  const signed = await control<{ signatureRequired: boolean; status: string }>(
    `/f2/resident-sign?code=${encodeURIComponent(code)}&lease=${leaseId}&phone=${encodeURIComponent(RESIDENT_PHONE)}`,
    "POST",
  );
  expect(signed).toMatchObject({ signatureRequired: false, status: "pending_signature" });

  // 4. The lessor countersigns.
  await goto(page, `/leases/${leaseId}`);
  await expect(page.getByTestId("party-signed")).toBeVisible();
  await page.getByTestId("lease-countersign").click();
  const countersign = page.getByRole("alertdialog", { name: "เซ็นสัญญาในฐานะผู้ให้เช่า" });
  const canvas = page.getByTestId("signature-pad");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1)
    await page.mouse.move(box.x + 30 + step * 20, box.y + box.height / 2 + (step % 2 ? -25 : 25));
  await page.mouse.up();
  await countersign.getByRole("button", { name: "เซ็น", exact: true }).click();
  await expect(page.getByTestId("lessor-signed")).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await bff<{ status: string }>(page, `/v1/owner/leases/${leaseId}`)).status, { timeout: 30_000 })
    .toBe("active");

  // 5. The billing cycle: open (if the API has not yet), compute, issue all.
  await goto(page, "/billing");
  if (await page.getByTestId("cycle-open").isVisible()) {
    await page.getByTestId("cycle-open").click();
    await expect(page.getByTestId("cycle-workspace")).toBeVisible({ timeout: 30_000 });
    await hydrated(page);
  }
  if (await page.getByTestId("cycle-compute").isVisible()) {
    await page.getByTestId("cycle-compute").click();
    await expect(page.getByTestId("draft-row").filter({ hasText: "F-101" })).toBeVisible({ timeout: 60_000 });
  }
  await page.getByTestId("cycle-issue").click();
  const issue = page.getByRole("alertdialog", { name: "ออกบิลประจำเดือน?" });
  const phrase = issue.getByRole("textbox", { name: /^พิมพ์/ });
  await phrase.fill((await phrase.getAttribute("placeholder")) ?? "");
  await issue.getByRole("button", { name: /^ออกบิล/ }).click();
  await expect(issue).toBeHidden({ timeout: 60_000 });

  // 6. The invoice of F-101, its QR reference, the provider's callback, the receipt.
  let invoice: { id: string; number: string | null; status: string } | undefined;
  await expect
    .poll(
      async () => {
        const list = await bff<{ data: { id: string; number: string | null; status: string }[] }>(
          page,
          `/v1/owner/invoices?unitId=${unit!.id}`,
        );
        invoice = list.data.find((candidate) => candidate.number);
        return invoice?.status ?? "none";
      },
      { timeout: 60_000 },
    )
    .toBe("issued");
  await expect
    .poll(
      async () => (await bff<{ promptpayRef: string | null }>(page, `/v1/owner/invoices/${invoice!.id}`)).promptpayRef,
      {
        timeout: 60_000,
      },
    )
    .toBeTruthy();
  const paid = await control<{ status: number }>(`/f2/pay?invoice=${encodeURIComponent(invoice!.number!)}`, "POST");
  expect(paid.status).toBe(200);
  await expect
    .poll(async () => (await bff<{ status: string }>(page, `/v1/owner/invoices/${invoice!.id}`)).status, {
      timeout: 60_000,
    })
    .toBe("paid");

  await goto(page, `/invoices/${invoice!.id}`);
  await expect(page.getByTestId("invoice-title")).toHaveText(invoice!.number!);
  await expect(page.getByTestId("invoice-balance")).toHaveText("฿0.00");
  await expect(page.getByTestId("invoice-payment")).toHaveCount(1);
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
  await expect(page.getByTestId("receipt-pdf").first()).toContainText(/\S/);
});
