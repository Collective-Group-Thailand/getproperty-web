import { expect, test } from "@playwright/test";

/** Visual baselines of the three zone shells (Storybook stories `Shells/*`) and the founder's logo (`Brand/*`). */
const STORIES = [
  { id: "shells-owner--desktop", width: 1280, height: 800 },
  { id: "shells-owner--single-tenant", width: 1280, height: 800 },
  { id: "shells-owner--read-only", width: 1280, height: 800 },
  { id: "shells-owner--phone", width: 390, height: 844 },
  { id: "shells-staff--phone", width: 390, height: 844 },
  { id: "shells-admin--desktop", width: 1280, height: 800 },
  { id: "shells-owner--phone", width: 360, height: 640, name: "shells-owner--phone-360" },
  { id: "brand-wordmark--sizes", width: 600, height: 260, ready: "svg[data-brand]" },
  { id: "brand-wordmark--on-dark", width: 600, height: 160, ready: "svg[data-brand]" },
  { id: "brand-wordmark--dark", width: 600, height: 160, ready: "svg[data-brand]", theme: "dark" },
  { id: "brand-wordmark--high-contrast", width: 600, height: 160, ready: "svg[data-brand]", theme: "hc" },
] as const satisfies readonly {
  id: string;
  width: number;
  height: number;
  name?: string;
  ready?: string;
  theme?: string;
}[];

for (const story of STORIES) {
  const name: string = "name" in story ? story.name : story.id;
  test(name, async ({ page }) => {
    await page.setViewportSize({ width: story.width, height: story.height });
    await page.goto(
      `/iframe.html?id=${story.id}&viewMode=story&globals=theme:${"theme" in story ? story.theme : "light"}`,
    );
    await page
      .locator(`#storybook-root ${"ready" in story ? story.ready : "main#main"}`)
      .first()
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false });
  });
}
