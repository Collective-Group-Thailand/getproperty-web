import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconChart } from "@/ui/icons/glyphs/chart";

import { ownerPath } from "../shared/links";
import { type OwnerContext } from "../shared/server";
import { IncomeSummaryButton } from "./IncomeSummaryButton";

/**
 * Annual rental income (B7.5, D-253, section 40(5)): per unit the rent and charges received in the year, deposits
 * kept, the assessable income and — as an estimate — the flat-rate deduction the API's setting gives; each unit's PDF
 * summary for the owner's PND 90 / 94. Every amount is the API's; nothing is added up here.
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

  return (
    <OwnerPage testId="income">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("documents"), href: ownerPath(locale, "/documents") }, { label: t("title") }]}
      />
      <FilterBar
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
      <Card data-testid="income-totals">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-muted text-sm">{t("gross", { year: label(year) })}</dt>
            <dd className="text-2xl font-semibold tabular-nums" data-testid="income-gross">
              {money(data.totals.gross)}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-sm">{t("deduction", { percent: data.deductionPercent })}</dt>
            <dd className="text-lg font-medium tabular-nums">{money(data.totals.deduction)}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm">{t("net")}</dt>
            <dd className="text-lg font-medium tabular-nums">{money(data.totals.net)}</dd>
          </div>
        </dl>
      </Card>
      <Callout tone="info" title={t("noteTitle")}>
        {t("noteBody")}
      </Callout>
      {data.units.length === 0 ? (
        <Card>
          <EmptyState icon={IconChart} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2" data-testid="income-units">
          {data.units.map((unit) => (
            <li key={unit.unitId}>
              <Card className="flex h-full flex-col gap-3" data-testid="income-unit">
                <h2 className="font-semibold">{t("unit", { unit: unit.unitNo })}</h2>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-muted">{t("rent")}</dt>
                    <dd className="font-medium tabular-nums">{money(unit.rent)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("retained")}</dt>
                    <dd className="font-medium tabular-nums">{money(unit.retained)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t("unitGross")}</dt>
                    <dd className="font-semibold tabular-nums">{money(unit.gross)}</dd>
                  </div>
                </dl>
                <p className="text-muted text-sm">{t("charges", { amount: money(unit.charges) })}</p>
                <IncomeSummaryButton year={year} unitId={unit.unitId} unitNo={unit.unitNo} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </OwnerPage>
  );
}
