import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

/**
 * Storybook visual snapshots of the zone shells (F1 1.3 §8): `pnpm build-storybook && pnpm e2e:visual`.
 * Baselines live beside the spec (`e2e/visual/*-snapshots/`) and are updated deliberately with
 * `pnpm e2e:visual --update-snapshots` — a changed shell is a reviewed diff of PNGs.
 */
const PORT = Number(process.env.VISUAL_PORT ?? 6106);
export const STORYBOOK = `http://127.0.0.1:${PORT}`;

const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
if (executablePath && !existsSync(executablePath)) {
  throw new Error(`PW_CHROMIUM_EXECUTABLE points at ${executablePath}, which does not exist.`);
}

export default defineConfig({
  testDir: "./e2e/visual",
  testMatch: "**/*.visual.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report/visual" }]]
    : [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixels: 200, animations: "disabled", caret: "hide" } },
  snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
  use: { baseURL: STORYBOOK, ...(executablePath ? { launchOptions: { executablePath } } : {}) },
  projects: [{ name: "visual", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec tsx scripts/serve-static.ts storybook-static ${PORT}`,
    url: `${STORYBOOK}/iframe.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
