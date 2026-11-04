import { getTranslations } from "next-intl/server";

import { ETAX_STATUS, ETAX_VALUES } from "@/domain/status/etax";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { StatusText } from "@/ui/components/StatusText";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { withQuery } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { ExportButton } from "../shared/ExportButton";
import { ownerPath } from "../shared/links";
import { billingPeriods, periodParam } from "../shared/periods";
import { focusedBuilding, ownerCan, pageParam, param, section, type OwnerContext } from "../shared/server";
import { viewCounts } from "../shared/views";

type SearchParams = Record<string, string | string[] | undefined>;
export const SUBJECT_TYPES: Schemas["EtaxSubjectType"][] = ["receipt", "tax_invoice", "credit_note", "debit_note"];
const VIEWS = ["all", ...ETAX_VALUES] as const;
type View = (typeof VIEWS)[number];

/** This month in Bangkok as `YYYY-MM`. */
export function bangkokMonth(now = Date.now()): string {
  return new Date(now + 7 * 3_600_000).toISOString().slice(0, 7);
}

/**
 * Reports › e-Tax (B6.2, D-050, D-215 — VAT-registered tenants; redesign G6): the month's documents per status as one
 * figures row (the refused ones highlighted — they need fixing and sending again), the signed totals on a quiet line,
 * then one toolbar — status views with the API's counts, the month, a search and the document type — over the list
 * of documents; each row opens its record. Every figure is the API's.
 */
