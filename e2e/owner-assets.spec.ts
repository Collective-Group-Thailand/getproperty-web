import { expect, test } from "@playwright/test";

import { expectAxeClean } from "./support/staff";
import { gotoOwner, hydrated, received, resetOwner, setBuilding, signInOwner, W } from "./support/owner";

/**
 * F2 2.1 on the mock API: the morning dashboard (every queue, KPIs incl. loss % with THB, the cycle card,
 * the compliance score), buildings and their detail, the unit board (keyboard navigation, drawer, the
 * 300-unit building virtualised), the unit list with saved views, Excel import with preview/commit,
 * bulk create and the unit type editor — with axe on each screen.
 */
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetOwner();
});

test("dashboard renders every Today queue, the KPIs, the cycle and the compliance score", async ({ page }) => {
  await signInOwner(page);
  const queue = page.getByTestId("today-queue");
  for (const kind of ["readings", "drafts", "slips", "deposits", "meters", "overdue", "dueToday"]) {
    await expect(queue.locator(`[data-kind="${kind}"]`)).toBeVisible();
  }
  await expect(queue.locator('[data-kind="drafts"]')).toHaveAttribute("data-count", "3");
  await expect(queue.locator('[data-kind="slips"]')).toHaveAttribute("data-count", "2");
  await expect(queue.locator('[data-kind="slips"]')).toHaveAttribute("href", "/payments/slips");
  await expect(page.getByTestId("kpi-collected")).toContainText("%");
  await expect(page.getByTestId("kpi-arrears")).toContainText("฿7,182.00");
  await expect(page.getByTestId("kpi-loss").getByTestId("loss-row").first()).toContainText(
    /ไฟฟ้า · อาคาร A: 11% \(฿[\d,]+\.\d\d\)/,
  );
  await expect(page.getByTestId("cycle-card")).toContainText("รอเลขมิเตอร์");
  await expect(page.getByTestId("next-cutoff")).toBeVisible();
  await expect(page.getByTestId("compliance-value")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("compliance-component")).toHaveCount(4);
  await expect(page.getByTestId("all-buildings").getByTestId("summary-row")).toHaveCount(3);
  await expectAxeClean(page);

  // The building switcher drives the dashboard: building B's arrears only.
  await setBuilding(page, W.buildingB);
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId("dashboard-scope")).toContainText("อาคาร B");
  await expect(page.getByTestId("all-buildings")).toHaveCount(0);
  await expect(page.getByTestId("kpi-occupancy")).toContainText("50%");
});

test("buildings and a building's detail: floors, utility accounts, settings, VAT", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, "/buildings");
  await expect(page.getByTestId("building-card")).toHaveCount(3);
  await expectAxeClean(page);
  await page.getByTestId("building-card").filter({ hasText: "อาคาร A" }).click();
  await expect(page.getByTestId("building-title")).toHaveText("อาคาร A");
  await hydrated(page);
  await expect(page.getByTestId("setting-billing.cutoff")).toHaveText("สิ้นเดือน เวลา 23:59 น.");
  await expect(page.getByTestId("vat-status")).toBeVisible();
  await expect(page.getByTestId("floor-row")).toHaveCount(2);

  await page.getByTestId("new-floor").click();
  const floorDialog = page.getByRole("dialog", { name: "ชั้นใหม่" });
  await floorDialog.getByLabel("ชั้นที่").fill("4");
  await floorDialog.getByLabel("ชื่อ").fill("ชั้น 4");
  await floorDialog.getByTestId("form-submit").click();
  await expect(page.getByTestId("floor-row")).toHaveCount(3);

  await page.getByTestId("new-utility-account").click();
  const account = page.getByRole("dialog", { name: "บัญชีการไฟฟ้า/ประปา" });
  await account.getByLabel("หน่วยงาน").selectOption("pea");
  await account.getByLabel("ชื่อเรียก").fill("มิเตอร์ปั๊มน้ำ");
  await account.getByLabel("เลขที่ผู้ใช้").fill("020099887766");
  await account.getByTestId("form-submit").click();
  await expect(page.getByTestId("account-row").filter({ hasText: "มิเตอร์ปั๊มน้ำ" })).toBeVisible();
  await expectAxeClean(page);
});

