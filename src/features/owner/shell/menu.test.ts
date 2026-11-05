import { describe, expect, it } from "vitest";

import { entitledMenu } from "@/features/shared/shell/menu";
import type { Schemas } from "@/lib/api/types";

import { isJuristicTenant, JURISTIC_LABEL_KEYS, JURISTIC_MENU_GROUPS, juristicLayout, OWNER_MENU } from "./menu";

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
      "juristic_receivables",
      "juristic_register",
      "service_requests",
      "buildings",
      "units",
      "parties",
      "juristic_cycles",
      "juristic_statements",
      "juristic_debt_clearances",
      "juristic_payment_plans",
      "invoices",
      "payments",
      "rate_plans",
      "reports",
      "juristic_budgets",
      "juristic_collection_ladder",
      "settings",
    ]);
    expect([...new Set(items.map((item) => item.group))]).toEqual(["daily", "finance", "system"]);
    expect(JURISTIC_MENU_GROUPS).toContain("vendors");
  });

  it("opens the juristic overview as the morning page", () => {
    expect(items.find((item) => item.key === "dashboard")?.href).toBe("/en/juristic");
  });

  it("opens the collection screens of JW1b, each with its sub-pages", () => {
    const href = (key: string) => items.find((item) => item.key === key)?.href;
    expect(href("juristic_receivables")).toBe("/juristic/receivables");
    expect(href("juristic_payment_plans")).toBe("/juristic/plans");
    expect(href("juristic_debt_clearances")).toBe("/juristic/debt-clearance");
    expect(href("juristic_statements")).toBe("/juristic/statements");
    expect(href("juristic_collection_ladder")).toBe("/juristic/collections/settings");
    expect(items.find((item) => item.key === "juristic_receivables")?.children?.map((child) => child.href)).toEqual([
      "/juristic/receivables",
      "/juristic/reports",
      "/juristic/payment-mandates",
    ]);
    expect(items.find((item) => item.key === "juristic_statements")?.children?.map((child) => child.href)).toEqual([
      "/juristic/statements",
      "/juristic/statements/letters",
    ]);
  });

  it("hides nothing the API grants: apartment-word entries stay, last in the daily group", () => {
    // The API (menu.ts at ed938f2) grants these to a juristic owner; the web only re-orders and re-labels them.
    const granted = juristicLayout(
      entitledMenu(
        keys(["dashboard", "parties", "leases", "readings", "deposits", "juristic_receivables"]),
        OWNER_MENU,
      ),
    );
    expect(granted.map((item) => item.key)).toEqual([
      "dashboard",
      "juristic_receivables",
      "parties",
      "readings",
      "leases",
      "deposits",
    ]);
    expect(JURISTIC_LABEL_KEYS.has("parties")).toBe(true);
  });

  it("gives a landlord its juristic-office invitations", () => {
    const landlord = entitledMenu(keys(["portfolio", "juristic_workspace_invitations"]), OWNER_MENU);
    expect(landlord.find((item) => item.key === "juristic_workspace_invitations")?.href).toBe("/juristic-office");
  });

  it("keeps budgets and resolutions as one section", () => {
    const budgets = items.find((item) => item.key === "juristic_budgets");
    expect(budgets?.children?.map((child) => child.href)).toEqual(["/juristic/budgets", "/juristic/resolutions"]);
  });

  it("puts the light GL of JW2a in the finance group, after the plans, with its sub-pages", () => {
    const withBooks = juristicLayout(
      entitledMenu(
        keys([
          "dashboard",
          "juristic_payment_plans",
          "juristic_accounting",
          "juristic_expenses",
          "juristic_funds",
          "juristic_bank_statements",
          "invoices",
        ]),
        OWNER_MENU,
      ),
    );
    const finance = withBooks.filter((item) => item.group === "finance").map((item) => item.key);
    expect(finance).toEqual([
      "juristic_payment_plans",
      "juristic_accounting",
      "juristic_funds",
      "juristic_expenses",
      "juristic_bank_statements",
      "invoices",
    ]);
    const children = (key: string) => withBooks.find((item) => item.key === key)?.children?.map((child) => child.href);
    expect(children("juristic_accounting")).toEqual([
      "/juristic/accounting",
      "/juristic/accounting/journals",
      "/juristic/accounting/accounts",
    ]);
    expect(children("juristic_funds")).toEqual(["/juristic/funds", "/juristic/petty-cash"]);
    expect(children("juristic_expenses")).toEqual([
      "/juristic/expenses",
      "/juristic/expenses/certificates",
      "/juristic/expenses/settings",
    ]);
    expect(withBooks.find((item) => item.key === "juristic_bank_statements")?.href).toBe("/juristic/bank-statements");
  });
});
