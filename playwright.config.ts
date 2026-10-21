import { existsSync } from "node:fs";

import { defineConfig, devices, type ReporterDescription } from "@playwright/test";

/**
 * Deliberately not 3000: `pnpm dev` is for humans; the suite gets its own port so a dev server can
 * never make the run pass or fail by accident.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

/**
 * The three zone hosts, as the suite reaches them. Chromium resolves `*.localhost` to loopback by
 * itself, but the glibc resolver on CI does not, so `--host-resolver-rules` makes it the browser's
 * decision rather than the machine's.
 */
export const HOSTS = {
  owner: baseURL,
  staff: `http://staff.localhost:${PORT}`,
  admin: `http://admin.localhost:${PORT}`,
} as const;

/** The mock API (mocks/server.ts) the `chromium` project runs against; its `/__mock/*` endpoints are the suite's handle. */
const MOCK_API_PORT = Number(process.env.E2E_MOCK_API_PORT ?? 4110);
export const MOCK_API = `http://127.0.0.1:${MOCK_API_PORT}`;

const zoneEnv = {
  OWNER_HOST: `localhost:${PORT}`,
  STAFF_HOST: `staff.localhost:${PORT}`,
  ADMIN_HOST: `admin.localhost:${PORT}`,
  API_INTERNAL_URL: MOCK_API,
  // The mock serves presigned uploads and signed downloads itself (mocks/server.ts `/__upload`, `/__files`):
  // it is this suite's object storage, so the staff CSP must allow it like the real bucket.
  NEXT_PUBLIC_ASSET_BASE_URL: MOCK_API,
  // One proxy hop, as on Cloud Run: the BFFs and Server Actions forward the right-most X-Forwarded-For entry
  // (review H1), so the suite runs that path rather than the "forward nothing" default.
  TRUSTED_HOPS: "1",
};

/**
 * Chromium's fake camera (a moving test pattern) and an auto-accepted permission prompt, so the staff
 * capture flow runs with a live `getUserMedia` stream in headless runs (F4 4.1 §3).
 */
export const FAKE_CAMERA_ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];

/**
 * A pre-installed Chromium instead of the one this Playwright version would download: set
 * `PW_CHROMIUM_EXECUTABLE` to its binary (and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) on a machine that
 * cannot reach the browser CDN. CI downloads the matching build and leaves this unset.
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
if (executablePath && !existsSync(executablePath)) {
  throw new Error(`PW_CHROMIUM_EXECUTABLE points at ${executablePath}, which does not exist.`);
}

export default defineConfig({
  testDir: "./e2e",
  // The real-API flows have their own config (playwright.integration.config.ts).
  testIgnore: ["integration/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: (process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]]) satisfies ReporterDescription[],
  use: {
    baseURL,
    trace: "on-first-retry",
    launchOptions: {
      args: ["--host-resolver-rules=MAP *.localhost 127.0.0.1", ...FAKE_CAMERA_ARGS],
      ...(executablePath ? { executablePath } : {}),
    },
    permissions: ["camera"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["integration/**", "owner-*.spec.ts", "admin-*.spec.ts", "r2-*.spec.ts"],
    },
    {
      // The owner console's and the platform admin's specs share stateful worlds in the mock API
      // (mocks/owner, mocks/platform — the owner's subscription, support grants and DSRs are the admin's
      // records): one worker, so a spec that issues the billing cycle or suspends the tenant never
      // changes what another spec is reading.
      name: "owner",
      use: { ...devices["Desktop Chrome"] },
      // R2 (F2 2.7 / F4 4.4): the owner and the staff PWA share one service & community world in the mock.
      testMatch: ["owner-*.spec.ts", "admin-*.spec.ts", "r2-*.spec.ts"],
      workers: 1,
    },
  ],
  webServer: [
    {
      command: "pnpm mock:api",
      url: `${MOCK_API}/__mock/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ...process.env, MOCK_API_PORT: String(MOCK_API_PORT) },
    },
    {
      // A production build locally as well as in CI: the shells must be tested as they ship.
      command: `pnpm build && pnpm start -p ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: { ...process.env, ...zoneEnv, NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