export async function EtaxView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.etax");
  const states = await getTranslations("status.etax");
  const providers = await getTranslations("glossary.etaxProvider");
  const { api, locale, me } = context;
  const tenant = await section(unwrap(api.GET("/v1/owner/tenant")));
  const vat = tenant.data?.vatRegistered ?? false;
  const header = <PageHeader title={t("title")} description={t("description")} />;
  if (tenant.data && !vat) {
    return (
      <OwnerPage testId="etax">
        {header}
        <EmptyState
          variant="card"
          icon={IconReceipt}
          title={t("notVat.title")}
          description={t("notVat.body")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/settings?section=general")}>{t("notVat.action")}</a>
            </Button>
          }
        />
      </OwnerPage>
    );
  }
  if (!ownerCan(me, "payment.read")) {
    return (
      <OwnerPage testId="etax">
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

  const current = bangkokMonth();
  const month = periodParam(param(searchParams.month)) ?? current;
  const statusParam = param(searchParams.status);
  const status = ETAX_VALUES.includes(statusParam as Schemas["EtaxStatus"])
    ? (statusParam as Schemas["EtaxStatus"])
    : undefined;
  const typeParam = param(searchParams.subjectType);
  const subjectType = SUBJECT_TYPES.includes(typeParam as Schemas["EtaxSubjectType"])
    ? (typeParam as Schemas["EtaxSubjectType"])
    : undefined;
  const q = param(searchParams.q);
  const query = { month, subjectType, q };
  const list = (view: View, extra: { page?: number; perPage: number }) =>
    unwrap(
      api.GET("/v1/owner/etax/submissions", {
        params: { query: { ...query, status: view === "all" ? undefined : view, ...extra } },
      }),
    );
  const [summary, rows, counts, periods] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/etax/summary", { params: { query: { month } } }))),
    list(status ?? "all", { page: pageParam(searchParams.page), perPage: 25 }),
    viewCounts(VIEWS, (view) => list(view, { perPage: 1 })),
    billingPeriods(context, month, current),
  ]);
  const building = focusedBuilding(context);
  const s = summary.data;
  const base = ownerPath(locale, "/reports/etax");
  const keep = { month: month === current ? undefined : month, subjectType, q };
  const filtered = Boolean(status || subjectType || q);
  const typeName = (code: string) => (t.has(`typeCode.${code}` as never) ? t(`typeCode.${code}` as never) : null);

  return (
    <OwnerPage testId="etax" wide>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
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
        <section aria-labelledby="etax-summary" className="flex flex-col gap-3" data-testid="etax-summary">
          <h2 id="etax-summary" className="sr-only">
            {t("summary.title", { month: formatPeriodKey(month, locale) })}
          </h2>
          <div data-testid="etax-counts">
            <StatsRow
              label={t("summary.title", { month: formatPeriodKey(month, locale) })}
              highlight={s.counts.rejected > 0 ? "rejected" : s.counts.failed > 0 ? "failed" : undefined}
              figures={ETAX_VALUES.map((value) => ({
                key: value,
                label: states(value),
                value: (
                  <span data-testid={`etax-count-${value}`} data-count={s.counts[value]}>
                    {formatNumber(s.counts[value], locale)}
                  </span>
                ),
                hint:
                  (value === "rejected" || value === "failed") && s.counts[value] > 0
                    ? t("summary.fixHint")
                    : undefined,
                href: withQuery(base, { ...keep, status: value }),
              }))}
            />
          </div>
          <div
            className="text-muted flex flex-col gap-x-6 gap-y-1 px-1 text-sm sm:flex-row sm:flex-wrap sm:items-baseline"
            data-testid="etax-signed"
          >
            <span>{t("summary.signedLine", { count: s.signed.documents })}</span>
            <span className="tabular-nums">
              {t("summary.subtotalShort")}{" "}
              <span className="text-fg font-medium">{formatTHB(s.signed.subtotal, locale)}</span>
            </span>
            <span className="tabular-nums">
              {t("summary.vat")} <span className="text-fg font-medium">{formatTHB(s.signed.vatAmount, locale)}</span>
            </span>
            <span className="tabular-nums">
              {t("summary.total")} <span className="text-fg font-medium">{formatTHB(s.signed.total, locale)}</span>
            </span>
            <span>
              {s.enabled
                ? t("summary.enabled", {
                    provider: s.provider && providers.has(s.provider) ? providers(s.provider) : providers("other"),
                  })
                : t("summary.disabled")}
            </span>
          </div>
          {s.byType.length ? (
            <details className="px-1" data-testid="etax-by-type">
              <summary className="text-primary cursor-pointer text-sm font-medium">{t("summary.byType")}</summary>
              <ul className="text-muted mt-2 flex flex-col gap-1 text-sm">
                {s.byType.map((row) => (
                  <li key={row.typeCode} className="flex max-w-md justify-between gap-6 tabular-nums">
                    <span>{typeName(row.typeCode) ?? t("typeOther")}</span>
                    <span>
                      {t("summary.documents", { count: row.documents })} ·{" "}
                      <span className="text-fg">{formatTHB(row.total, locale)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      )}

      <ListToolbar
        tabs={
          <ViewTabs
            label={t("filter.status")}
            current={status ?? "all"}
            tabs={VIEWS.map((view) => ({
              key: view,
              href: withQuery(base, { ...keep, status: view === "all" ? undefined : view }),
              label: view === "all" ? t("filter.allStatuses") : states(view),
              count: counts[view],
              testId: `etax-view-${view}`,
            }))}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "month", label: t("filter.month"), type: "period", periods, fallback: current },
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
              {
                name: "subjectType",
                label: t("filter.type"),
                type: "select",
                placeholder: t("filter.allTypes"),
                options: SUBJECT_TYPES.map((value) => ({ value, label: t(`subject.${value}`) })),
              },
            ]}
          />
        }
      />

      {rows.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconReceipt}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <a href={withQuery(base, { month: keep.month })}>{t("empty.clear")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/payments")}>{t("empty.payments")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("listCaption")}
          testId="etax-list"
          minWidth="52rem"
          stackOnPhones
          columns={[
            { key: "number", header: t("col.number"), phone: "title" },
            { key: "type", header: t("col.type"), phone: "meta" },
            { key: "issued", header: t("col.issued"), className: "whitespace-nowrap", phone: "meta" },
            { key: "total", header: t("col.total"), align: "end", phone: "figure" },
            { key: "status", header: t("col.status"), className: "whitespace-nowrap", phone: "status" },
          ]}
          rows={rows.data.map((row) => ({
            key: row.id,
            testId: "etax-row",
            href: ownerPath(locale, `/reports/etax/${row.id}`),
            data: { id: row.id, status: row.status },
            cells: {
              number: (
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono font-medium">{row.number}</span>
                  {row.error ? (
                    <StatusText tone="danger" icon={IconAlert} className="max-w-sm">
                      <span className="line-clamp-2 font-normal">{row.error}</span>
                    </StatusText>
                  ) : null}
                </span>
              ),
              type: (
                <span className="flex flex-col">
                  <span>{t(`subject.${row.subjectType}`)}</span>
                  {typeName(row.documentTypeCode) ? (
                    <span className="text-muted text-sm">{typeName(row.documentTypeCode)}</span>
                  ) : null}
                </span>
              ),
              issued: formatDate(row.issuedAt, locale),
              total: formatTHB(row.total, locale),
              status: <StatusBadgeOf map={ETAX_STATUS} value={row.status} size="sm" />,
            },
          }))}
        />
      )}
      <ListPagination meta={rows.meta} path={base} searchParams={searchParams} locale={locale} />
    </OwnerPage>
  );
}
