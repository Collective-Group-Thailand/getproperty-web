import { getTranslations } from "next-intl/server";

import { INVOICE_STATUS, INVOICE_VALUES } from "@/domain/status/invoice";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatPercent, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconBill } from "@/ui/icons/glyphs/bill";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { monthFigures } from "../shared/figures";
import { ownerPath, withQuery } from "../shared/links";
import { billingPeriods, periodParam } from "../shared/periods";
import { viewCounts } from "../shared/views";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";
import { InvoiceFlags } from "./InvoiceFlags";

type SearchParams = Record<string, string | string[] | undefined>;

const VIEWS = ["all", "draft", "issued", "overdue", "partially_paid", "paid", "void"] as const;

/**
 * Invoices (F2 2.3, G3): the month's billing as the API counts it, one toolbar (status views with the API's counts ·
 * search · billing month) and a table whose rows open the invoice — rows of their own on a phone.
 */
export async function InvoicesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.invoices");
  const status = await getTranslations("status.invoice");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const statusParam = param(searchParams.status);
  const view = INVOICE_VALUES.includes(statusParam as Schemas["InvoiceStatus"])
    ? (statusParam as Schemas["InvoiceStatus"])
    : "all";
  const q = param(searchParams.q);
  const period = periodParam(param(searchParams.period));
  const cycle = param(searchParams.cycle);
  const unit = param(searchParams.unit);
  const base = { q, period, billingCycleId: cycle, unitId: unit, buildingId: building?.id };
  const [list, counts, figures, periods] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/invoices", {
        params: {
          query: {
            ...base,
            page: pageParam(searchParams.page),
            perPage: 25,
            status: view === "all" ? undefined : view,
          },
        },
      }),
    ),
    viewCounts(VIEWS, (key) =>
      unwrap(
        api.GET("/v1/owner/invoices", {
          params: { query: { ...base, perPage: 1, status: key === "all" ? undefined : key } },
        }),
      ),
    ),
    monthFigures(context),
    billingPeriods(context, period),
  ]);
  const href = (key: string) =>
    ownerPath(locale, withQuery("/invoices", { q, period, cycle, unit, status: key === "all" ? undefined : key }));
  const filtered = Boolean(q || period || cycle || unit || view !== "all");

  return (
    <OwnerPage testId="invoices">
      <PageHeader
        title={t("title")}
        description={building ? t("descriptionBuilding", { building: building.name }) : t("description")}
        actions={
          <Button asChild variant="secondary">
            <a href={ownerPath(locale, "/billing")} data-testid="invoices-cycle">
              {t("openCycle")}
            </a>
          </Button>
        }
      />
      {figures ? (
        <StatsRow
          label={t("figures.label")}
          highlight={figures.dueToday.invoices > 0 ? "dueToday" : undefined}
          figures={[
            {
              key: "billed",
              label: t("figures.billed"),
              value: formatTHB(figures.billing.billed, locale),
              hint: t("figures.billedHint", { count: formatNumber(figures.billing.invoices, locale) }),
            },
            {
              key: "collected",
              label: t("figures.collected"),
              value: formatTHB(figures.billing.collected, locale),
              hint: figures.billing.collectedPct
                ? t("figures.collectedHint", { pct: formatPercent(figures.billing.collectedPct, locale, 1) })
                : undefined,
            },
            {
              key: "outstanding",
              label: t("figures.outstanding"),
              value: formatTHB(figures.billing.outstanding, locale),
            },
            {
              key: "dueToday",
              label: t("figures.dueToday"),
              value: formatTHB(figures.dueToday.balance, locale),
              hint: t("figures.dueTodayHint", { count: formatNumber(figures.dueToday.invoices, locale) }),
            },
          ]}
        />
      ) : null}
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("views.label")}
            current={view}
            tabs={VIEWS.map((key) => ({
              key,
              href: href(key),
              label: key === "all" ? t("views.all") : status(key),
              count: counts[key],
              testId: `invoice-view-${key}`,
            }))}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
              { name: "period", label: t("filter.period"), type: "period", periods, allLabel: t("filter.allPeriods") },
            ]}
          />
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconBill}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/invoices")}>{t("empty.clear")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/billing")}>{t("openCycle")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="invoice-list"
          stackOnPhones
          minWidth="60rem"
          columns={[
            { key: "number", header: t("column.number"), phone: "meta" },
            { key: "unit", header: t("column.unit"), phone: "hidden", className: "w-20" },
            { key: "party", header: t("column.party"), phone: "title" },
            { key: "due", header: t("column.due"), phone: "meta" },
            { key: "status", header: t("column.status"), phone: "status" },
            { key: "total", header: t("column.total"), align: "end", phone: "figure" },
            { key: "balance", header: t("column.balance"), align: "end", phone: "meta" },
          ]}
          rows={list.data.map((invoice) => ({
            key: invoice.id,
            href: ownerPath(locale, `/invoices/${invoice.id}`),
            testId: "invoice-row",
            data: { status: invoice.status },
            cells: {
              number: (
                <span className="flex flex-col">
                  <span className="font-mono text-sm">{invoice.number ?? t("draftNumber")}</span>
                  <span className="text-muted text-sm font-normal">
                    {t("period", {
                      start: formatDate(invoice.periodStart, locale),
                      end: formatDate(invoice.periodEnd, locale),
                    })}
                  </span>
                </span>
              ),
              unit: <span className="font-mono">{invoice.unitNo ?? "—"}</span>,
              party: (
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate">
                    <span className="font-mono md:hidden">{invoice.unitNo ?? "—"} · </span>
                    {invoice.billedPartyName}
                  </span>
                  <InvoiceFlags invoice={invoice} />
                </span>
              ),
              due: (
                <span className="text-muted whitespace-nowrap">
                  {invoice.dueDate ? t("due", { date: formatDate(invoice.dueDate, locale) }) : t("notIssued")}
                </span>
              ),
              status: <StatusBadgeOf map={INVOICE_STATUS} value={invoice.status} size="sm" />,
              total: <span className="font-medium whitespace-nowrap">{formatTHB(invoice.total, locale)}</span>,
              balance: (
                <span className="whitespace-nowrap">
                  <span className="text-muted md:hidden">{t("column.balance")} </span>
                  {formatTHB(invoice.balance, locale)}
                </span>
              ),
            },
          }))}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/invoices")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
