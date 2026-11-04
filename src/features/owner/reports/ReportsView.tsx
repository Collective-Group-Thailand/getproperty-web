import { getTranslations } from "next-intl/server";

import { EXPORT_JOB_STATUS } from "@/domain/status/exportJob";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatPeriodKey } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { Icon } from "@/ui/icons";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconLock } from "@/ui/icons/glyphs/lock";

import { ExportButton } from "../shared/ExportButton";
import { ownerPath } from "../shared/links";
import { billingPeriods, periodParam } from "../shared/periods";
import { focusedBuilding, ownerCan, param, section, type OwnerContext } from "../shared/server";

/** This month in Bangkok as `YYYY-MM`. */
function thisMonth(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 7);
}

/** The last day of a `YYYY-MM` month as `YYYY-MM-DD` (for the arrears "as of"). */
function monthEnd(period: string): string {
  const [year, month] = period.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

interface ExportCard {
  kind: Schemas["ExportKind"];
  group: "accounting" | "operations" | "tax";
  vatOnly?: boolean;
}

const EXPORTS: ExportCard[] = [
  { kind: "income_expense", group: "accounting" },
  { kind: "flowaccount_csv", group: "accounting" },
  { kind: "peak_csv", group: "accounting" },
  { kind: "invoices_xlsx", group: "operations" },
  { kind: "payments_xlsx", group: "operations" },
  { kind: "arrears_xlsx", group: "operations" },
  { kind: "readings_csv", group: "operations" },
  { kind: "document_archive_zip", group: "operations" },
  { kind: "vat_pp30", group: "tax", vatOnly: true },
  { kind: "etax_monthly_xlsx", group: "tax", vatOnly: true },
  { kind: "tax_annual_summary", group: "tax" },
];

/**
 * Reports › Exports (F2 2.6, D-050, D-051, D-202; redesign G6): the month in the toolbar (`PeriodPicker`), the exports
 * in three cards — accounting, operations, tax — each a row with one outlined "ส่งออก", built by the API in the
 * background and downloaded through this zone's BFF; the recent exports in a sticky column beside them. The pilot
 * KPIs moved to Insights.
 */
export async function ReportsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.reports");
  const { api, locale, me } = context;
  const current = thisMonth();
  const period = periodParam(param(searchParams.period)) ?? current;
  const building = focusedBuilding(context);
  const [tenant, history, periods] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/tenant"))),
    section(unwrap(api.GET("/v1/owner/exports", { params: { query: { perPage: 10 } } }))),
    billingPeriods(context, period, current),
  ]);
  const vat = tenant.data?.vatRegistered ?? false;
  const canExport = ownerCan(me, "export.create");
  const params = (kind: Schemas["ExportKind"]): Schemas["ExportParamsDto"] => ({
    ...(kind === "arrears_xlsx" ? { asOf: monthEnd(period) } : { period }),
    ...(building ? { buildingId: building.id } : {}),
  });

  const recent = (
    <section
      aria-labelledby="reports-history"
      className="rounded-card border-border bg-surface shadow-card flex flex-col border"
    >
      <header className="border-border border-b px-5 py-4">
        <h2 id="reports-history" className="text-base font-semibold">
          {t("history")}
        </h2>
      </header>
      {!history.data ? (
        <div className="p-5">
          <SectionError error={history.error} />
        </div>
      ) : history.data.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center" data-testid="export-history">
          <span className="border-border text-muted bg-bg grid size-10 place-items-center rounded-full border text-xl">
            <Icon icon={IconDownload} />
          </span>
          <p className="font-medium">{t("noHistory")}</p>
          <p className="text-muted text-sm">{t("noHistoryHint")}</p>
        </div>
      ) : (
        <ul className="divide-border divide-y" data-testid="export-history">
          {history.data.data.map((job) => (
            <li
              key={job.id}
              className="flex items-start justify-between gap-3 px-5 py-3"
              data-testid="export-row"
              data-kind={job.kind}
              data-status={job.status}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {t.has(`kind.${job.kind}.title`) ? t(`kind.${job.kind}.title` as never) : t("otherExport")}
                </span>
                <span className="text-muted text-sm tabular-nums">
                  {[
                    job.params.period ? formatPeriodKey(job.params.period, locale) : null,
                    formatDateTime(job.requestedAt, locale),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {job.status === "done" && job.download ? (
                <a
                  href={`/bff/exports/${job.id}/download`}
                  download
                  className="text-primary rounded-control focus-visible:ring-focus-ring inline-flex min-h-9 shrink-0 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  data-testid="history-download"
                >
                  <Icon icon={IconDownload} size={16} />
                  {t("download")}
                </a>
              ) : (
                <StatusBadgeOf map={EXPORT_JOB_STATUS} value={job.status} size="sm" />
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="border-border text-muted border-t px-5 py-3 text-sm">{t("historyHint")}</p>
    </section>
  );

  return (
    <OwnerPage testId="reports">
      <PageHeader title={t("title")} description={t("description")} />
      <ListToolbar
        tabs={
          <p className="text-muted text-sm" data-testid="period-label">
            {t("scope", { period: formatPeriodKey(period, locale), building: building?.name ?? t("allBuildings") })}
          </p>
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "period", label: t("period"), type: "period", periods, fallback: current }]}
          />
        }
      />

      {!canExport ? (
        <EmptyState
          variant="card"
          icon={IconLock}
          title={t("noPermission")}
          description={t("noPermissionHint")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/reports/insights")}>{t("openInsights")}</a>
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            {(["accounting", "operations", "tax"] as const).map((group) => {
              const cards = EXPORTS.filter((card) => card.group === group && (!card.vatOnly || vat));
              return (
                <section
                  key={group}
                  aria-labelledby={`reports-${group}`}
                  className="rounded-card border-border bg-surface shadow-card border"
                  data-testid={`reports-${group}`}
                >
                  <header className="border-border border-b px-5 py-4 md:px-6">
                    <h2 id={`reports-${group}`} className="text-lg font-semibold">
                      {t(`group.${group}`)}
                    </h2>
                    <p className="text-muted mt-0.5 text-sm">
                      {group === "tax" && !vat ? t("vatOnlyHint") : t(`groupHint.${group}`)}
                    </p>
                  </header>
                  <ul className="divide-border divide-y">
                    {cards.map((card) => (
                      <li
                        key={card.kind}
                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-6"
                        data-testid="export-card"
                        data-kind={card.kind}
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <h3 className="font-medium">{t(`kind.${card.kind}.title`)}</h3>
                          <p className="text-muted text-sm">{t(`kind.${card.kind}.body`)}</p>
                        </div>
                        <div className="shrink-0">
                          <ExportButton
                            kind={card.kind}
                            params={params(card.kind)}
                            label={t("export")}
                            size="sm"
                            testId={`export-${card.kind}`}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          <aside className="lg:sticky lg:top-6">{recent}</aside>
        </div>
      )}
    </OwnerPage>
  );
}
