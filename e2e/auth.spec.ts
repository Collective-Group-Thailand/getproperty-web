import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import {
  CODE,
  expectOnOwnerDashboard,
  expireAccess,
  mockRequests,
  PASSWORD,
  signInWithOtp,
  TENANT,
} from "./support/auth";

/**
 * F1 1.2 against the mock API (mocks/server.ts): sign-in flows per audience, the tenant switcher and
 * `X-Tenant-Id`, host-only sessions, the read-only banner, refresh and the BFF's refusals.
 */

test.describe("owner sign-in", () => {
  test("phone OTP → dashboard shell shows the tenant name and role", async ({ page, context }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    await expectOnOwnerDashboard(page, TENANT.sample.name);
    await expect(page.getByTestId("tenant-role")).toHaveText("เจ้าของ");

    const cookies = await context.cookies(HOSTS.owner);
    const access = cookies.find((cookie) => cookie.name === "__Host-gp_at");
    expect(access?.httpOnly).toBe(true);
    expect(access?.secure).toBe(true);
    expect(access?.sameSite).toBe("Lax");
    expect(access?.path).toBe("/");
    expect(cookies.find((cookie) => cookie.name === "__Host-gp_rt")?.httpOnly).toBe(true);
    // No token is readable by page script.
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/gp_at|gp_rt|mock-at|mock-rt/);
  });

  test("a wrong code says how many attempts are left", async ({ page }) => {
    await page.goto(`${HOSTS.owner}/login`);
    await page.getByLabel("เบอร์มือถือ").fill("0810000001");
    await page.getByRole("button", { name: "ส่งรหัส" }).click();
    await page.getByRole("textbox", { name: "หลักที่ 1" }).fill("000000");
    await expect(page.getByTestId("auth-error")).toHaveAttribute("data-code", "auth.otp_invalid");
    await expect(page.getByTestId("auth-error")).toContainText("ลองได้อีก 4 ครั้ง");
  });

  test("email + password + TOTP", async ({ page }) => {
    await page.goto(`${HOSTS.owner}/login`);
    await page.getByRole("radio", { name: "อีเมลและรหัสผ่าน" }).click();
    await page.getByLabel("อีเมล").fill("totp@example.com");
    await page.getByRole("textbox", { name: "รหัสผ่าน", exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await page.getByLabel("รหัสจากแอปยืนยันตัวตน").fill(CODE);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expectOnOwnerDashboard(page, TENANT.sample.name);
  });

  test("the console sends a signed-out visitor to sign-in and back afterwards", async ({ page }) => {
    await page.goto(`${HOSTS.owner}/dashboard`);
    await expect(page).toHaveURL(`${HOSTS.owner}/login?next=%2Fdashboard`);
    await expect(page.getByTestId("auth-card")).toBeVisible();
  });

  test("the sign-in page is axe-clean", async ({ page }) => {
    await page.goto(`${HOSTS.owner}/login`);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("sign-out clears the session", async ({ page, context }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    await page.getByTestId("user-menu").click();
    await page.getByRole("menuitem", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL(`${HOSTS.owner}/login`);
    const names = (await context.cookies(HOSTS.owner)).map((cookie) => cookie.name);
    expect(names).not.toContain("__Host-gp_at");
    expect(names).not.toContain("__Host-gp_rt");
    await page.goto(`${HOSTS.owner}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("tenant switcher", () => {
  test("an operator of several tenants picks one; the cookie is set and sent as X-Tenant-Id", async ({
    page,
    context,
  }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000002");
    await expect(page).toHaveURL(`${HOSTS.owner}/select-tenant`);
    await page.getByRole("button", { name: `ทำงานใน ${TENANT.branch.name}` }).click();
    await expectOnOwnerDashboard(page, TENANT.branch.name);

    const tenantCookie = (await context.cookies(HOSTS.owner)).find((cookie) => cookie.name === "__Host-gp_tenant");
    expect(tenantCookie?.value).toBe(TENANT.branch.id);
    expect(tenantCookie?.httpOnly).toBe(true);
    const meCalls = await mockRequests("/v1/owner/me");
    expect(meCalls.some((call) => call.tenantId === TENANT.branch.id && call.authorization)).toBe(true);

    // Switch from the top bar.
    await page.getByTestId("tenant-switcher").click();
    await page.getByRole("menuitem", { name: TENANT.sample.name }).click();
    await expect(page.getByTestId("tenant-switcher")).toContainText(TENANT.sample.name);
    const switched = (await context.cookies(HOSTS.owner)).find((cookie) => cookie.name === "__Host-gp_tenant");
    expect(switched?.value).toBe(TENANT.sample.id);
  });
});

test.describe("sessions are per host", () => {
  test("an owner session never authenticates on the admin host", async ({ page, context }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    await page.goto(`${HOSTS.admin}/`);
    await expect(page).toHaveURL(`${HOSTS.admin}/login?next=%2F`);

    // Even a copied owner token is refused there: the admin surface wants the platform audience.
    const access = (await context.cookies(HOSTS.owner)).find((cookie) => cookie.name === "__Host-gp_at")!;
    await context.addCookies([{ ...access, domain: "admin.localhost", sameSite: "Lax" }]);
    await page.goto(`${HOSTS.admin}/`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("auth-card")).toBeVisible();
  });
});

test.describe("suspended subscription", () => {
  test("renders the read-only banner", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000003");
    await expectOnOwnerDashboard(page, TENANT.suspended.name);
    await expect(page.getByTestId("read-only-banner")).toContainText("โหมดอ่านอย่างเดียว");
  });
});

test.describe("refresh", () => {
  test("the proxy refreshes an expired access cookie before rendering", async ({ page, context }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    const before = (await context.cookies(HOSTS.owner)).find((cookie) => cookie.name === "__Host-gp_rt")!.value;
    await context.clearCookies({ name: "__Host-gp_at" });
    await page.reload();
    await expectOnOwnerDashboard(page, TENANT.sample.name);
    const cookies = await context.cookies(HOSTS.owner);
    expect(cookies.find((cookie) => cookie.name === "__Host-gp_at")).toBeDefined();
    expect(cookies.find((cookie) => cookie.name === "__Host-gp_rt")!.value).not.toBe(before);
  });

  test("the BFF refreshes once on 401 and replays the call", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    await expireAccess("owner");
    const result = await page.evaluate(async () => {
      const response = await fetch("/bff/v1/owner/me");
      return { status: response.status, body: (await response.json()) as { user?: { phone?: string } } };
    });
    expect(result.status).toBe(200);
    expect(result.body.user?.phone).toBe("+66810000001");
  });
});

test.describe("BFF", () => {
  test("refuses other surfaces, cross-site writes and missing CSRF headers", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    const statuses = await page.evaluate(async () => {
      const status = async (input: string, init?: RequestInit) => (await fetch(input, init)).status;
      return {
        resident: await status("/bff/v1/resident/me"),
        technician: await status("/bff/v1/technician/me"),
        admin: await status("/bff/v1/admin/me"),
        refresh: await status("/bff/v1/auth/refresh", { method: "POST", headers: { "x-getproperty-csrf": "1" } }),
        noCsrf: await status("/bff/v1/owner/notifications/x/actions/read", { method: "POST" }),
        me: await status("/bff/v1/owner/me"),
      };
    });
    expect(statuses).toEqual({ resident: 404, technician: 404, admin: 404, refresh: 404, noCsrf: 403, me: 200 });
  });

  test("a sign-in through the BFF sets cookies and never returns the tokens", async ({ page }) => {
    await page.goto(`${HOSTS.owner}/login`);
    const result = await page.evaluate(async (code) => {
      const post = (path: string, body: unknown) =>
        fetch(`/bff${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-getproperty-csrf": "1" },
          body: JSON.stringify(body),
        }).then((response) => response.json());
      const challenge = (await post("/v1/auth/operator/otp/request", { phone: "+66810000001" })) as {
        challengeId: string;
      };
      return post("/v1/auth/operator/otp/verify", { challengeId: challenge.challengeId, code });
    }, CODE);
    expect(result).toHaveProperty("subject");
    expect(JSON.stringify(result)).not.toMatch(/accessToken|refreshToken|mock-at|mock-rt/);
    await page.goto(`${HOSTS.owner}/dashboard`);
    await expectOnOwnerDashboard(page, TENANT.sample.name);
  });
});

test.describe("staff sign-in", () => {
  test("OTP → today, in the language of /v1/staff/me", async ({ page }) => {
    await signInWithOtp(page, HOSTS.staff, "0810000004");
    await expect(page).toHaveURL(`${HOSTS.staff}/`);
    await expect(page.getByTestId("staff-today")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("tenant-role")).toHaveText("Staff");
  });
});

test.describe("admin sign-in", () => {
  test("first sign-in enrols TOTP, then signs in", async ({ page }) => {
    await page.goto(`${HOSTS.admin}/login`);
    await page.getByLabel("อีเมล").fill("admin@example.com");
    await page.getByRole("textbox", { name: "รหัสผ่าน", exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page.getByTestId("totp-enrolment")).toBeVisible();
    await expect(page.getByRole("img", { name: "คิวอาร์โค้ดสำหรับแอปยืนยันตัวตน" })).toBeVisible();
    await expect(page.getByTestId("totp-secret")).not.toBeEmpty();
    await page.getByLabel("รหัสจากแอปยืนยันตัวตน").fill(CODE);
    await page.getByRole("button", { name: "ยืนยันและเข้าสู่ระบบ" }).click();
    await expect(page).toHaveURL(`${HOSTS.admin}/`);
    await expect(page.getByTestId("platform-user")).toHaveText("Admin Test");
    await expect(page.getByTestId("platform-roles")).toHaveText("ผู้ดูแลแพลตฟอร์ม");
  });

  test("an enrolled platform user needs the authenticator code", async ({ page }) => {
    await page.goto(`${HOSTS.admin}/login`);
    await page.getByLabel("อีเมล").fill("support@example.com");
    await page.getByRole("textbox", { name: "รหัสผ่าน", exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await page.getByLabel("รหัสจากแอปยืนยันตัวตน").fill(CODE);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page).toHaveURL(`${HOSTS.admin}/`);
    await expect(page.getByTestId("platform-user")).toHaveText("Support Test");
  });
});

/**
 * Review H3: a crafted `?next=` must never take a freshly signed-in user off the site. `/%09/evil.example` decodes
 * to `/\t/evil.example`, which the WHATWG URL parser turns into `//evil.example`; `/\evil` and `//evil` likewise.
 */
test.describe("no open redirect after sign-in (review H3)", () => {
  const ATTACKS = ["/%09/evil.example/login", "/%5Cevil.example", "//evil.example", "/%2509/evil.example"];

  for (const attack of ATTACKS) {
    test(`owner and staff OTP sign-in ignore next=${attack}`, async ({ page }) => {
      for (const [host, phone] of [
        [HOSTS.owner, "0810000001"],
        [HOSTS.staff, "0810000004"],
      ] as const) {
        await page.context().clearCookies();
        await page.goto(`${host}/login?next=${attack}`);
        await page.getByLabel(/เบอร์มือถือ|Mobile number/).fill(phone);
        await page.getByRole("button", { name: /ส่งรหัส|Send code/ }).click();
        await page.getByRole("textbox", { name: /หลักที่ 1|Digit 1/ }).fill(CODE);
        await page.waitForURL((url) => !url.pathname.endsWith("/login"));
        expect(new URL(page.url()).origin).toBe(host);
      }
    });
  }

  test("the platform sign-in (password + TOTP) ignores a crafted next", async ({ page }) => {
    await page.goto(`${HOSTS.admin}/login?next=/%09/evil.example/login`);
    await page.getByLabel(/อีเมล|Email/).fill("support@example.com");
    await page.getByRole("textbox", { name: /^(รหัสผ่าน|Password)$/ }).fill(PASSWORD);
    await page.getByRole("button", { name: /เข้าสู่ระบบ|Sign in/ }).click();
    await page.getByLabel(/รหัสจากแอปยืนยันตัวตน|Authenticator code/).fill(CODE);
    await page.getByRole("button", { name: /เข้าสู่ระบบ|Sign in/ }).click();
    await expect(page).toHaveURL(`${HOSTS.admin}/`);
  });

  test("an already signed-in user is not redirected off the site either", async ({ page }) => {
    await signInWithOtp(page, HOSTS.owner, "0810000001");
    await page.goto(`${HOSTS.owner}/login?next=/%09/evil.example/login`);
    expect(new URL(page.url()).origin).toBe(HOSTS.owner);
  });
});
