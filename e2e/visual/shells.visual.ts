import { expect, test } from "@playwright/test";

/** Visual baselines of the three zone shells (Storybook stories `Shells/*`). */
const STORIES = [
  { id: "shells-owner--desktop", width: 1280, height: 800 },
  { id: "shells-owner--single-tenant", width: 1280, height: 800 },
  { id: "shells-owner--read-only", width: 1280, height: 800 },
  { id: "shells-owner--phone", width: 390, height: 844 },
  { id: "shells-staff--phone", width: 390, height: 844 },
  { id: "shells-admin--desktop", width: 1280, height: 800 },
] as const;

for (const story of STORIES) {
  test(story.id, async ({ page }) => {
    await page.setViewportSize({ width: story.width, height: story.height });
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story&globals=theme:light`);
    await page.locator("#storybook-root main#main").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${story.id}.png`, { fullPage: false });
  });
}
