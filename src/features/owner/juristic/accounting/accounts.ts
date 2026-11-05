import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";

type Account = Schemas["AccountDto"];
export type AccountType = Schemas["JuristicAccountType"];

/** The chart's sections in statement order. */
export const ACCOUNT_TYPES: readonly AccountType[] = ["asset", "liability", "equity", "income", "expense"];

/** The chart grouped by type, each group by code (the order accountants scan). */
export function groupAccounts(accounts: readonly Account[]): { type: AccountType; accounts: Account[] }[] {
  return ACCOUNT_TYPES.map((type) => ({
    type,
    accounts: accounts
      .filter((account) => account.type === type)
      .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true })),
  })).filter((group) => group.accounts.length > 0);
}

export function accountName(account: Pick<Account, "nameTh" | "nameEn">, locale: Locale): string {
  return locale === "th" ? account.nameTh : account.nameEn;
}

/** "5130 · ค่าซ่อมแซมและบำรุงรักษา" — for pickers. */
export function accountLabel(account: Pick<Account, "code" | "nameTh" | "nameEn">, locale: Locale): string {
  return `${account.code} · ${accountName(account, locale)}`;
}

/** Accounts an expense line may use: active expense accounts. */
export function expenseAccounts(accounts: readonly Account[]): Account[] {
  return accounts
    .filter((account) => account.type === "expense" && account.isActive)
    .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
}

const MONEY_ROLES = new Set(["bank", "cash"]);

/**
 * Accounts money can be paid from or moved to: active asset accounts that stand for a bank account or hold cash
 * (system roles `bank` / `cash`), never a fund's own bank account (that is the fund's side) nor a petty cash float.
 */
export function moneyAccounts(accounts: readonly Account[]): Account[] {
  return accounts
    .filter(
      (account) =>
        account.type === "asset" &&
        account.isActive &&
        account.fundId === null &&
        (account.bankAccountId !== null || (account.role !== null && MONEY_ROLES.has(account.role))),
    )
    .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
}

/** Accounts a manual journal line may use: every active account. */
export function journalAccounts(accounts: readonly Account[]): Account[] {
  return accounts
    .filter((account) => account.isActive)
    .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
}
