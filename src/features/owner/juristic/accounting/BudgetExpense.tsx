import { getTranslations } from "next-intl/server";

import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import { decimalSatang } from "./money";

/**
 * The actual's share of the budget for the bar (drawing only: two API figures compared, nothing summed) and whether
 * the actual passed the budget.
 */
export function usage(actual: string | null, budgeted: string): { share: number; over: boolean } | null {
  if (actual === null) return null;
  const a = decimalSatang(actual);
  const b = decimalSatang(budgeted);
  if (a === null || b === null) return null;
  if (b <= 0n) return { share: a > 0n ? 1 : 0, over: a > 0n };
  return { share: Math.max(0, Math.min(1, Number((a * 1000n) / b) / 1000)), over: a > b };
}

/** A bar of the budget (the track) with the actual in brand blue — the only blue on the card. */
function UsageBar({ share, label }: { share: number; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="bg-bg-subtle rounded-thumb block h-2 w-full min-w-24 overflow-hidden"
    >
      <span className="bg-primary rounded-thumb block h-full" style={{ width: `${(share * 100).toFixed(1)}%` }} />
    </span>
  );
}

/**
 * Budget vs actual, expense side (J2.1 §6, D-329): each expense and fund line of the budget against the debits on its
 * account in the budget period for the building — the API's budgeted, actual and remaining. A line without an account
 * has no actual and says so; a line past its budget is a warning in words, never a red bar.
 */
export async function BudgetExpenseCard({ data, locale }: { data: Schemas["BudgetActualIncomeDto"]; locale: Locale }) {
  const t = await getTranslations("owner.accounting.budgetExpense");
  const money = (value: string) => formatTHB(value, locale);
  const total = usage(data.actualExpense, data.budgetedExpense);
  return (
    <Card
      as="section"
      aria-labelledby="budget-expense-title"
      className="flex flex-col gap-4"
      data-testid="budget-expense"
    >
      <CardHeader
        title={<span id="budget-expense-title">{t("title")}</span>}
        description={t("hint", { date: formatDate(data.asOf, locale) })}
      />
      {/* The usage bar is not a term of the list: it sits beside the <dl>, not in it (axe definition-list). */}
      <div className="grid gap-4 sm:grid-cols-3">
        <dl className="m-0 grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted text-sm">{t("budgeted")}</dt>
            <dd className="m-0 text-lg font-semibold tabular-nums">{money(data.budgetedExpense)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted text-sm">{t("actual")}</dt>
            <dd className="text-primary m-0 text-lg font-semibold tabular-nums" data-testid="budget-actual-expense">
              {money(data.actualExpense)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col justify-end gap-1.5">
          {total ? (
            <UsageBar
              share={total.share}
              label={t("usedOf", { actual: money(data.actualExpense), budget: money(data.budgetedExpense) })}
            />
          ) : null}
        </div>
      </div>
      <SimpleTable
        caption={t("title")}
        minWidth="38rem"
        stackOnPhones
        testId="budget-expense-lines"
        columns={[
          { key: "label", header: t("col.line"), phone: "title" },
          { key: "budgeted", header: t("col.budgeted"), align: "end", phone: "meta" },
          { key: "actual", header: t("col.actual"), align: "end", phone: "figure" },
          { key: "remaining", header: t("col.remaining"), align: "end", phone: "status" },
        ]}
        rows={data.expenseLines.map((line) => {
          const used = usage(line.actual, line.budgeted);
          return {
            key: line.budgetLineId,
            testId: "budget-expense-line",
            data: { over: used?.over ?? false },
            cells: {
              label: (
                <span className="flex flex-col">
                  <span>{line.label}</span>
                  <span className="text-muted text-sm">{t(`kind.${line.kind}`)}</span>
                </span>
              ),
              budgeted: <span className="tabular-nums">{money(line.budgeted)}</span>,
              actual:
                line.actual === null ? (
                  <span className="text-muted text-sm">{t("noAccount")}</span>
                ) : (
                  <span className="ms-auto flex w-36 flex-col items-end gap-1">
                    <span className="font-medium tabular-nums">{money(line.actual)}</span>
                    {used ? (
                      <UsageBar
                        share={used.share}
                        label={t("usedOf", { actual: money(line.actual), budget: money(line.budgeted) })}
                      />
                    ) : null}
                  </span>
                ),
              remaining:
                line.remaining === null ? (
                  <span className="text-muted">—</span>
                ) : used?.over ? (
                  <StatusText tone="warning" icon={IconWarning} className="items-end">
                    {t("over", { amount: money(line.remaining.replace(/^-/, "")) })}
                  </StatusText>
                ) : (
                  <span className="tabular-nums">{money(line.remaining)}</span>
                ),
            },
          };
        })}
        footer={{
          label: t("total"),
          budgeted: money(data.budgetedExpense),
          actual: <span className="text-primary">{money(data.actualExpense)}</span>,
        }}
      />
      <p className="text-muted m-0 text-sm">{t("note")}</p>
    </Card>
  );
}
