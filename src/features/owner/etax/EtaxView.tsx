import { getTranslations } from "next-intl/server";

import { ETAX_STATUS, ETAX_VALUES } from "@/domain/status/etax";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Stat } from "@/ui/components/Stat";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { ReportsNav } from "../reports/ReportsNav";
import { ExportButton } from "../shared/ExportButton";
import { ownerPath } from "../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, section, type OwnerContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
export const SUBJECT_TYPES: Schemas["EtaxSubjectType"][] = ["receipt", "tax_invoice", "credit_note", "debit_note"];

/** This month in Bangkok as `YYYY-MM`. */
export function bangkokMonth(now = Date.now()): string {
  return new Date(now + 7 * 3_600_000).toISOString().slice(0, 7);
}

/**
 * e-Tax (B6.2, D-050, D-215 — VAT-registered tenants): the month's summary for the accountant (documents per
 * status, the signed totals and per ETDA type, the register as the `etax_monthly_xlsx` export) and the list of
 * documents sent to the tenant's e-Tax service provider, with what it refused. Every figure is the API's.
 */
export async function EtaxView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.etax");
  const states = await getTranslations("status.etax");
  const { api, locale, me } = context;
  const tenant = await section(unwrap(api.GET("/v1/owner/tenant")));
  const vat = tenant.data?.vatRegistered ?? false;
  const header = (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ReportsNav context={context} current="/reports/etax" vatRegistered={vat || !tenant.data} />
    </>
  );
  if (tenant.data && !vat) {
    return (
      <OwnerPage testId="etax">
        {header}
        <Card>
          <EmptyState icon={IconReceipt} title={t("notVat.title")} description={t("notVat.body")} />
        </Card>
      </OwnerPage>
    );
  }
  if (!ownerCan(me, "payment.read")) {
    return (
      <OwnerPage testId="etax">
        {header}
        <Card>
          <EmptyState title={t("noPermission")} />
        </Card>
      </OwnerPage>
    );
  }

  const monthParam = param(searchParams.month);
  const month = monthParam && PERIOD.test(monthParam) ? monthParam : bangkokMonth();
  const statusParam = param(searchParams.status);
  const typeParam = param(searchParams.subjectType);
  const [summary, list] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/etax/summary", { params: { query: { month } } }))),
    unwrap(
      api.GET("/v1/owner/etax/submissions", {
        params: {
          query: {
            month,
            status: ETAX_VALUES.includes(statusParam as Schemas["EtaxStatus"])
              ? (statusParam as Schemas["EtaxStatus"])
              : undefined,
            subjectType: SUBJECT_TYPES.includes(typeParam as Schemas["EtaxSubjectType"])
              ? (typeParam as Schemas["EtaxSubjectType"])
              : undefined,
            q: param(searchParams.q),
            page: pageParam(searchParams.page),
            perPage: 25,
          },
        },
      }),
    ),
  ]);
  const building = focusedBuilding(context);
  const s = summary.data;

  return (
    <OwnerPage testId="etax" wide>
      {header}
      <Card as="section" aria-labelledby="etax-summary" data-testid="etax-summary">
        <CardHeader
          title={<span id="etax-summary">{t("summary.title", { month: formatPeriodKey(month, locale) })}</span>}
          description={
            s ? (s.enabled ? t("summary.enabled", { provider: s.provider ?? "—" }) : t("summary.disabled")) : undefined
          }
          action={
            ownerCan(me, "export.create") ? (
              <ExportButton
                kind="etax_monthly_xlsx"
                params={{ period: month, ...(building ? { buildingId: building.id } : {}) }}
                label={t("summary.register")}
                testId="etax-register"
              />
            ) : null
          }
        />
        {!s ? (
          <SectionError error={summary.error} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="etax-counts">
              {ETAX_VALUES.map((status) => (
                <div key={status} data-testid={`etax-count-${status}`} data-count={s.counts[status]}>
                  <Stat label={states(status)} value={formatNumber(s.counts[status], locale)} />
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3" data-testid="etax-signed">
              <Stat
                label={t("summary.subtotal")}
                value={formatTHB(s.signed.subtotal, locale)}
                hint={t("summary.documents", { count: s.signed.documents })}
              />
              <Stat label={t("summary.vat")} value={formatTHB(s.signed.vatAmount, locale)} />
              <Stat label={t("summary.total")} value={formatTHB(s.signed.total, locale)} />
            </div>
            {s.byType.length ? (
              <SimpleTable
                caption={t("summary.byType")}
                testId="etax-by-type"
                minWidth="24rem"
                columns={[
                  { key: "type", header: t("col.type") },
                  { key: "documents", header: t("col.documents"), align: "end" },
                  { key: "total", header: t("col.total"), align: "end" },
                ]}
                rows={s.byType.map((row) => ({
                  key: row.typeCode,
                  cells: {
                    type: t.has(`typeCode.${row.typeCode}` as never)
                      ? t(`typeCode.${row.typeCode}` as never)
                      : row.typeCode,
                    documents: formatNumber(row.documents, locale),
                    total: formatTHB(row.total, locale),
                  },
                }))}
              />
            ) : null}
          </div>
        )}
      </Card>

      <FilterBar
        fields={[
          { name: "month", label: t("filter.month"), type: "month" },
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
          {
            name: "status",
            label: t("filter.status"),
            type: "select",
            placeholder: t("filter.allStatuses"),
            options: ETAX_VALUES.map((value) => ({ value, label: states(value) })),
          },
          {
            name: "subjectType",
            label: t("filter.type"),
            type: "select",
            placeholder: t("filter.allTypes"),
            options: SUBJECT_TYPES.map((value) => ({ value, label: t(`subject.${value}`) })),
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconReceipt} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("listCaption")}
          testId="etax-list"
          minWidth="48rem"
          columns={[
            { key: "number", header: t("col.number") },
            { key: "type", header: t("col.type") },
            { key: "issued", header: t("col.issued") },
            { key: "total", header: t("col.total"), align: "end" },
            { key: "status", header: t("col.status") },
          ]}
          rows={list.data.map((row) => ({
            key: row.id,
            testId: "etax-row",
            tone: row.status === "rejected" || row.status === "failed" ? "warning" : "default",
            data: { id: row.id, status: row.status },
            cells: {
              number: (
                <a
                  className="font-mono font-medium underline-offset-4 hover:underline"
                  href={ownerPath(locale, `/reports/etax/${row.id}`)}
                >
                  {row.number}
                </a>
              ),
              type: `${t(`subject.${row.subjectType}`)} · ${row.documentTypeCode}`,
              issued: formatDateTime(row.issuedAt, locale),
              total: formatTHB(row.total, locale),
              status: (
                <span className="flex flex-col gap-1">
                  <StatusBadgeOf map={ETAX_STATUS} value={row.status} size="sm" />
                  {row.error ? <span className="text-muted line-clamp-2 text-xs">{row.error}</span> : null}
                </span>
              ),
            },
          }))}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/reports/etax")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
