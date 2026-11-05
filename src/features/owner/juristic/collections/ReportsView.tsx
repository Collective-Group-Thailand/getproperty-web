import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate, formatNumber, formatPercent, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { AgingStrip } from "@/ui/components/AgingStrip";
import { Card, CardHeader } from "@/ui/components/Card";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";

import { ownerPath, withQuery } from "../../shared/links";
import { param, section, type OwnerContext } from "../../shared/server";
import { agingTiles } from "./aging";

/** A thin bar for a percentage the API computed (drawing only; the figure beside it is the API's own string). */
function RateBar({ pct }: { pct: string | null }) {
  // The API's own percentage string goes straight into CSS (clamped there): nothing is computed here.
  const width = pct !== null && /^\d{1,3}(\.\d+)?$/.test(pct) ? `min(100%, ${pct}%)` : "0%";
  return (
    <span aria-hidden="true" className="bg-bg-subtle rounded-thumb block h-1.5 w-24 overflow-hidden">
      <span className="bg-primary rounded-thumb block h-full" style={{ width }} />
    </span>
  );
}

/**
 * Collection reports (JW1b, J1.2b §4): the KPI — collected within the configured days of each due date — and the
 * collection rate per billing cycle, then the aging overall and per building. Every figure and percentage is the
 * API's; bars only draw what the API said.
 */