test("unit board: keyboard navigation between units and floors, the drawer, a status change", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/units?building=${W.buildingA}`);
  const board = page.getByTestId("unit-board");
  await expect(board).toHaveAttribute("data-units", "8");
  const cards = board.getByTestId("unit-card");
  await expect(cards).toHaveCount(8);
  // One tab stop: the first card (top floor first).
  await cards.first().focus();
  await expect(cards.first()).toContainText("A-301");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(":focus")).toContainText("A-302");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toContainText("A-202");
  await page.keyboard.press("End");
  await expect(page.locator(":focus")).toContainText("A-204");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(":focus")).toContainText("A-304");
  await page.keyboard.press("Home");
  await expect(page.locator(":focus")).toContainText("A-301");
  await expect(board.locator('[data-unit-card][tabindex="0"]')).toHaveCount(1);
  await expectAxeClean(page);

  // Filters: units with a balance.
  await page.getByTestId("board-issue").selectOption("balance");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("A-302");
  await expect(cards.first().getByTestId("unit-balance")).toContainText("฿7,182.00");
  await page.getByTestId("board-issue").selectOption("");

  // Enter opens the drawer with the occupancy, the last readings with their source, open invoices.
  await cards.filter({ hasText: "A-201" }).focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "ห้อง A-201" });
  await expect(drawer.getByTestId("unit-panel")).toBeVisible();
  await expect(drawer.getByTestId("unit-lease")).toContainText("สมศักดิ์ ใจดี");
  await expect(drawer.getByTestId("unit-meter")).toHaveCount(2);
  await expect(drawer.getByTestId("unit-meter").first()).toContainText("E-A-201");
  await expect(drawer.getByTestId("photo-thumb").first()).toBeVisible();
  await expectAxeClean(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(":focus")).toContainText("A-201");

  // A vacant unit: status change with a reason (D-171).
  await cards.filter({ hasText: "A-204" }).click();
  const vacant = page.getByRole("dialog", { name: "ห้อง A-204" });
  await expect(vacant.getByTestId("unit-new-lease")).toHaveAttribute("href", /\/leases\/new\?unit=/);
  await vacant.getByTestId("unit-status-change").click();
  const status = page.getByRole("dialog", { name: "สถานะห้อง A-204" });
  await status.getByLabel("สถานะใหม่").selectOption("maintenance");
  await status.getByLabel("เหตุผล").fill("ทาสีใหม่");
  await status.getByTestId("form-submit").click();
  await expect(status).toBeHidden();
  await expect(vacant.getByTestId("unit-panel")).toContainText("ทาสีใหม่");
  await page.keyboard.press("Escape");
  await expect(cards.filter({ hasText: "A-204" })).toHaveAttribute("data-status", "maintenance");
});

test("the 300-unit board renders only the floors on screen and keyboard-scrolls to the last unit", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/units?building=${W.buildingC}`);
  const board = page.getByTestId("unit-board");
  await expect(board).toHaveAttribute("data-units", "300");
  const rendered = await board.getByTestId("unit-card").count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(300);
  await board.getByTestId("unit-card").first().focus();
  await expect(page.locator(":focus")).toContainText("C-1501");
  await page.keyboard.press("Control+End");
  await expect(page.locator(":focus")).toContainText("C-0120");
  await page.getByTestId("board-search").fill("C-0707");
  await expect(board.getByTestId("unit-card")).toHaveCount(1);
  await expect(board.getByTestId("unit-card")).toHaveAttribute("data-status", "maintenance");
});

