import { expect, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../../playwright.config";
import { CODE, PASSWORD } from "./auth";

/** Platform personas of the mock API (mocks/fixtures.ts PLATFORM_USERS). */
export type PlatformPersona = "admin" | "support" | "ops" | "checker" | "finance" | "engineer";

/**
 * Password + authenticator sign-in on the admin host as one persona (the enrolled ones — every persona
 * but `admin`, which enrols TOTP on first sign-in and is covered by auth.spec.ts).
 */
export async function signInPlatform(page: Page, persona: Exclude<PlatformPersona, "admin">): Promise<void> {
  await page.goto(`${HOSTS.admin}/login`);
  await page.getByLabel(/อีเมล|Email/).fill(`${persona}@example.com`);
  await page.getByRole("textbox", { name: /^(รหัสผ่าน|Password)$/ }).fill(PASSWORD);
  await page.getByRole("button", { name: /เข้าสู่ระบบ|Sign in/ }).click();
  await page.getByLabel(/รหัสจากแอปยืนยันตัวตน|Authenticator code/).fill(CODE);
  await page.getByRole("button", { name: /เข้าสู่ระบบ|Sign in/ }).click();
  await expect(page).toHaveURL(`${HOSTS.admin}/`);
  await hydratedAdmin(page);
}

export async function hydratedAdmin(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement?.dataset.hydrated === "admin");
}

/** A full navigation in the admin console, ready for interaction. */
export async function gotoAdmin(page: Page, path: string): Promise<void> {
  await page.goto(`${HOSTS.admin}${path}`);
  await hydratedAdmin(page);
}

export async function resetPlatform(): Promise<void> {
  await fetch(`${MOCK_API}/__mock/platform/reset`, { method: "POST" });
}

export async function platformControl<T = unknown>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch(`${MOCK_API}/__mock/platform/${path}`, { method });
  return (await response.json()) as T;
}

export async function platformReceived(
  op: string,
): Promise<{ op: string; idempotencyKey: string | null; body: Record<string, unknown> }[]> {
  return platformControl(`received?op=${encodeURIComponent(op)}`);
}

/** Types a typed confirmation's phrase (shown as the input's placeholder) into an open alert dialog. */
export async function typePhrase(dialog: import("@playwright/test").Locator): Promise<void> {
  const input = dialog.getByRole("textbox", { name: /^(Type|พิมพ์)/ });
  await input.fill((await input.getAttribute("placeholder")) ?? "");
}

/** Ids of the platform world (mocks/platform/world.ts). */
export const P = {
  sample: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11",
  garden: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c44",
  invoiceOpen: "8b000000-0000-4000-8000-000000000001",
  tariffMea: "9b000000-0000-4000-8000-000000000001",
  gwSampleA: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e01",
  gwSampleB: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e02",
  gwGarden: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e03",
  gwStock: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e04",
  rollout: "aa000000-0000-4000-8000-000000000001",
} as const;
