import { getTranslations } from "next-intl/server";

import { formatDate, formatDateTime, formatPercent, formatPeriodKey, formatTHB, formatUnits } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { Chart } from "@/ui/charts/Chart";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Statement } from "@/ui/components/Statement";
import { StatsRow } from "@/ui/components/StatsRow";
import { StatusText } from "@/ui/components/StatusText";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { IconLoss } from "@/ui/icons/glyphs/loss";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { PhotoThumb } from "../shared/PhotoThumb";
import { focusedBuilding, param, section, type OwnerContext } from "../shared/server";
import { ExportButton } from "../shared/ExportButton";
import { billingPeriods } from "../shared/periods";
import { RecomputeLoss, UtilityInvoiceButton } from "./LossActions";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The loss workspace (F2 2.5, D-032 / D-188): for one building, utility and cycle — the utility's own
 * invoice against what the units and common areas were billed, loss in units, THB and %, the trend
 * over cycles (chart with its data table), suspects with links to their unit or meter; the utility
 * invoices entered (by hand or from a photo read by the API) and a CSV of the report. All figures are
 * the API's.
 */
export async function LossView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.loss");
  const { api, locale } = context;
  const building =
    context.buildings.find((candidate) => candidate.id === param(searchParams.building)) ??
    focusedBuilding(context) ??
    context.buildings[0];
  const utility: Schemas["Utility"] = param(searchParams.utility) === "water" ? "water" : "electric";
  const cycleParam = param(searchParams.cycle);
  const cycle = cycleParam && /^\d{4}-\d{2}$/.test(cycleParam) ? cycleParam : undefined;
  if (!building) {
    return (
      <OwnerPage testId="loss">
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState
          variant="card"
          icon={IconLoss}
          title={t("noBuilding")}
          description={t("noBuildingBody")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/buildings")}>{t("goBuildings")}</a>
            </Button>
          }
        />
      </OwnerPage>
    );
  }
  const [loss, invoices, accounts, summary] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/buildings/{buildingId}/loss", {
          params: { path: { buildingId: building.id }, query: { utility, cycle } },
        }),
      ),
    ),
    unwrap(
      api.GET("/v1/owner/buildings/{buildingId}/utility-invoices", {
        params: { path: { buildingId: building.id }, query: { utility } },
      }),
    ).catch(() => [] as Schemas["UtilityInvoiceDto"][]),
    unwrap(
      api.GET("/v1/owner/buildings/{buildingId}/utility-accounts", { params: { path: { buildingId: building.id } } }),
    ).catch(() => [] as Schemas["UtilityAccountDto"][]),
    section(unwrap(api.GET("/v1/owner/loss/summary"))),
  ]);
  const periods = await billingPeriods(context, cycle, loss.data?.report.periodKey);
  const unit = utility === "electric" ? "kWh" : "m3";
  const qty = (value: string) => formatUnits(value, unit, locale);
  const tab = (value: Schemas["Utility"]) =>
    ownerPath(locale, withQuery("/loss", { building: param(searchParams.building), utility: value, cycle }));
  const noInvoice = isApiError(loss.error) && loss.error.code === "loss.no_invoice";
  const report = loss.data?.report;

  return (
    <OwnerPage testId="loss">
      <PageHeader
        title={t("title")}
        description={t("descriptionBuilding", { building: building.name })}
        actions={
          <UtilityInvoiceButton buildingId={building.id} utility={utility} accounts={accounts} variant="primary" />
        }
      />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("utilities")}
            current={utility}
            tabs={(["electric", "water"] as const).map((value) => ({
              key: value,
              href: tab(value),
              label: t(`utility.${value}`),
              testId: `loss-tab-${value}`,
            }))}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              ...(context.buildings.length > 1
                ? [
                    {
                      name: "building",
                      label: t("building"),
                      type: "select" as const,
                      placeholder: t("chooseBuilding"),
                      options: context.buildings.map((candidate) => ({ value: candidate.id, label: candidate.name })),
                    },
                  ]
                : []),
              {
                name: "cycle",
                label: t("cycle"),
                type: "period" as const,
                periods,
                fallback: report?.periodKey ?? periods[0],
              },
            ]}
          />
        }
        actions={
          report ? (
            <ExportButton
              kind="loss_report_csv"
              params={{ buildingId: building.id, utility, period: report.periodKey }}
              label={t("csv")}
              testId="loss-csv"
            />
          ) : undefined
        }
      />

      {report ? (
        <>
          <div data-testid="loss-report" data-period={report.periodKey}>
            <StatsRow
              label={t("figures")}
              highlight="pct"
              figures={[
                {
                  key: "pct",
                  label: t("lossPct"),
                  value: (
                    <span data-testid="loss-pct">
                      {report.lossPct !== null ? formatPercent(report.lossPct, locale) : "—"}
                    </span>
                  ),
                },
                {
                  key: "thb",
                  label: t("lossThb"),
                  value: <span data-testid="loss-thb">{formatTHB(report.lossThb, locale)}</span>,
                  hint: t(`priceBasis.${report.priceBasis}`),
                },
                { key: "units", label: t("lossUnits"), value: qty(report.lossUnits) },
                {
                  key: "invoice",
                  label: t("invoiceUnits"),
                  value: qty(report.invoiceUnits),
                  hint: t("period", {
                    start: formatDate(report.periodStart, locale),
                    end: formatDate(report.periodEnd, locale),
                  }),
                },
              ]}
            />
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <Card as="section" aria-labelledby="loss-breakdown" padding="lg">
                <CardHeader
                  title={
                    <span id="loss-breakdown">
                      {t("breakdown", { building: building.name, period: formatPeriodKey(report.periodKey, locale) })}
                    </span>
                  }
                />
                <Statement
                  caption={t("breakdownCaption")}
                  lines={[
                    { key: "invoice", label: t("invoiceUnits"), value: qty(report.invoiceUnits) },
                    { key: "units", label: t("lessUnitBilled"), level: 1, value: qty(report.unitBilledUnits) },
                    { key: "common", label: t("lessCommonArea"), level: 1, value: qty(report.commonAreaUnits) },
                    {
                      key: "loss",
                      label: t("lossUnits"),
                      kind: "result",
                      value: qty(report.lossUnits),
                    },
                  ]}
                />
                <div className="border-border text-muted mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
                  <p>
                    {t("footnote", {
                      source: t(`billedUnitsSource.${report.billedUnitsSource}`),
                      at: formatDateTime(report.computedAt, locale),
                    })}
                  </p>
                  <RecomputeLoss buildingId={building.id} cycle={report.periodKey} utility={utility} />
                </div>
              </Card>
              <Card as="section" aria-labelledby="loss-trend">
                <CardHeader title={<span id="loss-trend">{t("trend")}</span>} />
                <Chart
                  type="line"
                  points={(loss.data?.trend ?? []).map((point) => ({
                    key: point.periodEnd,
                    label: formatDate(point.periodEnd, locale, { style: "month" }),
                    value: point.lossPct,
                  }))}
                  title={t("trendTitle", { utility: t(`utility.${utility}`), building: building.name })}
                  formatValue={(value) => formatPercent(value, locale)}
                  table={{ summary: t("trendTable"), label: t("cycle"), value: t("lossPct") }}
                  emptyText={t("noTrend")}
                  data-testid="loss-chart"
                />
              </Card>
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <Card as="section" aria-labelledby="loss-suspects" data-testid="loss-suspects">
                <CardHeader title={<span id="loss-suspects">{t("suspects")}</span>} description={t("suspectsHint")} />
                {report.suspects.length ? (
                  <ul className="divide-border flex flex-col divide-y">
                    {report.suspects.map((suspect) => (
                      <li
                        key={suspect.id}
                        className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                        data-testid="suspect-row"
                        data-kind={suspect.kind}
                      >
                        <StatusText tone="warning" icon={IconWarning} size="md">
                          {t(`suspect.${suspect.kind}`)}
                        </StatusText>
                        <span className="text-muted text-sm">{t("score", { score: suspect.score })}</span>
                        <span className="flex flex-wrap gap-4 text-sm">
                          {suspect.unitId ? (
                            <a
                              className="text-primary font-medium underline-offset-4 hover:underline"
                              href={ownerPath(locale, `/units/${suspect.unitId}`)}
                              data-testid="suspect-unit"
                            >
                              {t("openUnit")}
                            </a>
                          ) : null}
                          {suspect.assetItemId ? (
                            <a
                              className="text-primary font-medium underline-offset-4 hover:underline"
                              href={ownerPath(
                                locale,
                                withQuery(`/meters/${suspect.assetItemId}`, { building: building.id }),
                              )}
                            >
                              {t("openMeter")}
                            </a>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted text-sm">{t("noSuspects")}</p>
                )}
              </Card>
              <UtilityInvoices invoices={invoices} qty={qty} t={t} locale={locale} />
            </div>
          </div>
        </>
      ) : (
        <>
          {noInvoice ? (
            <div data-testid="loss-no-invoice">
              <Callout tone="info" title={t("noInvoiceTitle")}>
                {t("noInvoiceBody")}
              </Callout>
            </div>
          ) : (
            <Callout tone="warning">{t("unavailable")}</Callout>
          )}
          <UtilityInvoices invoices={invoices} qty={qty} t={t} locale={locale} />
        </>
      )}

      {summary.data && summary.data.length ? (
        <section aria-labelledby="loss-summary" data-testid="loss-summary" className="flex flex-col gap-3">
          <h2 id="loss-summary" className="text-lg font-semibold">
            {t("summary")}
          </h2>
          <SimpleTable
            caption={t("summary")}
            stackOnPhones
            minWidth="44rem"
            columns={[
              { key: "name", header: t("summaryCol.building"), phone: "title" },
              { key: "pct", header: t("lossPct"), align: "end", phone: "figure" },
              { key: "thb", header: t("lossThb"), align: "end", phone: "meta" },
              { key: "suspects", header: t("suspects"), align: "end", phone: "meta" },
            ]}
            rows={summary.data.map((row) => ({
              key: `${row.buildingId}-${row.utility}`,
              href: ownerPath(locale, withQuery("/loss", { building: row.buildingId, utility: row.utility })),
              cells: {
                name: t("summaryRow", { building: row.buildingName, utility: t(`utility.${row.utility}`) }),
                pct: row.lossPct !== null ? formatPercent(row.lossPct, locale) : "—",
                thb: formatTHB(row.lossThb, locale),
                suspects: t("suspectCount", { count: row.suspects }),
              },
            }))}
          />
        </section>
      ) : null}
    </OwnerPage>
  );
}

/** The utility's own invoices entered for the building (by hand or read from their photo). */
function UtilityInvoices({
  invoices,
  qty,
  t,
  locale,
}: {
  invoices: Schemas["UtilityInvoiceDto"][];
  qty: (value: string) => string;
  t: Awaited<ReturnType<typeof getTranslations<"owner.loss">>>;
  locale: OwnerContext["locale"];
}) {
  return (
    <Card as="section" aria-labelledby="utility-invoices" data-testid="utility-invoices">
      <CardHeader title={<span id="utility-invoices">{t("invoices")}</span>} description={t("invoicesHint")} />
      {invoices.length ? (
        <ul className="divide-border flex flex-col divide-y">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              data-testid="utility-invoice-row"
            >
              {invoice.invoiceDocumentId ? (
                <PhotoThumb
                  fileId={invoice.invoiceDocumentId}
                  alt={t("invoicePhoto", { number: invoice.invoiceNo ?? "" })}
                  size="sm"
                />
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm">
                  {t("period", {
                    start: formatDate(invoice.periodStart, locale),
                    end: formatDate(invoice.periodEnd, locale),
                  })}
                </span>
                <span className="text-muted text-sm">
                  {invoice.invoiceNo ? <span className="font-mono">{invoice.invoiceNo}</span> : null}
                  {invoice.invoiceNo ? " · " : null}
                  {t(`source.${invoice.source}`)}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5 text-sm tabular-nums">
                <span className="font-medium">{formatTHB(invoice.amount, locale)}</span>
                <span className="text-muted">{qty(invoice.units)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">{t("noInvoices")}</p>
      )}
    </Card>
  );
}
