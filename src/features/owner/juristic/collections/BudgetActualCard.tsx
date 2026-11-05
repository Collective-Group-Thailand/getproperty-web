import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate, formatPercent, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Card, CardHeader } from "@/ui/components/Card";
import { Statement } from "@/ui/components/Statement";

import { section, type OwnerContext } from "../../shared/server";
import { BudgetExpenseCard } from "../accounting/BudgetExpense";

/**
 * Budget vs actual, income side (J1.2b §4, D-304): what the budget planned to bill against what was billed in its
 * period (common fee, fund, surcharge, other — net of credit notes) and collected; since J2.1 (JW2a) the expense side
 * follows as its own card. Every figure and ratio is the API's.
 */
export async function BudgetActualCard({ context, budgetId }: { context: OwnerContext; budgetId: string }) {
  const t = await getTranslations("owner.collections.budgetActual");
  const { api, locale } = context;
  const actual = await section(
    unwrap(api.GET("/v1/owner/juristic/budgets/{budgetId}/actual-income", { params: { path: { budgetId } } })),
  );
  const money = (value: string) => formatTHB(value, locale);
  return (
    <>
      <Card as="section" aria-labelledby="actual-title" className="flex flex-col gap-4" data-testid="budget-actual">
        <CardHeader
          title={<span id="actual-title">{t("title")}</span>}
          description={
            actual.data
              ? t("hint", {
                  from: formatDate(actual.data.periodStart, locale),
                  to: formatDate(actual.data.periodEnd, locale),
                  date: formatDate(actual.data.asOf, locale),
                })
              : undefined
          }
        />
        {!actual.data ? (
          <SectionError error={actual.error} />
        ) : (
          <>
            <Statement
              caption={t("title")}
              columns={[t("amount")]}
              lines={[
                { key: "budgeted", label: t("budgeted"), value: money(actual.data.budgetedIncome) },
                ...actual.data.incomeLines.map((line, index) => ({
                  key: `line-${index}`,
                  label: line.label,
                  value: money(line.amount),
                  level: 1 as const,
                })),
                { key: "billed", label: t("billed"), value: money(actual.data.billed), kind: "subtotal" as const },
                ...actual.data.billedByKind.map((part) => ({
                  key: `kind-${part.kind}`,
                  label: t(`kind.${part.kind}`),
                  value: money(part.amount),
                  level: 1 as const,
                })),
                {
                  key: "collected",
                  label: t("collected"),
                  value: money(actual.data.collected),
                  kind: "result" as const,
                },
              ]}
            />
            <dl className="m-0 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted text-sm">{t("billedVsBudget")}</dt>
                <dd className="m-0 font-semibold tabular-nums" data-testid="budget-billed-pct">
                  {actual.data.billedVsBudgetPct ? formatPercent(actual.data.billedVsBudgetPct, locale) : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted text-sm">{t("collectedVsBilled")}</dt>
                <dd className="m-0 font-semibold tabular-nums">
                  {actual.data.collectedVsBilledPct ? formatPercent(actual.data.collectedVsBilledPct, locale) : "—"}
                </dd>
              </div>
            </dl>
            {actual.data.expenseSideAvailable ? null : <p className="text-muted m-0 text-sm">{t("expenseLater")}</p>}
          </>
        )}
      </Card>
      {actual.data?.expenseSideAvailable ? <BudgetExpenseCard data={actual.data} locale={locale} /> : null}
    </>
  );
}
