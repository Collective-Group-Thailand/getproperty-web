import { getTranslations } from "next-intl/server";

import { PLATFORM_INVOICE_STATUS, PLATFORM_INVOICE_VALUES } from "@/domain/status/platformInvoice";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconBill } from "@/ui/icons/glyphs/bill";

import { enumParam, pageParam, param, section, type AdminContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Platform invoices (F5 5.1, D-146, D-204): Collective Group's invoices to its tenants — number,
 * tenant, period, total, what is still open, state, due date; filters by state and number/tenant.
 * Used on the subscriptions section (every tenant) and on a tenant's page (`tenantId`).
 */
export async function InvoicesTable({
  context,
  searchParams,
  tenantId,
  path,
}: {
  context: AdminContext;
  searchParams: SearchParams;
  tenantId?: string;
  path: string;
}) {
  const t = await getTranslations("admin.billing.invoices");
  const status = await getTranslations("status.platformInvoice");
  const { api, locale } = context;
  const list = await section(
    unwrap(
      api.GET("/v1/admin/platform-invoices", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q: param(searchParams.q),
            tenantId,
            state: enumParam(searchParams.state, PLATFORM_INVOICE_VALUES),
          },
        },
      }),
    ),
  );
  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        fields={[
          { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
          {
            name: "state",
            label: t("state"),
            type: "select",
            placeholder: t("allStates"),
            options: PLATFORM_INVOICE_VALUES.map((value) => ({ value, label: status(value) })),
          },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconBill} title={t("empty")} />
        </Card>
      ) : (
        <>
          <SimpleTable
            caption={t("title")}
            testId="platform-invoices"
            minWidth="48rem"
            columns={[
              { key: "number", header: t("col.number") },
              ...(tenantId ? [] : [{ key: "tenant", header: t("col.tenant") }]),
              { key: "period", header: t("col.period") },
              { key: "total", header: t("col.total"), align: "end" as const },
              { key: "open", header: t("col.open"), align: "end" as const },
              { key: "due", header: t("col.due") },
              { key: "state", header: t("col.state") },
            ]}
            rows={list.data.data.map((invoice) => ({
              key: invoice.id,
              testId: "platform-invoice-row",
              data: { number: invoice.number, state: invoice.state },
              tone: invoice.state === "overdue" ? "danger" : "default",
              cells: {
                number: (
                  <a href={`/subscriptions/invoices/${invoice.id}`} className="font-mono font-semibold hover:underline">
                    {invoice.number}
                  </a>
                ),
                tenant: (
                  <a href={`/tenants/${invoice.tenantId}`} className="hover:underline">
                    {invoice.tenantName}
                  </a>
                ),
                period: `${formatDate(invoice.periodStart, locale)} – ${formatDate(invoice.periodEnd, locale)}`,
                total: formatTHB(invoice.total, locale),
                open: formatTHB(invoice.openAmount, locale),
                due: formatDate(invoice.dueAt, locale),
                state: <StatusBadgeOf map={PLATFORM_INVOICE_STATUS} value={invoice.state} size="sm" />,
              },
            }))}
          />
          <ListPagination meta={list.data.meta} path={path} searchParams={searchParams} locale={locale} />
        </>
      )}
    </div>
  );
}
