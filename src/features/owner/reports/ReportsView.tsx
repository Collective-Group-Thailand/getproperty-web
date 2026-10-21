import { getTranslations } from "next-intl/server";

import { EXPORT_JOB_STATUS } from "@/domain/status/exportJob";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { PilotKpiView } from "@/features/shared/console/PilotKpiView";
import { SectionError } from "@/features/shared/console/SectionError";
import { enumParam, withQuery } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatPeriodKey } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ExportButton } from "../shared/ExportButton";
import { ownerPath } from "../shared/links";
import { focusedBuilding, ownerCan, param, section, type OwnerContext } from "../shared/server";
import { ReportsNav } from "./ReportsNav";
import { ownerPilotKpis } from "./server";

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

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
 * Reports & exports (F2 2.6, D-050, D-051, D-202): the income/expense summary, VAT working figures for a
 * VAT-registered tenant (ภ.พ.30), FlowAccount / PEAK / Excel exports for the month picked — built by the
 * API in the background and downloaded through this zone's BFF — the exports already made, and the
 * tenant's insights (pilot KPIs) when the API serves them.
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
  const period = PERIOD.test(param(searchParams.period) ?? "") ? param(searchParams.period)! : thisMonth();
  const window = enumParam(searchParams.window, ["30d", "90d"] as const) ?? "30d";
  const building = focusedBuilding(context);
  const [tenant, history, kpis] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/tenant"))),
    section(unwrap(api.GET("/v1/owner/exports", { params: { query: { perPage: 10 } } }))),
    section(ownerPilotKpis(api, window)),
  ]);
  const vat = tenant.data?.vatRegistered ?? false;
  const canExport = ownerCan(me, "export.create");
  const params = (kind: Schemas["ExportKind"]): Schemas["ExportParamsDto"] => ({
    ...(kind === "arrears_xlsx" ? { asOf: monthEnd(period) } : { period }),
    ...(building ? { buildingId: building.id } : {}),
  });
  const base = ownerPath(locale, "/reports");

  return (
    <OwnerPage testId="reports">
      <PageHeader title={t("title")} description={t("description")} />
      <ReportsNav context={context} current="/reports" vatRegistered={vat} />
      <form method="get" className="flex flex-wrap items-end gap-3" data-testid="period-form">
        <label className="flex flex-col gap-1 text-sm">
          {t("period")}
          <Input
            name="period"
            type="month"
            inputSize="sm"
            defaultValue={period}
            className="w-44"
            data-testid="period"
          />
        </label>
        <input type="hidden" name="window" value={window} />
        <Button type="submit" size="sm" variant="secondary">
          {t("apply")}
        </Button>
        <p className="text-muted text-sm" data-testid="period-label">
          {t("scope", { period: formatPeriodKey(period, locale), building: building?.name ?? t("allBuildings") })}
        </p>
      </form>

      {!canExport ? (
        <Card>
          <EmptyState title={t("noPermission")} />
        </Card>
      ) : (
        (["accounting", "operations", "tax"] as const).map((group) => {
          const cards = EXPORTS.filter((card) => card.group === group && (!card.vatOnly || vat));
          return (
            <section
              key={group}
              aria-labelledby={`reports-${group}`}
              className="flex flex-col gap-3"
              data-testid={`reports-${group}`}
            >
              <h2 id={`reports-${group}`} className="text-lg font-semibold">
                {t(`group.${group}`)}
              </h2>
              {group === "tax" && !vat ? <p className="text-muted text-sm">{t("vatOnlyHint")}</p> : null}
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => (
                  <li
                    key={card.kind}
                    className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4"
                    data-testid="export-card"
                    data-kind={card.kind}
                  >
                    <div>
                      <h3 className="font-semibold">{t(`kind.${card.kind}.title`)}</h3>
                      <p className="text-muted text-sm">{t(`kind.${card.kind}.body`)}</p>
                    </div>
                    <ExportButton
                      kind={card.kind}
                      params={params(card.kind)}
                      label={t("export")}
                      testId={`export-${card.kind}`}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <Card as="section" aria-labelledby="reports-history">
        <CardHeader title={<span id="reports-history">{t("history")}</span>} description={t("historyHint")} />
        {!history.data ? (
          <SectionError error={history.error} />
        ) : history.data.data.length === 0 ? (
          <p className="text-muted text-sm">{t("noHistory")}</p>
        ) : (
          <SimpleTable
            caption={t("history")}
            testId="export-history"
            minWidth="40rem"
            columns={[
              { key: "kind", header: t("col.kind") },
              { key: "scope", header: t("col.scope") },
              { key: "requested", header: t("col.requested") },
              { key: "status", header: t("col.status") },
            ]}
            rows={history.data.data.map((job) => ({
              key: job.id,
              testId: "export-row",
              data: { kind: job.kind, status: job.status },
              cells: {
                kind: t.has(`kind.${job.kind}.title`) ? t(`kind.${job.kind}.title`) : job.kind,
                scope: job.params.period ? formatPeriodKey(job.params.period, locale) : (job.params.asOf ?? "—"),
                requested: formatDateTime(job.requestedAt, locale),
                status:
                  job.status === "done" && job.download ? (
                    <a
                      href={`/bff/exports/${job.id}/download`}
                      download
                      className="text-primary text-sm font-medium hover:underline"
                      data-testid="history-download"
                    >
                      {t("download")}
                    </a>
                  ) : (
                    <StatusBadgeOf map={EXPORT_JOB_STATUS} value={job.status} size="sm" />
                  ),
              },
            }))}
          />
        )}
      </Card>

      <section aria-labelledby="reports-insights" className="flex flex-col gap-3" data-testid="insights">
        <h2 id="reports-insights" className="text-lg font-semibold">
          {t("insights")}
        </h2>
        {kpis.data ? (
          <PilotKpiView
            kpis={kpis.data}
            locale={locale}
            windowHref={(next) => withQuery(base, { period, window: next })}
          />
        ) : isApiError(kpis.error) && kpis.error.status === 404 ? (
          <Card>
            <EmptyState title={t("noInsights")} description={t("noInsightsHint")} />
          </Card>
        ) : (
          <SectionError error={kpis.error} />
        )}
      </section>
    </OwnerPage>
  );
}
