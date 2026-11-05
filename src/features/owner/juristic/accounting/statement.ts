import { TIME_ZONE } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";

import { decimalSatang, isZero } from "./money";

/**
 * The income / expense statement (J2.1 §6) as an accountant reads it: one column per period of the chosen year, the
 * accounts of each section, a subtotal per section and the surplus on a double rule. The figures are the API's
 * strings; this file only decides the range asked for, the column headings and how a figure is written.
 */
export type Granularity = "month" | "quarter" | "year";
export const GRANULARITIES: readonly Granularity[] = ["month", "quarter", "year"];
/** Years shown side by side in the yearly view (the API allows a range of at most three years). */
export const YEARS_SIDE_BY_SIDE = 3;

export function parseGranularity(value: string | undefined): Granularity {
  return value === "quarter" || value === "year" ? value : "month";
}

/** A typed year in CE from the query (`?year=2026`), else the current Bangkok year. */
export function parseYear(value: string | undefined, today: string): number {
  const current = Number(today.slice(0, 4));
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= current + 1 ? year : current;
}

/** The range the API is asked for: the calendar year, or three years ending with it for the yearly view. */
export function statementRange(year: number, granularity: Granularity): { from: string; to: string } {
  const first = granularity === "year" ? year - (YEARS_SIDE_BY_SIDE - 1) : year;
  return { from: `${first}-01-01`, to: `${year}-12-31` };
}

/** The years offered by the year switch: the current year and the four before it, newest first. */
export function yearOptions(today: string, count = 5): number[] {
  const current = Number(today.slice(0, 4));
  return Array.from({ length: count }, (_, index) => current - index);
}

/** A year as the reader counts it (2026 → "2569" in Thai). */
export function readerYear(year: number, locale: Locale): string {
  return String(locale === "th" ? year + 543 : year);
}

const tag = (locale: Locale) => (locale === "th" ? "th-TH-u-ca-gregory" : "en-GB");

/**
 * A column heading: the month's short name (the year is in the statement's head), "ไตรมาส 1" / "Q1", or the year in
 * the reader's era. A key the API did not send in a known shape is shown as it came.
 */
export function periodColumn(key: string, locale: Locale): string {
  const month = /^(\d{4})-(\d{2})$/.exec(key);
  if (month) {
    const date = new Date(`${key}-15T12:00:00+07:00`);
    return new Intl.DateTimeFormat(tag(locale), { month: "short", timeZone: TIME_ZONE }).format(date);
  }
  const quarter = /^(\d{4})-Q([1-4])$/.exec(key);
  if (quarter) return locale === "th" ? `ไตรมาส ${quarter[2]}` : `Q${quarter[2]}`;
  const year = /^(\d{4})$/.exec(key);
  if (year) return readerYear(Number(year[1]), locale);
  return key;
}

/**
 * A statement figure as accountants write it: negatives in parentheses, exact zero as an en dash (so the active
 * months stand out); `format` is `formatTHB` without the symbol. Totals pass `zero: "figure"` to keep "0.00".
 */
export function statementFigure(
  value: string,
  format: (value: string) => string,
  options: { zero?: "dash" | "figure" } = {},
): string {
  if (options.zero !== "figure" && isZero(value)) return "–";
  const amount = decimalSatang(value);
  if (amount !== null && amount < 0n) return `(${format(value.trim().replace(/^-/, ""))})`;
  return format(value);
}

export interface StatementSection {
  accounts: { accountId: string; code: string; nameTh: string; nameEn: string; amounts: string[]; total: string }[];
  byPeriod: string[];
  total: string;
}

export interface StatementRow {
  key: string;
  kind: "heading" | "line" | "subtotal" | "result";
  label: string;
  code?: string;
  /** Per period, then the total — formatted. */
  values: string[];
}

/** The rows of a statement: income heading, accounts, subtotal; expense heading, accounts, subtotal; the surplus. */
export function statementRows(
  statement: { income: StatementSection; expense: StatementSection; surplusByPeriod: string[]; surplus: string },
  labels: { income: string; incomeTotal: string; expense: string; expenseTotal: string; surplus: string },
  locale: Locale,
  format: (value: string) => string,
): StatementRow[] {
  const figure = (value: string) => statementFigure(value, format);
  const total = (value: string) => statementFigure(value, format, { zero: "figure" });
  const section = (key: "income" | "expense", data: StatementSection, heading: string, sum: string): StatementRow[] => [
    { key: `${key}-heading`, kind: "heading", label: heading, values: [] },
    ...data.accounts.map((account) => ({
      key: `${key}-${account.accountId}`,
      kind: "line" as const,
      code: account.code,
      label: locale === "th" ? account.nameTh : account.nameEn,
      values: [...account.amounts.map(figure), total(account.total)],
    })),
    { key: `${key}-total`, kind: "subtotal", label: sum, values: [...data.byPeriod.map(total), total(data.total)] },
  ];
  return [
    ...section("income", statement.income, labels.income, labels.incomeTotal),
    ...section("expense", statement.expense, labels.expense, labels.expenseTotal),
    {
      key: "surplus",
      kind: "result",
      label: labels.surplus,
      values: [...statement.surplusByPeriod.map(total), total(statement.surplus)],
    },
  ];
}