export async function ReportsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.collections.reports");
  const { api, locale } = context;
  const buildingId = param(searchParams.building);
  const scope = buildingId ? { buildingId } : {};
  const [aging, rate] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/juristic/reports/aging", { params: { query: scope } }))),
    section(unwrap(api.GET("/v1/owner/juristic/reports/collection-rate", { params: { query: scope } }))),
  ]);
  const base = ownerPath(locale, "/juristic/reports");
  const money = (value: string) => formatTHB(value, locale);
  const pct = (value: string | null) => (value === null ? "—" : formatPercent(value, locale));
  const n = (value: number) => formatNumber(value, locale);
  const propertyName = (id: string) => context.properties.find((property) => property.id === id)?.name ?? "—";
  const tiles = aging.data
    ? agingTiles(aging.data.overall.buckets, {
        range: (from, to) => t("range", { from: n(from), to: n(to) }),
        over: (from) => t("over", { days: n(from) }),
        accounts: (value) => t("accounts", { count: value }),
        money,
        oldest: t("oldest"),
        href: () => withQuery(ownerPath(locale, "/juristic/receivables"), { sort: "age", order: "desc" }),
      })
    : [];
  const bucketHeader = (index: number) => {
    const bucket = aging.data?.overall.buckets[index];
    if (!bucket) return "";
    return bucket.toDays === null
      ? t("over", { days: n(bucket.fromDays) })
      : t("range", { from: n(Math.max(1, bucket.fromDays)), to: n(bucket.toDays) });
  };

  return (
    <OwnerPage testId="juristic-reports">
      <PageHeader title={t("title")} description={t("lede")} />
      {context.buildings.length > 1 ? (
        <LinkTabs
          label={t("building")}
          current={withQuery(base, { building: buildingId })}
          tabs={[
            { href: base, label: t("allBuildings") },
            ...context.buildings.map((building) => ({
              href: withQuery(base, { building: building.id }),
              label: building.name,
            })),
          ]}
        />
      ) : null}

      {rate.data ? (
        <>
          <StatsRow
            label={t("kpiLabel")}
            highlight="within"
            figures={[
              {
                key: "within",
                label: t("within", { days: n(rate.data.kpiDays) }),
                value: pct(rate.data.total.withinDaysRatePct),
                hint: t("withinHint"),
                testId: "report-kpi",
              },
              { key: "rate", label: t("rate"), value: pct(rate.data.total.collectionRatePct), hint: t("rateHint") },
              {
                key: "billed",
                label: t("billed"),
                value: money(rate.data.total.billed),
                hint: t("range2", {
                  from: formatDate(rate.data.from, locale, { style: "month" }),
                  to: formatDate(rate.data.to, locale, { style: "month" }),
                }),
              },
              { key: "collected", label: t("collected"), value: money(rate.data.total.collected) },
            ]}
          />
          <Card as="section" aria-labelledby="cycles-title" className="flex flex-col gap-4">
            <CardHeader title={<span id="cycles-title">{t("cycles")}</span>} description={t("cyclesHint")} />
            {rate.data.cycles.length === 0 ? (
              <p className="text-muted m-0 text-sm">{t("noCycles")}</p>
            ) : (
              <SimpleTable
                caption={t("cycles")}
                testId="report-cycles"
                stackOnPhones
                minWidth="54rem"
                columns={[
                  { key: "period", header: t("col.period"), phone: "title" },
                  { key: "property", header: t("col.property") },
                  { key: "invoices", header: t("col.invoices"), align: "end" },
                  { key: "billed", header: t("col.billed"), align: "end" },
                  { key: "collected", header: t("col.collected"), align: "end", phone: "figure" },
                  { key: "rate", header: t("col.rate"), align: "end" },
                  { key: "within", header: t("within", { days: n(rate.data.kpiDays) }), align: "end", phone: "status" },
                ]}
                rows={rate.data.cycles.map((cycle) => ({
                  key: cycle.billingCycleId,
                  cells: {
                    period: formatPeriodKey(cycle.periodKey, locale),
                    property: propertyName(cycle.propertyId),
                    invoices: n(cycle.invoices),
                    billed: money(cycle.billed),
                    collected: money(cycle.collected),
                    rate: pct(cycle.collectionRatePct),
                    within: (
                      <span className="inline-flex items-center justify-end gap-3">
                        <RateBar pct={cycle.withinDaysRatePct} />
                        <span className="w-16 text-end tabular-nums">{pct(cycle.withinDaysRatePct)}</span>
                      </span>
                    ),
                  },
                }))}
                footer={{
                  period: t("total"),
                  billed: money(rate.data.total.billed),
                  collected: money(rate.data.total.collected),
                  rate: pct(rate.data.total.collectionRatePct),
                  within: pct(rate.data.total.withinDaysRatePct),
                }}
              />
            )}
          </Card>
        </>
      ) : (
        <SectionError error={rate.error} />
      )}

      {aging.data ? (
        <section aria-labelledby="aging-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="aging-title" className="text-lg font-semibold">
              {t("aging")}
            </h2>
            <p className="text-muted m-0 text-sm">{t("asOf", { date: formatDate(aging.data.asOf, locale) })}</p>
          </div>
          <AgingStrip label={t("aging")} tiles={tiles} />
          {aging.data.buildings.length ? (
            <SimpleTable
              caption={t("byBuilding")}
              testId="report-aging-buildings"
              minWidth="56rem"
              columns={[
                { key: "name", header: t("col.building") },
                ...aging.data.overall.buckets.map((bucket, index) => ({
                  key: bucket.key,
                  header: bucketHeader(index),
                  align: "end" as const,
                })),
                { key: "overdue", header: t("col.overdue"), align: "end" as const },
                { key: "notDue", header: t("col.notDue"), align: "end" as const },
              ]}
              rows={aging.data.buildings.map((building) => ({
                key: building.buildingId,
                cells: {
                  name: building.name,
                  ...Object.fromEntries(
                    building.buckets.map((bucket) => [
                      bucket.key,
                      bucket.accounts === 0 ? (
                        <span key={bucket.key} className="text-muted">
                          —
                        </span>
                      ) : (
                        <span key={bucket.key} className="flex flex-col items-end">
                          <span className="tabular-nums">{money(bucket.amount)}</span>
                          <span className="text-muted text-sm">{t("accounts", { count: bucket.accounts })}</span>
                        </span>
                      ),
                    ]),
                  ),
                  overdue: <span className="font-semibold tabular-nums">{money(building.overdue.amount)}</span>,
                  notDue: money(building.notDue.amount),
                },
              }))}
              footer={{
                name: t("total"),
                ...Object.fromEntries(aging.data.overall.buckets.map((bucket) => [bucket.key, money(bucket.amount)])),
                overdue: money(aging.data.overall.overdue.amount),
                notDue: money(aging.data.overall.notDue.amount),
              }}
            />
          ) : null}
        </section>
      ) : (
        <SectionError error={aging.error} />
      )}
    </OwnerPage>
  );
}
