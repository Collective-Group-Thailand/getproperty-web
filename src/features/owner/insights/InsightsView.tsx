import { getTranslations } from "next-intl/server";

import { formatDate, formatNumber, formatPeriodKey } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Chart } from "@/ui/charts/Chart";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Stat } from "@/ui/components/Stat";
import { IconChart } from "@/ui/icons/glyphs/chart";

import { enumParam, withQuery } from "@/features/shared/console/params";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { ReportsNav } from "../reports/ReportsNav";
import { ConsentSwitch } from "../settings/PrivacyActions";
import { ownerPath } from "../shared/links";
import { focusedBuilding, ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { formatMetric, LOWER_IS_BETTER, PRIMARY_SERIES } from "./metrics";

type SearchParams = Record<string, string | string[] | undefined>;
const MONTHS = ["6", "12", "24"] as const;
const BENCHMARK_CONSENT = "analytics.anonymised";

/**
 * Insights (B6.3, D-083, D-217 — `GET /v1/owner/insights`): the seven pilot KPIs over the last 90 days, the
 * monthly series of every measure (one building's when the switcher is focused) as server-drawn SVG charts —
 * no chart library and no client JavaScript (D-179) — and anonymised benchmarks (k ≥ 5 tenants per bucket)
 * once an Owner of the tenant opted in (consent `analytics.anonymised`). Nothing is computed here.
 */
export async function InsightsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.insights");
  const { api, locale, me } = context;
  const months = enumParam(searchParams.months, MONTHS) ?? "12";
  const building = focusedBuilding(context);
  const [tenant, insights] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/tenant"))),
    ownerCan(me, "report.read")
      ? section(
          unwrap(
            api.GET("/v1/owner/insights", { params: { query: { months: Number(months), building: building?.id } } }),
          ),
        )
      : Promise.resolve(null),
  ]);
  const vat = tenant.data?.vatRegistered ?? true;
  const base = ownerPath(locale, "/reports/insights");
  const header = (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ReportsNav context={context} current="/reports/insights" vatRegistered={vat} />
    </>
  );
  if (!insights) {
    return (
      <OwnerPage testId="insights">
        {header}
        <Card>
          <EmptyState title={t("noPermission")} />
        </Card>
      </OwnerPage>
    );
  }
  if (!insights.data) {
    return (
      <OwnerPage testId="insights">
        {header}
        <SectionError error={insights.error} />
      </OwnerPage>
    );
  }
  const data = insights.data;
  const units = {
    hours: (value: string) => t("unit.hours", { value }),
    score: (value: string) => t("unit.score", { value }),
    perM2: (value: string) => t("unit.perM2", { value }),
  };
  const kpi = (metric: Parameters<typeof formatMetric>[0], value: string | null) =>
    value === null ? t("noData") : formatMetric(metric, value, locale, units);
  const owner = me.roles.includes("owner") && !readOnly(me);
  const consents = !data.benchmarks.optedIn && owner ? await section(unwrap(api.GET("/v1/owner/consents"))) : null;
  const purpose = consents?.data?.find((candidate) => candidate.key === BENCHMARK_CONSENT) ?? null;
  const chart = (series: Schemas["InsightSeriesDto"]) => (
    <Card
      key={series.metric}
      as="section"
      aria-labelledby={`series-${series.metric}`}
      data-testid="insight-series"
      data-metric={series.metric}
    >
      <CardHeader
        title={<span id={`series-${series.metric}`}>{t(`metric.${series.metric}`)}</span>}
        description={LOWER_IS_BETTER.has(series.metric) ? t("lowerIsBetter") : t("higherIsBetter")}
      />
      <Chart
        type="line"
        height={180}
        points={series.points.map((point) => ({
          key: point.month,
          label: formatPeriodKey(point.month.slice(0, 7), locale),
          value: point.value,
        }))}
        title={t("seriesTitle", { metric: t(`metric.${series.metric}`) })}
        formatValue={(value) => formatMetric(series.metric, value, locale, units)}
        table={{ summary: t("seriesTable"), label: t("month"), value: t(`metric.${series.metric}`) }}
        emptyText={t("noSeries")}
      />
    </Card>
  );
  const primary = data.series.filter((series) => PRIMARY_SERIES.includes(series.metric));
  const more = data.series.filter((series) => !PRIMARY_SERIES.includes(series.metric));

  return (
    <OwnerPage testId="insights" wide>
      {header}
      <p className="text-muted text-sm" data-testid="insights-scope">
        {t("scope", {
          asOf: formatDate(data.asOf, locale),
          building: building?.name ?? t("allBuildings"),
        })}
      </p>

      <section aria-labelledby="insights-kpis" className="flex flex-col gap-3" data-testid="insights-kpis">
        <h2 id="insights-kpis" className="text-lg font-semibold">
          {t("kpisTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={t("metric.time_to_bill_hours")}
            value={kpi("time_to_bill_hours", data.current.timeToBillHours)}
          />
          <Stat
            label={t("metric.invoice_correction_rate_pct")}
            value={kpi("invoice_correction_rate_pct", data.current.invoiceCorrectionRatePct)}
          />
          <Stat
            label={t("metric.on_time_payment_pct")}
            value={kpi("on_time_payment_pct", data.current.onTimePaymentPct)}
          />
          <Stat
            label={t("metric.auto_reconciled_pct")}
            value={kpi("auto_reconciled_pct", data.current.autoReconciledPct)}
          />
          <Stat
            label={t("metric.loss_pct")}
            value={kpi("loss_pct", data.current.latestLossPct)}
            hint={data.current.lossIdentified ? t("lossIdentified") : t("lossNotIdentified")}
          />
          <Stat label={t("metric.meter_uptime_pct")} value={kpi("meter_uptime_pct", data.current.meterUptimePct)} />
          <Stat label={t("metric.csat")} value={kpi("csat", data.current.csat)} />
        </div>
      </section>

      <section aria-labelledby="insights-series" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="insights-series" className="text-lg font-semibold">
            {t("seriesHeading")}
          </h2>
          <LinkTabs
            label={t("monthsLabel")}
            current={withQuery(base, { months })}
            tabs={MONTHS.map((value) => ({
              href: withQuery(base, { months: value }),
              label: t("months", { count: Number(value) }),
              testId: `insights-months-${value}`,
            }))}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{primary.map(chart)}</div>
        {more.length ? (
          <details className="group" data-testid="insights-more">
            <summary className="text-primary cursor-pointer py-2 font-medium">
              {t("moreMeasures", { count: more.length })}
            </summary>
            <div className="mt-2 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{more.map(chart)}</div>
          </details>
        ) : null}
      </section>

      <Card
        as="section"
        aria-labelledby="insights-benchmarks"
        data-testid="insights-benchmarks"
        data-opted-in={data.benchmarks.optedIn}
      >
        <CardHeader
          title={<span id="insights-benchmarks">{t("benchmarks.title")}</span>}
          description={t("benchmarks.hint")}
        />
        {data.benchmarks.optedIn ? (
          data.benchmarks.items.length ? (
            <SimpleTable
              caption={t("benchmarks.title")}
              testId="benchmark-table"
              minWidth="44rem"
              columns={[
                { key: "metric", header: t("benchmarks.col.metric") },
                { key: "mine", header: t("benchmarks.col.mine"), align: "end" },
                { key: "p25", header: t("benchmarks.col.p25"), align: "end" },
                { key: "p50", header: t("benchmarks.col.p50"), align: "end" },
                { key: "p75", header: t("benchmarks.col.p75"), align: "end" },
                { key: "k", header: t("benchmarks.col.k"), align: "end" },
              ]}
              rows={data.benchmarks.items.map((item) => ({
                key: `${item.metric}-${item.bucketKey}`,
                testId: "benchmark-row",
                data: { metric: item.metric },
                cells: {
                  metric: (
                    <span className="flex flex-col">
                      <span className="font-medium">{t(`metric.${item.metric}`)}</span>
                      <span className="text-muted text-xs">
                        {t("benchmarks.bucket", { bucket: item.bucketKey, asOf: formatDate(item.asOf, locale) })}
                      </span>
                    </span>
                  ),
                  mine: <span className="font-semibold">{formatMetric(item.metric, item.mine, locale, units)}</span>,
                  p25: formatMetric(item.metric, item.p25, locale, units),
                  p50: formatMetric(item.metric, item.p50, locale, units),
                  p75: formatMetric(item.metric, item.p75, locale, units),
                  k: formatNumber(item.k, locale),
                },
              }))}
            />
          ) : (
            <p className="text-muted text-sm">{t("benchmarks.noBuckets")}</p>
          )
        ) : (
          <div className="flex flex-col gap-3" data-testid="benchmarks-opt-in">
            <p className="text-sm">{t("benchmarks.optInBody")}</p>
            {purpose ? (
              <ConsentSwitch purpose={purpose} language={locale} />
            ) : (
              <p className="text-muted text-sm">
                {owner ? t("benchmarks.consentMissing") : t("benchmarks.ownerOnly")}{" "}
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href={ownerPath(locale, "/settings/privacy")}
                >
                  {t("benchmarks.privacyLink")}
                </a>
              </p>
            )}
          </div>
        )}
      </Card>
      {data.series.length === 0 ? (
        <Card>
          <EmptyState icon={IconChart} title={t("noSeries")} />
        </Card>
      ) : null}
    </OwnerPage>
  );
}