test("unit list: server filters and sort in the URL, saved views", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/units?building=${W.buildingA}&view=list`);
  await expect(page.getByRole("table", { name: "ห้อง" }).getByRole("row")).toHaveCount(9);
  await page.getByTestId("filter-status").selectOption("vacant");
  await expect(page).toHaveURL(/status=vacant/);
  await expect(page.getByRole("table", { name: "ห้อง" }).getByRole("row")).toHaveCount(3);
  await page.getByRole("button", { name: "ห้อง", exact: true }).click();
  await expect(page).toHaveURL(/sort=unitNo&order=desc/);
  await expect(page.getByRole("table", { name: "ห้อง" }).getByRole("row").nth(1)).toContainText("A-303");
  await page.getByTestId("saved-view-new").click();
  await page.getByTestId("saved-view-name").fill("ห้องว่าง");
  await page.getByTestId("saved-view-save").click();
  await expect(page.getByTestId("saved-view")).toHaveText("ห้องว่าง");
  await gotoOwner(page, `/units?building=${W.buildingA}&view=list`);
  await page.getByTestId("saved-view").click();
  await hydrated(page);
  await expect(page).toHaveURL(/status=vacant/);
  await expectAxeClean(page);
});

test("Excel import: preview with errors, fix, commit exactly the plan", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/buildings/${W.buildingA}/import`);
  await expect(page.getByTestId("download-template")).toHaveAttribute(
    "href",
    `/bff/v1/owner/buildings/${W.buildingA}/unit-imports/template`,
  );
  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  await page
    .getByTestId("import-file")
    .locator("input[type=file]")
    .setInputFiles({
      name: "units.xlsx",
      mimeType: mime,
      buffer: Buffer.from(
        "unitNo,floor,type,baseRent\nA-305,3,room,4800\nA-305,3,room,4800\nA-501,5,room,abc\nA-201,2,room,4600\n",
      ),
    });
  await page.getByTestId("import-preview").click();
  await expect(page.getByTestId("unit-import")).toHaveAttribute("data-step", "preview");
  await expect(page.getByTestId("import-row").and(page.locator('[data-action="error"]'))).toHaveCount(2);
  await expect(page.getByTestId("import-commit")).toBeDisabled();
  await expectAxeClean(page);

  await page.getByTestId("import-again").click();
  await page
    .getByTestId("import-file")
    .locator("input[type=file]")
    .setInputFiles({
      name: "units-fixed.xlsx",
      mimeType: mime,
      buffer: Buffer.from("unitNo,floor,type,baseRent\nA-305,3,room,4800\nA-501,5,room,5000\nA-201,2,room,4600\n"),
    });
  await page.getByRole("checkbox", { name: "สร้างชั้นที่ยังไม่มี" }).check();
  await page.getByTestId("import-preview").click();
  const summary = page.getByTestId("import-summary");
  await expect(summary).toContainText("ใหม่ 2");
  await expect(summary).toContainText("ปรับปรุง 1");
  await expect(summary).toContainText("ชั้นใหม่: 5");
  await page.getByTestId("import-commit").click();
  await expect(page.getByTestId("import-done")).toContainText("สร้าง 2 ห้อง ปรับปรุง 1 ห้อง");
  const commits = await received("owner.unitImports.commit");
  expect(commits.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await gotoOwner(page, `/units?building=${W.buildingA}`);
  await expect(page.getByTestId("unit-card").filter({ hasText: "A-501" })).toBeVisible();
});

test("bulk create from a number pattern and the unit type editor", async ({ page }) => {
  await signInOwner(page);
  await gotoOwner(page, `/buildings/${W.buildingB}/units/new`);
  await page.getByRole("checkbox", { name: "ชั้น 1" }).check();
  await page.getByTestId("bulk-next").click();
  await page.getByTestId("bulk-pattern").fill("{building}-1{nn}");
  await page.getByTestId("bulk-count").fill("2");
  await page.getByLabel("เลขลำดับแรก").fill("3");
  await page.getByTestId("bulk-next").click();
  await expect(page.getByTestId("bulk-preview")).toContainText("B-103, B-104");
  await expectAxeClean(page);
  await page.getByTestId("bulk-create").click();
  await expect(page.getByTestId("bulk-done")).toContainText("2");

  await gotoOwner(page, `/buildings/${W.buildingA}/unit-profiles`);
  await expect(page.getByTestId("profile-card")).toHaveCount(2);
  await page.getByTestId("new-profile").click();
  const dialog = page.getByRole("dialog", { name: "ประเภทห้องใหม่" });
  await dialog.getByRole("textbox", { name: /^ชื่อ/ }).fill("ห้องมุม");
  await dialog.getByLabel("ค่าเช่าเริ่มต้น").fill("5200.00");
  await dialog.getByTestId("profile-add-line").click();
  await dialog.getByLabel("รายละเอียด").fill("อินเทอร์เน็ตไฟเบอร์");
  await dialog.getByLabel("จำนวนเงิน").fill("350.00");
  await dialog.getByTestId("form-submit").click();
  await expect(page.getByTestId("profile-card").filter({ hasText: "ห้องมุม" })).toContainText("฿350.00");
  await expectAxeClean(page);
});
