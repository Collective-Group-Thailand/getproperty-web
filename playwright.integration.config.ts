import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

/**
 * `pnpm e2e:integration` — the sign-in flows once against the real getproperty-api (F1 1.2): the API at
 * the commit pinned in contract.lock.json, on an embedded PostgreSQL with migrations and the dev seed,
 * `DATA_STORES_MODE=real`, fake integrations (e2e/integration/harness.ts). Slow to start (export, build,
 * migrate); not part of `pnpm e2e`.
 */
const PORT = Number(process.env.INT_WEB_PORT ?? 3200);
export const INT_HOSTS = {
  owner: `http://localhost:${PORT}`,
  staff: `http://staff.localhost:${PORT}`,
  admin: `http://admin.localhost:${PORT}`,
} as const;
export const INT_API = `http://127.0.0.1:${process.env.INT_API_PORT ?? 4210}`;
export const INT_CONTROL = `http://127.0.0.1:${process.env.INT_CONTROL_PORT ?? 4211}`;

const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
if (executablePath && !existsSync(executablePath)) {
  throw new Error(`PW_CHROMIUM_EXECUTABLE points at ${executablePath}, which does not exist.`);
}

export default defineConfig({
  testDir: "./e2e/integration",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report/integration" }]]
    : [["list"]],
  use: {
    baseURL: INT_HOSTS.owner,
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--host-resolver-rules=MAP *.localhost 127.0.0.1"],
      ...(executablePath ? { executablePath } : {}),
    },
  },
  projects: [{ name: "integration", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm exec tsx e2e/integration/harness.ts",
      url: `${INT_CONTROL}/health`,
      reuseExistingServer: false,
      timeout: 600_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `pnpm build && pnpm start -p ${PORT}`,
      url: INT_HOSTS.owner,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        ...process.env,
        OWNER_HOST: `localhost:${PORT}`,
        STAFF_HOST: `staff.localhost:${PORT}`,
        ADMIN_HOST: `admin.localhost:${PORT}`,
        API_INTERNAL_URL: INT_API,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
