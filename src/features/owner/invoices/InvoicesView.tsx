import { getTranslations } from "next-intl/server";

import { INVOICE_STATUS, INVOICE_VALUES } from "@/domain/status/invoice";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";

import { FilterBar } from "../shared/FilterBar";
import { ownerPath } from "../shared/links";
import { ListPagination } from "../shared/ListPagination";
import { MoneyNav } from "../shared/MoneyNav";
import { OwnerPage, PageHeader } from "../shared/PageHeader";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";
import { InvoiceFlags } from "./InvoiceFlags";

type SearchParams = Record<string, string | string[] | undefined>;

/** Invoices (F2 2.3): period, status and search filters, the building focus, a cycle's invoices. */
export async function InvoicesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.invoices");
  const status = await getTranslations("status.invoice");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const statusParam = param(searchParams.status);
  const list = await unwrap(
    api.GET("/v1/owner/invoices", {
      params: {
        query: {
          page: pageParam(searchParams.page),
          perPage: 25,
          q: param(searchParams.q),
          status: INVOICE_VALUES.includes(statusParam as Schemas["InvoiceStatus"])
            ? (statusParam as Schemas["InvoiceStatus"])
            : undefined,
          period: param(searchParams.period),
          billingCycleId: param(searchParams.cycle),
          unitId: param(searchParams.unit),
          buildingId: building?.id,
        },
      },
    }),
  );
  return (
    <OwnerPage testId="invoices">
      <PageHeader
        title={t("title")}
        description={building ? t("descriptionBuilding", { building: building.name }) : t("description")}
      />
      <MoneyNav section="billing" current="/invoices" locale={locale} />
      <FilterBar
        fields={[
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
          { name: "period", label: t("filter.period"), type: "month" },
          {
            name: "status",
            label: t("filter.status"),
            type: "select",
            placeholder: t("filter.allStatuses"),
            options: INVOICE_VALUES.map((value) => ({ value, label: status(value) })),
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconBill} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="divide-border border-border bg-surface rounded-card divide-y border" data-testid="invoice-list">
          {list.data.map((invoice) => (
            <li key={invoice.id}>
              <a
                href={ownerPath(locale, `/invoices/${invoice.id}`)}
                className="hover:bg-bg-subtle flex flex-wrap items-center gap-3 px-4 py-3"
                data-testid="invoice-row"
                data-status={invoice.status}
              >
                <span className="flex w-40 flex-col">
                  <span className="font-mono text-sm font-semibold">{invoice.number ?? t("draftNumber")}</span>
                  <span className="text-muted text-xs">
                    {t("period", {
                      start: formatDate(invoice.periodStart, locale),
                      end: formatDate(invoice.periodEnd, locale),
                    })}
                  </span>
                </span>
                <span className="w-16 font-mono font-semibold">{invoice.unitNo ?? "—"}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{invoice.billedPartyName}</span>
                  <span className="text-muted text-sm">
                    {invoice.dueDate ? t("due", { date: formatDate(invoice.dueDate, locale) }) : t("notIssued")}
                  </span>
                </span>
                <InvoiceFlags invoice={invoice} />
                <span className="flex flex-col items-end">
                  <span className="tabular-nums">{formatTHB(invoice.total, locale)}</span>
                  <span className="text-muted text-xs tabular-nums">
                    {t("balance", { amount: formatTHB(invoice.balance, locale) })}
                  </span>
                </span>
                <StatusBadgeOf map={INVOICE_STATUS} value={invoice.status} size="sm" />
                <Icon icon={IconChevronRight} className="text-muted" />
              </a>
            </li>
          ))}
        </ul>
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
