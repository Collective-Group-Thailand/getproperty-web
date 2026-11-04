import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Statement, type StatementLine } from "@/ui/components/Statement";
import { IconChart } from "@/ui/icons/glyphs/chart";

import { ownerPath } from "../shared/links";
import { type OwnerContext } from "../shared/server";
import { IncomeSummaryButton } from "./IncomeSummaryButton";

/**
 * Annual rental income (B7.5, D-253, section 40(5); redesign G6): the year in the page head, the year's income as a
 * paper-like statement — assessable income, the flat-rate deduction the API's setting gives (an estimate), the result
 * under a double rule, and the actual-expense alternative when owner repairs were recorded — with what the figures are
 * for beside it, then each unit's rent, deposit kept and income with its PDF summary for the owner's PND 90 / 94.
 * Every amount is the API's; nothing is added up here.
 */
export async function IncomeView({ context, year: asked }: { context: OwnerContext; year?: string }) {
  const t = await getTranslations("owner.income");
  const { api, locale } = context;
  const current = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()),
  );
  const year =
    asked && /^\d{4}$/.test(asked) && Number(asked) <= current && Number(asked) >= 2020 ? Number(asked) : current;
  const data = await unwrap(api.GET("/v1/owner/income-summaries", { params: { query: { year } } }));
  const years = Array.from({ length: Math.min(6, current - 2019) }, (_, i) => current - i);
  const label = (y: number) => (locale === "th" ? String(y + 543) : String(y));
  const money = (value: string) => formatTHB(value, locale);
  const actual = data.totals.expenses !== "0.00";
  const lines: StatementLine[] = [
    {
      key: "gross",
      label: t("gross", { year: label(year) }),
      value: <span data-testid="income-gross">{money(data.totals.gross)}</span>,
    },
    {
      key: "deduction",
      label: t("deduction", { percent: data.deductionPercent }),
      value: money(data.totals.deduction),
      level: 1,
    },
    { key: "net", label: t("net"), value: money(data.totals.net), kind: "result" },
  ];
  const actualLines: StatementLine[] = actual
    ? [
        { key: "actual", label: t("actualHeading"), kind: "heading" },
        { key: "gross2", label: t("gross", { year: label(year) }), value: money(data.totals.gross) },
        { key: "expenses", label: t("expenses"), value: money(data.totals.expenses), level: 1 },
        { key: "netActual", label: t("netActual"), value: money(data.totals.netActual), kind: "subtotal" },
      ]
    : [];

  return (
    <OwnerPage testId="income">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("documents"), href: ownerPath(locale, "/documents") }, { label: t("title") }]}
        actions={
          <FilterBar
            variant="toolbar"
            fields={[
              {
                name: "year",
                label: t("year"),
                type: "select",
                placeholder: label(current),
                options: years.slice(1).map((y) => ({ value: String(y), label: label(y) })),
              },
            ]}
          />
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <section
          aria-labelledby="income-statement"
          className="rounded-card border-border bg-surface shadow-card flex flex-col gap-5 border p-6 md:p-8"
          data-testid="income-totals"
        >
          <div className="flex flex-col gap-1">
            <span className="text-muted text-sm">{t("statementKicker")}</span>
            <h2 id="income-statement" className="text-xl font-semibold">
              {t("statementTitle", { year: label(year) })}
            </h2>
          </div>
          <Statement caption={t("statementTitle", { year: label(year) })} lines={lines} />
          {actual ? (
            <div data-testid="income-expenses">
              <Statement caption={t("actualHeading")} lines={actualLines} />
              <p className="text-muted mt-2 text-sm">{t("expensesHint")}</p>
            </div>
          ) : null}
          <p className="bg-bg-subtle text-muted rounded-control px-4 py-3 text-sm">
            <span className="text-fg font-medium">{t("noteTitle")}</span> {t("noteBody")}
          </p>
        </section>

        <aside className="rounded-card border-border bg-surface shadow-card flex flex-col gap-4 border p-5 lg:sticky lg:top-6">
          <h2 className="text-base font-semibold">{t("howTitle")}</h2>
          <ol className="flex flex-col gap-3">
            {(["one", "two", "three"] as const).map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span
                  aria-hidden="true"
                  className="border-border-strong grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="text-muted">{t(`how.${step}`)}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <section aria-labelledby="income-units-title" className="flex flex-col gap-3">
        <h2 id="income-units-title" className="text-lg font-semibold">
          {t("unitsTitle")}
        </h2>
        {data.units.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconChart}
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/documents")}>{t("empty.documents")}</a>
              </Button>
            }
          />
        ) : (
          <div data-testid="income-units">
            <SimpleTable
              caption={t("unitsTitle")}
              minWidth="52rem"
              stackOnPhones
              columns={[
                { key: "unit", header: t("col.unit"), phone: "title" },
                { key: "rent", header: t("rent"), align: "end", phone: "hidden" },
                { key: "retained", header: t("retained"), align: "end", phone: "hidden" },
                { key: "gross", header: t("unitGross"), align: "end", phone: "figure" },
                { key: "expenses", header: t("expenses"), phone: "meta" },
                { key: "pdf", header: <span className="sr-only">{t("col.pdf")}</span>, align: "end", phone: "status" },
              ]}
              rows={data.units.map((unit) => ({
                key: unit.unitId,
                testId: "income-unit",
                cells: {
                  unit: (
                    <span className="flex flex-col">
                      <span className="font-medium">{t("unit", { unit: unit.unitNo })}</span>
                      <span className="text-muted text-sm">{t("chargesShort", { amount: money(unit.charges) })}</span>
                    </span>
                  ),
                  rent: money(unit.rent),
                  retained: money(unit.retained),
                  gross: <span className="font-semibold">{money(unit.gross)}</span>,
                  expenses: unit.expenseItems.length ? (
                    <ul className="flex flex-col gap-0.5 text-sm" data-testid="income-unit-expenses">
                      {unit.expenseItems.map((item) => (
                        <li key={item.categoryKey} className="flex justify-between gap-3">
                          <span className="text-muted">{locale === "en" ? item.nameEn : item.nameTh}</span>
                          <span className="tabular-nums">{money(item.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
                  pdf: <IncomeSummaryButton year={year} unitId={unit.unitId} unitNo={unit.unitNo} />,
                },
              }))}
            />
          </div>
        )}
      </section>
    </OwnerPage>
  );
}
