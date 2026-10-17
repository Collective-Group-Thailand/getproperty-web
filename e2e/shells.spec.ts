import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { CODE, PASSWORD, signInWithOtp, TENANT } from "./support/auth";

/**
 * F1 1.3 shells on the mock API: navigation from the menu entitlements of `/me`, the top bars,
 * notifications with realtime, breadcrumbs, mobile navs, axe on every shell.
 */
const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

async function signInAdmin(page: Page) {
  await page.goto(`${HOSTS.admin}/login`);
  await page.getByLabel("อีเมล").fill("support@example.com");
  await page.getByRole("textbox", { name: "รหัสผ่าน", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.getByLabel("รหัสจากแอปยืนยันตัวตน").fill(CODE);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(`${HOSTS.admin}/`);
}

test.describe("owner shell", () => {
  test("sidebar is built from the menu entitlements, grouped, with the current page marked", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    const sidebar = page.getByRole("navigation", { name: "เมนูหลัก" });
    await expect(sidebar.getByRole("link", { name: "เช้านี้" })).toHaveAttribute("aria-current", "page");
    await expect(sidebar.getByRole("link", { name: "บิล" })).toHaveAttribute("href", "/invoices");
    await expect(sidebar.getByRole("link", { name: "การสมัครใช้งาน" })).toBeVisible();
    await expect(sidebar.getByRole("heading", { name: "การเงิน" })).toBeVisible();
  });

  test("a manager sees only the manager's entitlements", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000002");
    await page.getByRole("button", { name: `ทำงานใน ${TENANT.branch.name}` }).click();
    const sidebar = page.getByRole("navigation", { name: "เมนูหลัก" });
    await expect(sidebar.getByRole("link", { name: "บิล" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "บัญชีรับเงิน" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "การสมัครใช้งาน" })).toHaveCount(0);
  });

  test("collapses the sidebar and remembers it", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    await page.getByRole("button", { name: "ย่อเมนู" }).click();
    await expect(page.getByRole("button", { name: "ขยายเมนู" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "ขยายเมนู" })).toBeVisible();
  });

  test("building switcher lists the tenant's buildings from the API", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    // The owner world has three buildings: the switcher offers them and "all buildings".
    await page.getByTestId("building-switcher").click();
    for (const name of ["ทุกอาคาร", "อาคาร A", "อาคาร B", "อาคาร C"])
      await expect(page.getByRole("menuitemradio", { name }).or(page.getByRole("menuitem", { name }))).toBeVisible();
    await page
      .getByRole("menuitemradio", { name: "อาคาร B" })
      .or(page.getByRole("menuitem", { name: "อาคาร B" }))
      .click();
    await expect(page.getByTestId("building-switcher")).toContainText("อาคาร B");
    await expect(page.getByTestId("dashboard-scope")).toContainText("อาคาร B");
  });

  test("global search finds menus at once and entities from the API", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    await page.keyboard.press("/");
    const dialog = page.getByRole("dialog", { name: "ค้นหา" });
    await dialog.getByRole("searchbox").fill("A-20");
    await expect(dialog.getByTestId("search-results").getByRole("link", { name: /^A-201/ })).toHaveAttribute(
      "href",
      "/units/6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7d",
    );
    await dialog.getByRole("searchbox").fill("บิล");
    await expect(dialog.getByRole("link", { name: "บิล" })).toBeVisible();
  });

  test("notification centre shows new items live and marks them read", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    await page.getByTestId("notification-centre").click();
    await expect(page.getByTestId("realtime-status")).toHaveAttribute("data-status", "open");
    const before = await page
      .getByTestId("notification-list")
      .getByRole("listitem")
      .count()
      .catch(() => 0);
    const pushed = await (
      await fetch(`${MOCK_API}/__mock/notify?user=owner&title=${encodeURIComponent("แจ้งเตือนทดสอบ")}`, {
        method: "POST",
      })
    ).json();
    expect(pushed.delivered).toBeGreaterThan(0);
    await expect(page.getByTestId("notification-list").getByText("แจ้งเตือนทดสอบ").first()).toBeVisible();
    expect(await page.getByTestId("notification-list").getByRole("listitem").count()).toBeGreaterThan(before);
    await page.getByRole("button", { name: "ทำเครื่องหมายว่าอ่านแล้ว" }).first().click();
    await expect(page.getByTestId("notification-centre")).toHaveAccessibleName(/การแจ้งเตือน/);
  });

  test("language switch keeps the page and moves to /en", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    await page.getByTestId("language-switch").click();
    await page.getByRole("menuitem", { name: "English" }).click();
    await expect(page).toHaveURL(`${HOSTS.owner}/en/dashboard`);
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Invoices" }),
    ).toHaveAttribute("href", "/en/invoices");
  });

  test("is axe-clean, also with the notification centre open", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    expect((await axe(page)).violations).toEqual([]);
    await page.getByTestId("notification-centre").click();
    expect((await axe(page)).violations).toEqual([]);
  });

  test("phone layout: bottom nav Today, Units, Invoices, Money, More", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    const bottom = page.getByRole("navigation", { name: "เมนูด่วน" });
    await expect(bottom.getByRole("link")).toHaveText(["วันนี้", "ห้อง", "บิล", "รับเงิน"]);
    await bottom.getByRole("button", { name: "เพิ่มเติม" }).click();
    await expect(
      page.getByRole("dialog", { name: "เมนูทั้งหมด" }).getByRole("link", { name: "ตั้งค่า" }),
    ).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
  });
});

