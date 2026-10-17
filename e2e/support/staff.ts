import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../../playwright.config";
import { signInWithOtp } from "./auth";

/** The staff persona of the mock API (mocks/README.md): Staff of หอพักตัวอย่าง, English. */
export const STAFF_PHONE = "0810000004";

export async function signInStaff(page: Page): Promise<void> {
  await signInWithOtp(page, HOSTS.staff, STAFF_PHONE);
  await expect(page.getByTestId("staff-today")).toBeVisible();
  await hydrated(page);
}

/**
 * After a full page load: wait until React has hydrated the staff shell (and the page in it), so a tap
 * reaches a handler rather than a server-rendered button that does nothing yet.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "staff");
}

/** A full navigation on the staff host, ready for interaction. */
export async function gotoStaff(page: Page, path: string): Promise<void> {
  await page.goto(`${HOSTS.staff}${path}`);
  await hydrated(page);
}

export async function mock<T = unknown>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch(`${MOCK_API}${path}`, { method });
  return (await response.json()) as T;
}

export async function resetMock(): Promise<void> {
  await fetch(`${MOCK_API}/__mock/reset`, { method: "POST" });
}

/** WCAG 2.2 AA with axe (target-size included), on the page or a part of it. */
export async function expectAxeClean(page: Page, include?: string): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(results.violations, summary.join("\n")).toEqual([]);
}

/**
 * The staff PWA's own bar (design-system.md §5): every visible control inside `scope` is at least 48 ×
 * 48 CSS px — gloves, sunlight, one hand. Axe checks WCAG's 24 px; this checks ours.
 */
export async function expectTargets48(scope: Locator): Promise<void> {
  const small = await scope.evaluate((root) => {
    const controls = root.querySelectorAll<HTMLElement>(
      'button, a[href], input:not([type="hidden"]):not(.sr-only), select, textarea, [role="button"], [role="radio"], [role="tab"]',
    );
    const found: string[] = [];
    for (const control of controls) {
      const style = getComputedStyle(control);
      if (style.visibility === "hidden" || style.display === "none" || control.closest("[aria-hidden='true']"))
        continue;
      const box = control.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      // Visually hidden until focused (the skip link) — not a resting target.
      if (control.classList.contains("sr-only") || control.classList.contains("skip-link")) continue;
      if (box.width < 47.5 || box.height < 47.5) {
        const name = control.getAttribute("aria-label") ?? control.textContent?.trim().slice(0, 40) ?? control.tagName;
        found.push(`${control.tagName.toLowerCase()} "${name}" ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    return found;
  });
  expect(small, `targets under 48 px:\n${small.join("\n")}`).toEqual([]);
}
