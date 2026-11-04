import { getTranslations } from "next-intl/server";

import { PLATFORM_INVOICE_STATUS, PLATFORM_INVOICE_VALUES } from "@/domain/status/platformInvoice";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconBill } from "@/ui/icons/glyphs/bill";

import { StateTabs } from "../shared/lists";
import { enumParam, pageParam, param, section, withQuery, type AdminContext } from "../shared/server";

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
  const q = param(searchParams.q);
  const state = enumParam(searchParams.state, PLATFORM_INVOICE_VALUES);
  const read = (one: (typeof PLATFORM_INVOICE_VALUES)[number] | undefined, perPage: number) =>
    unwrap(
      api.GET("/v1/admin/platform-invoices", {
        params: {
          query: { page: perPage === 1 ? 1 : pageParam(searchParams.page), perPage, q, tenantId, state: one },
        },
      }),
    );
  const list = await section(read(state, 25));
  const filtered = Boolean(q || state);
  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        tabs={
          <StateTabs
            states={PLATFORM_INVOICE_VALUES}
            current={state}
            total={(one) => read(one, 1)}
            href={(one) => withQuery(path, { q, state: one })}
            label={(one) => status(one)}
            allLabel={t("allStates")}
            navLabel={t("views")}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconBill}
          title={filtered ? t("emptyFiltered") : t("empty")}
          description={filtered ? undefined : t("emptyBody")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? path : tenantId ? `/tenants/${tenantId}/subscription` : "/subscriptions"}>
                {filtered ? t("clear") : t("openSubscriptions")}
              </a>
            </Button>
          }
        />
      ) : (
        <>
          <SimpleTable
            caption={t("title")}
            testId="platform-invoices"
            stackOnPhones
            minWidth="52rem"
            columns={[
              { key: "number", header: t("col.number"), phone: tenantId ? "title" : "meta" },
              ...(tenantId ? [] : [{ key: "tenant", header: t("col.tenant"), phone: "title" as const }]),
              { key: "period", header: t("col.period"), phone: "hidden" as const },
              { key: "due", header: t("col.due"), phone: "meta" as const },
              { key: "state", header: t("col.state"), phone: "status" as const },
              { key: "total", header: t("col.total"), align: "end" as const, phone: "hidden" as const },
              { key: "open", header: t("col.open"), align: "end" as const, phone: "figure" as const },
            ]}
            rows={list.data.data.map((invoice) => ({
              key: invoice.id,
              href: `/subscriptions/invoices/${invoice.id}`,
              testId: "platform-invoice-row",
              data: { number: invoice.number, state: invoice.state },
              cells: {
                number: <span className="font-mono text-sm font-medium">{invoice.number}</span>,
                tenant: <span className="font-medium">{invoice.tenantName}</span>,
                period: (
                  <span className="whitespace-nowrap">
                    {formatDate(invoice.periodStart, locale)} – {formatDate(invoice.periodEnd, locale)}
                  </span>
                ),
                total: <span className="whitespace-nowrap">{formatTHB(invoice.total, locale)}</span>,
                open: <span className="font-medium whitespace-nowrap">{formatTHB(invoice.openAmount, locale)}</span>,
                due: (
                  <span className="whitespace-nowrap">
                    <span className="text-muted md:hidden">{t("col.due")} </span>
                    {formatDate(invoice.dueAt, locale)}
                  </span>
                ),
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