test.describe("staff shell", () => {
  test("big-target bottom nav from the staff entitlements, offline indicator, axe", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInWithOtp(page, HOSTS.staff, "0810000004");
    const bottom = page.getByRole("navigation", { name: "Quick navigation" });
    await expect(bottom.getByRole("link")).toHaveText(["Today", "Readings", "Inspect", "Devices"]);
    await expect(page.getByTestId("sync-badge")).toHaveAttribute("data-pending", "0");
    expect((await axe(page)).violations).toEqual([]);

    await context.setOffline(true);
    await expect(page.getByTestId("offline-indicator")).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByTestId("offline-indicator")).toHaveCount(0);
  });

  test("offers high contrast and a device PIN in the account menu", async ({ page }) => {
    await signInWithOtp(page, HOSTS.staff, "0810000004");
    await page.getByTestId("user-menu").click();
    await page.getByRole("menuitem", { name: "High contrast" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "hc");
    await page.getByTestId("user-menu").click();
    await page.getByRole("menuitem", { name: "Set a device PIN" }).click();
    const dialog = page.getByRole("dialog", { name: "Set a device PIN" });
    await dialog.getByLabel("PIN", { exact: true }).fill("2468");
    await dialog.getByLabel("Repeat PIN").fill("2468");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    // Inactivity beyond the limit locks the app on the next visit; the PIN unlocks it.
    await page.evaluate(() => window.localStorage.setItem("gp_device_activity", String(Date.now() - 6 * 60_000)));
    await page.reload();
    const lock = page.getByTestId("device-lock");
    await expect(lock).toBeVisible();
    await lock.getByLabel("PIN", { exact: true }).fill("1111");
    await lock.getByRole("button", { name: "Unlock" }).click();
    await expect(lock).toContainText("4 tries left");
    await lock.getByLabel("PIN", { exact: true }).fill("2468");
    await lock.getByRole("button", { name: "Unlock" }).click();
    await expect(lock).toHaveCount(0);
  });
});

test.describe("admin shell", () => {
  test("sidebar from /v1/admin/me, command palette, environment badge, axe", async ({ page }) => {
    await signInAdmin(page);
    // The support persona's language is English (`/v1/admin/me.user.language`).
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const sidebar = page.getByRole("navigation", { name: "Main navigation" });
    await expect(sidebar.getByRole("link", { name: "Tenants" })).toBeVisible();
    // Support is not a platform admin: no platform users, no feature flags.
    await expect(sidebar.getByRole("link", { name: "Platform users" })).toHaveCount(0);
    await expect(page.getByTestId("env-badge")).toHaveText("development");
    expect((await axe(page)).violations).toEqual([]);

    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Go to…" });
    await palette.getByRole("combobox").fill("audit");
    await expect(palette.getByRole("option")).toHaveText(["Audit log"]);
    expect((await axe(page)).violations).toEqual([]);
  });
});
