import { getTranslations } from "next-intl/server";

import { PAYMENT_STATUS, PAYMENT_VALUES } from "@/domain/status/payment";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconPayment } from "@/ui/icons/glyphs/payment";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath } from "../shared/links";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { MoneyNav } from "../shared/MoneyNav";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";
import { heldCount, slipsToReview } from "./counts";

type SearchParams = Record<string, string | string[] | undefined>;
const METHODS: Schemas["PaymentMethod"][] = ["qr", "transfer_slip", "cash", "bank_transfer_manual", "card", "offset"];

/** The first and last day of a `YYYY-MM` month, as the list's `from` / `to` dates. */
function monthRange(month: string | undefined): { from?: string; to?: string } {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return {};
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Payments (F2 2.4): method, status, month and search filters; each with its allocation to invoices. */
export async function PaymentsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.payments");
  const status = await getTranslations("status.payment");
  const methods = await getTranslations("owner.invoices.method");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const statusParam = param(searchParams.status);
  const methodParam = param(searchParams.method);
  const [list, slips, held] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/payments", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q: param(searchParams.q),
            status: PAYMENT_VALUES.includes(statusParam as Schemas["PaymentStatus"])
              ? (statusParam as Schemas["PaymentStatus"])
              : undefined,
            method: METHODS.includes(methodParam as Schemas["PaymentMethod"])
              ? (methodParam as Schemas["PaymentMethod"])
              : undefined,
            buildingId: building?.id,
            ...monthRange(param(searchParams.month)),
          },
        },
      }),
    ),
    slipsToReview(api),
    heldCount(api, building?.id),
  ]);
  return (
    <OwnerPage testId="payments">
      <PageHeader title={t("title")} description={t("description")} />
      <MoneyNav
        section="payments"
        current="/payments"
        locale={locale}
        counts={{ "/payments/slips": slips, "/payments/held": held }}
      />
      <FilterBar
        fields={[
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
          { name: "month", label: t("filter.month"), type: "month" },
          {
            name: "method",
            label: t("filter.method"),
            type: "select",
            placeholder: t("filter.allMethods"),
            options: METHODS.map((value) => ({ value, label: methods(value) })),
          },
          {
            name: "status",
            label: t("filter.status"),
            type: "select",
            placeholder: t("filter.allStatuses"),
            options: PAYMENT_VALUES.map((value) => ({ value, label: status(value) })),
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconPayment} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="divide-border border-border bg-surface rounded-card divide-y border" data-testid="payment-list">
          {list.data.map((payment) => (
            <li key={payment.id}>
              <a
                href={ownerPath(locale, `/payments/${payment.id}`)}
                className="hover:bg-bg-subtle flex flex-wrap items-center gap-3 px-4 py-3"
                data-testid="payment-row"
                data-method={payment.method}
              >
                <span className="flex w-44 flex-col">
                  <span className="font-medium">{methods(payment.method)}</span>
                  <span className="text-muted text-xs">{formatDateTime(payment.paidAt, locale)}</span>
                </span>
                <span className="w-16 font-mono font-semibold">{payment.unitNo ?? "—"}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{payment.payerName ?? "—"}</span>
                  <span className="text-muted text-sm">
                    {payment.allocations.map((allocation) => allocation.invoiceNumber ?? "—").join(", ") ||
                      t("unallocated")}
                    {payment.providerRef ? ` · ${payment.providerRef}` : ""}
                  </span>
                </span>
                {payment.heldReason ? (
                  <span data-testid="payment-held">
                    <Badge tone="warning" size="sm">
                      {t("heldBadge")}
                    </Badge>
                  </span>
                ) : null}
                <span className="tabular-nums">{formatTHB(payment.amount, locale)}</span>
                <StatusBadgeOf map={PAYMENT_STATUS} value={payment.status} size="sm" />
                <Icon icon={IconChevronRight} className="text-muted" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/payments")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
