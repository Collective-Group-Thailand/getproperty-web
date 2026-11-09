import { describe, expect, it } from "vitest";

import { entitledMenu } from "@/features/shared/shell/menu";
import type { Schemas } from "@/lib/api/types";

import {
  isJuristicTenant,
  JURISTIC_BOTTOM_NAV,
  isPmCompany,
  JURISTIC_LABEL_KEYS,
  JURISTIC_MENU_GROUPS,
  juristicLayout,
  OWNER_MENU,
  PM_BOTTOM_NAV,
} from "./menu";

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

  it("hides nothing the API grants: apartment-word entries stay; a key the table does not name ends its group", () => {
    // The API (menu.ts at d33fed1) no longer grants `leases` / `deposits` to a juristic office (J-CR, D-335); were one
    // granted, it would still show — last in the group its registry entry names.
    const granted = juristicLayout(
      entitledMenu(keys(["dashboard", "parties", "leases", "readings", "juristic_receivables"]), OWNER_MENU),
    );
    expect(granted.map((item) => item.key)).toEqual([
      "dashboard",
      "juristic_receivables",
      "parties",
      "readings",
      "leases",
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

  it("shows the vendors group of JW2b between finance and settings, in the office's order", () => {
    const withVendors = juristicLayout(
      entitledMenu(
        keys([
          "dashboard",
          "juristic_quotations",
          "juristic_vendor_contracts",
          "juristic_expenses",
          "juristic_vendors",
          "settings",
        ]),
        OWNER_MENU,
      ),
    );
    expect(withVendors.map((item) => [item.key, item.group])).toEqual([
      ["dashboard", "daily"],
      ["juristic_expenses", "finance"],
      ["juristic_vendors", "vendors"],
      ["juristic_vendor_contracts", "vendors"],
      ["juristic_quotations", "vendors"],
      ["settings", "system"],
    ]);
    const href = (key: string) => withVendors.find((item) => item.key === key)?.href;
    expect(href("juristic_vendors")).toBe("/juristic/vendors");
    expect(href("juristic_vendor_contracts")).toBe("/juristic/contracts");
    expect(href("juristic_quotations")).toBe("/juristic/quotations");
  });
});

describe("JW3b keys (D-333, D-334)", () => {
  it("puts handovers after the import and management contracts beside the service contracts", () => {
    const placed = juristicLayout(
      entitledMenu(
        keys([
          "juristic_handovers",
          "juristic_import",
          "juristic_management_contracts",
          "juristic_vendor_contracts",
          "juristic_vendors",
          "settings",
        ]),
        OWNER_MENU,
      ),
    );
    expect(placed.map((item) => [item.key, item.group])).toEqual([
      ["juristic_vendors", "vendors"],
      ["juristic_vendor_contracts", "vendors"],
      ["juristic_management_contracts", "vendors"],
      ["juristic_import", "system"],
      ["juristic_handovers", "system"],
      ["settings", "system"],
    ]);
  });

  it("routes a PM company's keys to its portfolio pages and leads its phone nav with them", () => {
    expect(OWNER_MENU.pm_portfolio?.href).toBe("/portfolio");
    expect(OWNER_MENU.pm_staff?.href).toBe("/portfolio/staff");
    expect(OWNER_MENU.pm_contracts?.href).toBe("/portfolio/contracts");
    expect(PM_BOTTOM_NAV.map((entry) => entry.key).slice(0, 3)).toEqual(["pm_portfolio", "pm_staff", "pm_contracts"]);
    expect(isPmCompany("pm_company", ["pm_portfolio"])).toBe(true);
    expect(isPmCompany("pm_company", ["dashboard"])).toBe(false);
    expect(isPmCompany("landlord", ["pm_portfolio"])).toBe(false);
  });
});

describe("J-CR keys (D-335)", () => {
  const layout = (list: readonly string[], permissions?: readonly string[]) =>
    juristicLayout(entitledMenu(keys(list), OWNER_MENU), (href) => href, permissions);

  it("routes the five new keys to their pages", () => {
    expect(OWNER_MENU.juristic_overview?.href).toBe("/juristic");
    expect(OWNER_MENU.juristic_resolutions?.href).toBe("/juristic/resolutions");
    expect(OWNER_MENU.juristic_reports?.href).toBe("/juristic/reports");
    expect(OWNER_MENU.juristic_payment_mandates?.href).toBe("/juristic/payment-mandates");
    expect(OWNER_MENU.juristic_petty_cash?.href).toBe("/juristic/petty-cash");
  });

  it("shows the overview once: `juristic_overview` replaces `dashboard`, first, and leads the phone nav", () => {
    const placed = layout(["dashboard", "juristic_overview", "juristic_register"]);
    expect(placed.map((item) => [item.key, item.href])).toEqual([
      ["juristic_overview", "/juristic"],
      ["juristic_register", "/juristic/register"],
    ]);
    expect(JURISTIC_BOTTOM_NAV[0]!.key).toBe("juristic_overview");
  });

  it("keeps a section's sub-page inside the section when both are granted", () => {
    const placed = layout(
      [
        "juristic_receivables",
        "juristic_reports",
        "juristic_payment_mandates",
        "juristic_budgets",
        "juristic_resolutions",
        "juristic_funds",
        "juristic_petty_cash",
      ],
      ["juristic.accounting.read"],
    );
    expect(placed.map((item) => item.key)).toEqual(["juristic_receivables", "juristic_funds", "juristic_budgets"]);
  });

  it("gives the new keys entries of their own when the section is not granted", () => {
    const placed = layout(["juristic_reports", "juristic_payment_mandates", "juristic_resolutions"]);
    expect(placed.map((item) => [item.key, item.group])).toEqual([
      ["juristic_payment_mandates", "finance"],
      ["juristic_reports", "finance"],
      ["juristic_resolutions", "system"],
    ]);
  });

  it("shows a petty-cash spender petty cash, not the funds", () => {
    const spender = ["juristic.petty_cash.spend", "juristic.expense.request"];
    expect(layout(["juristic_funds", "juristic_petty_cash"], spender).map((item) => item.key)).toEqual([
      "juristic_petty_cash",
    ]);
    // An accountant keeps funds with petty cash as its sub-page.
    expect(
      layout(["juristic_funds", "juristic_petty_cash"], ["juristic.accounting.read"]).map((item) => item.key),
    ).toEqual(["juristic_funds"]);
    // A tenant whose API still grants only funds keeps it.
    expect(layout(["juristic_funds"], spender).map((item) => item.key)).toEqual(["juristic_funds"]);
  });
});
