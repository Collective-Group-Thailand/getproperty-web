import { getTranslations } from "next-intl/server";

import { formatDate, formatNumber, formatPeriodKey } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Chart } from "@/ui/charts/Chart";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { FilterLinks } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconChart } from "@/ui/icons/glyphs/chart";
import { IconLock } from "@/ui/icons/glyphs/lock";

import { enumParam, withQuery } from "@/features/shared/console/params";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { PilotKpiView } from "@/features/shared/console/PilotKpiView";
import { SectionError } from "@/features/shared/console/SectionError";
import { ownerPilotKpis } from "../reports/server";
import { ConsentSwitch } from "../settings/PrivacyActions";
import { ownerPath } from "../shared/links";
import { focusedBuilding, ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { formatMetric, LOWER_IS_BETTER, PRIMARY_SERIES } from "./metrics";

type SearchParams = Record<string, string | string[] | undefined>;
const MONTHS = ["6", "12", "24"] as const;
const BENCHMARK_CONSENT = "analytics.anonymised";

/** The pilot KPI (D-083) each headline figure answers to: a KPI the API says is not met marks its figure. */
const PILOT_KPI: Record<string, Schemas["InsightMetric"]> = {
  time_to_bill: "time_to_bill_hours",
  invoice_correction_rate: "invoice_correction_rate_pct",
  on_time_payment: "on_time_payment_pct",
  auto_reconciled: "auto_reconciled_pct",
  loss_identified: "loss_pct",
  meter_uptime: "meter_uptime_pct",
  csat: "csat",
};

/**
 * Reports › Insights (B6.3, D-083, D-217 — `GET /v1/owner/insights`; redesign G6): the seven headline measures over the
 * last 90 days as one figures row (each with which way is better; the first one the pilot says is not met is marked),
 * the monthly trends as calm single-line charts with their tables (one building's when the switcher is focused), the
 * pilot KPIs against baseline and target (moved here from Exports), and anonymised benchmarks once an Owner opted in.
 * Nothing is computed here.
 */
export async function InsightsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.insights");
  const { api, locale, me } = context;
  const months = enumParam(searchParams.months, MONTHS) ?? "12";
  const window = enumParam(searchParams.window, ["30d", "90d"] as const) ?? "30d";
  const building = focusedBuilding(context);
  const allowed = ownerCan(me, "report.read");
  const [insights, kpis] = await Promise.all([
    allowed
      ? section(
          unwrap(
            api.GET("/v1/owner/insights", { params: { query: { months: Number(months), building: building?.id } } }),
          ),
        )
      : Promise.resolve(null),
    allowed ? section(ownerPilotKpis(api, window)) : Promise.resolve(null),
  ]);
  const base = ownerPath(locale, "/reports/insights");
  const header = <PageHeader title={t("title")} description={t("description")} />;
  if (!insights) {
    return (
      <OwnerPage testId="insights">
        {header}
        <EmptyState
          variant="card"
          icon={IconLock}
          title={t("noPermission")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/reports")}>{t("backToReports")}</a>
            </Button>
          }
        />
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
  const better = (metric: string) => (LOWER_IS_BETTER.has(metric) ? t("lowerIsBetter") : t("higherIsBetter"));
  const owner = me.roles.includes("owner") && !readOnly(me);
  const consents = !data.benchmarks.optedIn && owner ? await section(unwrap(api.GET("/v1/owner/consents"))) : null;
  const purpose = consents?.data?.find((candidate) => candidate.key === BENCHMARK_CONSENT) ?? null;
  const notMet = kpis?.data?.kpis.find((row) => row.met === false);
  const attention = notMet ? PILOT_KPI[notMet.kpi] : undefined;

  const headline: { metric: Schemas["InsightMetric"]; value: string | null; hint?: string }[] = [
    { metric: "time_to_bill_hours", value: data.current.timeToBillHours },
    { metric: "invoice_correction_rate_pct", value: data.current.invoiceCorrectionRatePct },
    { metric: "on_time_payment_pct", value: data.current.onTimePaymentPct },
    { metric: "auto_reconciled_pct", value: data.current.autoReconciledPct },
    {
      metric: "loss_pct",
      value: data.current.latestLossPct,
      hint: data.current.lossIdentified ? t("lossIdentified") : t("lossNotIdentified"),
    },
    { metric: "meter_uptime_pct", value: data.current.meterUptimePct },
    { metric: "csat", value: data.current.csat },
  ];

  const chart = (series: Schemas["InsightSeriesDto"]) => (
    <Card
      key={series.metric}
      as="section"
      aria-labelledby={`series-${series.metric}`}
      data-testid="insight-series"
      data-metric={series.metric}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`series-${series.metric}`} className="text-base font-semibold">
          {t(`metric.${series.metric}`)}
        </h3>
        <span className="text-muted text-sm">{better(series.metric)}</span>
      </div>
      <Chart
        type="line"
        height={200}
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
      <PageHeader
        title={t("title")}
        description={
          <span data-testid="insights-scope">
            {t("scope", { asOf: formatDate(data.asOf, locale), building: building?.name ?? t("allBuildings") })}
          </span>
        }
      />

      <section aria-labelledby="insights-kpis" className="flex flex-col gap-3" data-testid="insights-kpis">
        <h2 id="insights-kpis" className="text-lg font-semibold">
          {t("kpisTitle")}
        </h2>
        <StatsRow
          label={t("kpisTitle")}
          highlight={attention}
          figures={headline.map((figure) => ({
            key: figure.metric,
            label: t(`metric.${figure.metric}`),
            value: kpi(figure.metric, figure.value),
            hint: figure.hint ? `${figure.hint} · ${better(figure.metric)}` : better(figure.metric),
          }))}
          className="xl:grid-cols-7"
        />
      </section>

      <section aria-labelledby="insights-series" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="insights-series" className="text-lg font-semibold">
            {t("seriesHeading")}
          </h2>
          <FilterLinks
            label={t("monthsLabel")}
            current={months}
            links={MONTHS.map((value) => ({
              key: value,
              href: withQuery(base, { months: value, window: window === "30d" ? undefined : window }),
              label: t("months", { count: Number(value) }),
              testId: `insights-months-${value}`,
            }))}
          />
        </div>
        {data.series.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconChart}
            title={t("noSeries")}
            description={t("noSeriesHint")}
            action={
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/reports")}>{t("backToReports")}</a>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">{primary.map(chart)}</div>
        )}
        {more.length ? (
          <details className="group" data-testid="insights-more">
            <summary className="text-primary w-fit cursor-pointer py-2 font-medium">
              {t("moreMeasures", { count: more.length })}
            </summary>
            <div className="mt-2 grid gap-4 lg:grid-cols-2">{more.map(chart)}</div>
          </details>
        ) : null}
      </section>

      {kpis?.data ? (
        <section aria-labelledby="insights-pilot" className="flex flex-col gap-3" data-testid="insights-pilot">
          <div>
            <h2 id="insights-pilot" className="text-lg font-semibold">
              {t("pilotTitle")}
            </h2>
            <p className="text-muted text-sm">{t("pilotHint")}</p>
          </div>
          <PilotKpiView
            kpis={kpis.data}
            locale={locale}
            windowHref={(next) => withQuery(base, { months: months === "12" ? undefined : months, window: next })}
          />
        </section>
      ) : kpis && !(isApiError(kpis.error) && kpis.error.status === 404) ? (
        <SectionError error={kpis.error} />
      ) : null}

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
              minWidth="40rem"
              className="rounded-control shadow-none"
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
                      <span className="text-muted text-sm">
                        {t("benchmarks.asOf", { asOf: formatDate(item.asOf, locale) })}
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
            <p className="text-base">{t("benchmarks.optInBody")}</p>
            {purpose ? (
              <ConsentSwitch purpose={purpose} language={locale} />
            ) : (
              <p className="text-muted text-sm">
                {owner ? t("benchmarks.consentMissing") : t("benchmarks.ownerOnly")}{" "}
                <a
                  className="text-primary font-medium underline-offset-4 hover:underline"
                  href={ownerPath(locale, "/settings/privacy")}
                >
                  {t("benchmarks.privacyLink")}
                </a>
              </p>
            )}
          </div>
        )}
      </Card>
    </OwnerPage>
  );
}
