import { expect, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../../playwright.config";
import { signInWithOtp } from "./auth";

/** The owner persona of the mock API (mocks/README.md): Owner of หอพักตัวอย่าง, Thai. */
export const OWNER_PHONE = "0810000001";

/** Ids of the owner world (mocks/owner/world.ts). */
export const W = {
  buildingA: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c",
  buildingB: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b7d",
  buildingC: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b8e",
  unitA201: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7d",
  unitA301: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c80",
} as const;

export async function signInOwner(page: Page): Promise<void> {
  await signInWithOtp(page, HOSTS.owner, OWNER_PHONE);
  await expect(page.getByTestId("owner-dashboard")).toBeVisible();
  await hydrated(page);
}

/** Wait until React has hydrated the owner console (the shell marks `<html data-hydrated="owner">`). */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement?.dataset.hydrated === "owner");
}

/** A full navigation in the owner console, ready for interaction (hydrated). */
export async function gotoOwner(page: Page, path: string): Promise<void> {
  await page.goto(`${HOSTS.owner}${path}`);
  await hydrated(page);
}

export async function resetOwner(part?: "assets" | "leases" | "money" | "metering"): Promise<void> {
  await fetch(`${MOCK_API}/__mock/owner/reset${part ? `?part=${part}` : ""}`, { method: "POST" });
}

export async function ownerControl<T = unknown>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch(`${MOCK_API}/__mock/owner/${path}`, { method });
  return (await response.json()) as T;
}

export async function received(
  op: string,
): Promise<{ op: string; idempotencyKey: string | null; body: Record<string, unknown> }[]> {
  return ownerControl(`received?op=${encodeURIComponent(op)}`);
}

export async function setBuilding(page: Page, buildingId: string | null): Promise<void> {
  await page
    .context()
    .addCookies([
      { name: "gp_building", value: buildingId ?? "", url: HOSTS.owner, ...(buildingId ? {} : { expires: 0 }) },
    ]);
}
