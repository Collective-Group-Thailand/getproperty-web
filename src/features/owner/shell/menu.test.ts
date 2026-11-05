import { describe, expect, it } from "vitest";

import { entitledMenu } from "@/features/shared/shell/menu";
import type { Schemas } from "@/lib/api/types";

import { isJuristicTenant, JURISTIC_MENU_GROUPS, juristicLayout, OWNER_MENU } from "./menu";

const keys = (list: readonly string[]) => list as Schemas["OwnerMenuKey"][];

describe("juristic rail (J-DESIGN §5)", () => {
  const menu = keys([
    "dashboard",
    "buildings",
    "units",
    "parties",
    "rate_plans",
    "invoices",
    "payments",
    "reports",
    "service_requests",
    "juristic_register",
    "juristic_cycles",
    "juristic_budgets",
    "juristic_payment_plans",
    "juristic_debt_clearances",
    "juristic_receivables",
    "juristic_statements",
    "juristic_collection_ladder",
    "settings",
  ]);
  const items = juristicLayout(entitledMenu(menu, OWNER_MENU), (href) => `/en${href}`);

  it("knows the juristic tenant types, the deprecated alias included", () => {
    expect(isJuristicTenant("juristic")).toBe(true);
    expect(isJuristicTenant("condo_juristic")).toBe(true);
    expect(isJuristicTenant("apartment")).toBe(false);
    expect(isJuristicTenant(undefined)).toBe(false);
  });

  it("orders the groups and their entries as the office works", () => {
    expect(items.map((item) => item.key)).toEqual([
      "dashboard",
      "juristic_register",
      "service_requests",
      "buildings",
      "units",
      "parties",
      "juristic_cycles",
      "invoices",
      "payments",
      "rate_plans",
      "reports",
      "juristic_budgets",
      "settings",
    ]);
    expect([...new Set(items.map((item) => item.group))]).toEqual(["daily", "finance", "system"]);
    expect(JURISTIC_MENU_GROUPS).toContain("vendors");
  });

  it("opens the juristic overview as the morning page", () => {
    expect(items.find((item) => item.key === "dashboard")?.href).toBe("/en/juristic");
  });

  it("shows no entry for screens that do not exist yet (JW1b keys)", () => {
    for (const key of [
      "juristic_receivables",
      "juristic_payment_plans",
      "juristic_statements",
      "juristic_collection_ladder",
    ])
      expect(items.some((item) => item.key === key)).toBe(false);
  });

  it("keeps budgets and resolutions as one section", () => {
    const budgets = items.find((item) => item.key === "juristic_budgets");
    expect(budgets?.children?.map((child) => child.href)).toEqual(["/juristic/budgets", "/juristic/resolutions"]);
  });
});
