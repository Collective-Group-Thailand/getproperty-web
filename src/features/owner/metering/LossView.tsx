import { getTranslations } from "next-intl/server";

import { formatDate, formatDateTime, formatPercent, formatPeriodKey, formatTHB, formatUnits } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { Chart } from "@/ui/charts/Chart";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { Stat } from "@/ui/components/Stat";
import { IconLoss } from "@/ui/icons/glyphs/loss";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { PhotoThumb } from "../shared/PhotoThumb";
import { focusedBuilding, param, section, type OwnerContext } from "../shared/server";
import { ExportButton } from "../shared/ExportButton";
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
  const header = <PageHeader title={t("title")} description={t("description")} />;
  if (!building) {
    return (
      <OwnerPage testId="loss">
        {header}
        <Card>
          <EmptyState icon={IconLoss} title={t("noBuilding")} />
        </Card>
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
  const unit = utility === "electric" ? "kWh" : "m3";
  const qty = (value: string) => formatUnits(value, unit, locale);
  const tab = (value: Schemas["Utility"]) =>
    ownerPath(locale, withQuery("/loss", { building: param(searchParams.building), utility: value, cycle }));
  const noInvoice = isApiError(loss.error) && loss.error.code === "loss.no_invoice";
  const report = loss.data?.report;

  return (
    <OwnerPage testId="loss">
      {header}
      <LinkTabs
        label={t("utilities")}
        current={tab(utility)}
        tabs={(["electric", "water"] as const).map((value) => ({
          href: tab(value),
          label: t(`utility.${value}`),
          testId: `loss-tab-${value}`,
        }))}
      />
      <FilterBar
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
          { name: "cycle", label: t("cycle"), type: "month" as const },
        ]}
      />

      {report ? (
        <>
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            data-testid="loss-report"
            data-period={report.periodKey}
          >
            <Stat
              label={t("lossPct")}
              value={
                <span data-testid="loss-pct">
                  {report.lossPct !== null ? formatPercent(report.lossPct, locale) : "—"}
                </span>
              }
            />
            <Stat
              label={t("lossThb")}
              value={<span data-testid="loss-thb">{formatTHB(report.lossThb, locale)}</span>}
              hint={t(`priceBasis.${report.priceBasis}`)}
            />
            <Stat label={t("lossUnits")} value={qty(report.lossUnits)} />
            <Stat
              label={t("invoiceUnits")}
              value={qty(report.invoiceUnits)}
              hint={t("period", {
                start: formatDate(report.periodStart, locale),
                end: formatDate(report.periodEnd, locale),
              })}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card as="section" aria-labelledby="loss-breakdown">
              <CardHeader
                title={
                  <span id="loss-breakdown">
                    {t("breakdown", { building: building.name, period: formatPeriodKey(report.periodKey, locale) })}
                  </span>
                }
                action={<RecomputeLoss buildingId={building.id} cycle={report.periodKey} utility={utility} />}
              />
              <DescriptionList
                columns={1}
                items={[
                  { id: "invoice", term: t("invoiceUnits"), description: qty(report.invoiceUnits) },
                  { id: "units", term: t("unitBilledUnits"), description: qty(report.unitBilledUnits) },
                  { id: "common", term: t("commonAreaUnits"), description: qty(report.commonAreaUnits) },
                  { id: "loss", term: t("lossUnits"), description: qty(report.lossUnits) },
                  {
                    id: "source",
                    term: t("billedSource"),
                    description: t(`billedUnitsSource.${report.billedUnitsSource}`),
                  },
                  { id: "computed", term: t("computedAt"), description: formatDateTime(report.computedAt, locale) },
                ]}
              />
              <div className="mt-4">
                <ExportButton
                  kind="loss_report_csv"
                  params={{ buildingId: building.id, utility, period: report.periodKey }}
                  label={t("csv")}
                  testId="loss-csv"
                />
              </div>
            </Card>
            <Card as="section" aria-labelledby="loss-trend">
              <CardHeader title={<span id="loss-trend">{t("trend")}</span>} />
              <Chart
                type="bar"
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
          <Card as="section" aria-labelledby="loss-suspects" data-testid="loss-suspects">
            <CardHeader title={<span id="loss-suspects">{t("suspects")}</span>} description={t("suspectsHint")} />
            {report.suspects.length ? (
              <ul className="divide-border flex flex-col divide-y">
                {report.suspects.map((suspect) => (
                  <li
                    key={suspect.id}
                    className="flex flex-wrap items-center gap-3 py-2 text-sm"
                    data-testid="suspect-row"
                    data-kind={suspect.kind}
                  >
                    <Badge tone="warning" size="sm">
                      {t(`suspect.${suspect.kind}`)}
                    </Badge>
                    <span className="text-muted">{t("score", { score: suspect.score })}</span>
                    {suspect.unitId ? (
                      <a
                        className="underline-offset-4 hover:underline"
                        href={ownerPath(locale, `/units/${suspect.unitId}`)}
                        data-testid="suspect-unit"
                      >
                        {t("openUnit")}
                      </a>
                    ) : null}
                    {suspect.assetItemId ? (
                      <a
                        className="underline-offset-4 hover:underline"
                        href={ownerPath(locale, withQuery(`/meters/${suspect.assetItemId}`, { building: building.id }))}
                      >
                        {t("openMeter")}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">{t("noSuspects")}</p>
            )}
          </Card>
        </>
      ) : noInvoice ? (
        <div data-testid="loss-no-invoice">
          <Callout tone="info" title={t("noInvoiceTitle")}>
            {t("noInvoiceBody")}
          </Callout>
        </div>
      ) : (
        <Callout tone="warning">{t("unavailable")}</Callout>
      )}

      <Card as="section" aria-labelledby="utility-invoices" data-testid="utility-invoices">
        <CardHeader
          title={<span id="utility-invoices">{t("invoices")}</span>}
          description={t("invoicesHint")}
          action={<UtilityInvoiceButton buildingId={building.id} utility={utility} accounts={accounts} />}
        />
        {invoices.length ? (
          <ul className="divide-border flex flex-col divide-y text-sm">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center gap-3 py-2" data-testid="utility-invoice-row">
                <span className="w-48">
                  {t("period", {
                    start: formatDate(invoice.periodStart, locale),
                    end: formatDate(invoice.periodEnd, locale),
                  })}
                </span>
                <span className="font-mono">{invoice.invoiceNo ?? "—"}</span>
                <span className="flex-1 tabular-nums">{qty(invoice.units)}</span>
                <span className="tabular-nums">{formatTHB(invoice.amount, locale)}</span>
                <Badge size="sm">{t(`source.${invoice.source}`)}</Badge>
                {invoice.invoiceDocumentId ? (
                  <PhotoThumb
                    fileId={invoice.invoiceDocumentId}
                    alt={t("invoicePhoto", { number: invoice.invoiceNo ?? "" })}
                    size="sm"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{t("noInvoices")}</p>
        )}
      </Card>

      {summary.data && summary.data.length ? (
        <Card as="section" aria-labelledby="loss-summary" data-testid="loss-summary">
          <CardHeader title={<span id="loss-summary">{t("summary")}</span>} />
          <ul className="divide-border flex flex-col divide-y text-sm">
            {summary.data.map((row) => (
              <li key={`${row.buildingId}-${row.utility}`} className="flex flex-wrap items-center gap-3 py-2">
                <a
                  className="flex-1 underline-offset-4 hover:underline"
                  href={ownerPath(locale, withQuery("/loss", { building: row.buildingId, utility: row.utility }))}
                >
                  {t("summaryRow", { building: row.buildingName, utility: t(`utility.${row.utility}`) })}
                </a>
                <span className="tabular-nums">{row.lossPct !== null ? formatPercent(row.lossPct, locale) : "—"}</span>
                <span className="tabular-nums">{formatTHB(row.lossThb, locale)}</span>
                <span className="text-muted">{t("suspectCount", { count: row.suspects })}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </OwnerPage>
  );
}
