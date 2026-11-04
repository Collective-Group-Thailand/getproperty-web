import { getTranslations } from "next-intl/server";

import { PAYMENT_STATUS, PAYMENT_VALUES } from "@/domain/status/payment";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconPayment } from "@/ui/icons/glyphs/payment";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { monthFigures } from "../shared/figures";
import { ownerPath } from "../shared/links";
import { billingPeriods, periodParam } from "../shared/periods";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, type OwnerContext } from "../shared/server";
import { heldCount, slipsToReview } from "./counts";
import { PaymentsTabs } from "./PaymentsTabs";

type SearchParams = Record<string, string | string[] | undefined>;
const METHODS: Schemas["PaymentMethod"][] = ["qr", "transfer_slip", "cash", "bank_transfer_manual", "card", "offset"];

/** The first and last day of a `YYYY-MM` month, as the list's `from` / `to` dates. */
function monthRange(month: string | undefined): { from?: string; to?: string } {
  if (!month) return {};
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/**
 * Payments (F2 2.4, G3): the month's money in as the API counts it, one toolbar (views · search · month · method ·
 * status) and a table whose rows open the payment — rows of their own on a phone.
 */
export async function PaymentsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.payments");
  const status = await getTranslations("status.payment");
  const methods = await getTranslations("owner.invoices.method");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const statusParam = param(searchParams.status);
  const methodParam = param(searchParams.method);
  const month = periodParam(param(searchParams.month));
  const filtered = Boolean(param(searchParams.q) || month || statusParam || methodParam);
  const [list, slips, held, figures, periods] = await Promise.all([
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
            ...monthRange(month),
          },
        },
      }),
    ),
    slipsToReview(api),
    heldCount(api, building?.id),
    monthFigures(context),
    billingPeriods(context, month),
  ]);
  const canRecord = ownerCan(me, "payment.record") && !readOnly(me);
  const newHref = ownerPath(locale, "/payments/new");

  return (
    <OwnerPage testId="payments">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canRecord ? (
            <Button asChild iconStart={IconAdd}>
              <a href={newHref} data-testid="payment-new">
                {t("record")}
              </a>
            </Button>
          ) : undefined
        }
      />
      {figures ? (
        <StatsRow
          label={t("figures.label")}
          highlight={slips ? "slips" : held ? "held" : undefined}
          figures={[
            {
              key: "received",
              label: t("figures.received"),
              value: formatTHB(figures.income.received, locale),
              hint: t("figures.receivedHint", { count: formatNumber(figures.income.payments, locale) }),
            },
            {
              key: "slips",
              label: t("figures.slips"),
              value: slips === undefined ? "—" : formatNumber(slips, locale),
              href: ownerPath(locale, "/payments/slips"),
            },
            {
              key: "held",
              label: t("figures.held"),
              value: held === undefined ? "—" : formatNumber(held, locale),
              href: ownerPath(locale, "/payments/held"),
            },
            {
              key: "arrears",
              label: t("figures.arrears"),
              value: formatTHB(figures.arrears.balance, locale),
              hint: t("figures.arrearsHint", { parties: formatNumber(figures.arrears.parties, locale) }),
              href: ownerPath(locale, "/arrears"),
            },
          ]}
        />
      ) : null}
      <ListToolbar
        tabs={<PaymentsTabs current="/payments" locale={locale} slips={slips} held={held} />}
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
              { name: "month", label: t("filter.month"), type: "period", periods, allLabel: t("filter.allMonths") },
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
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconPayment}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/payments")}>{t("empty.clear")}</a>
              </Button>
            ) : canRecord ? (
              <Button asChild variant="secondary" iconStart={IconAdd}>
                <a href={newHref}>{t("record")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/invoices")}>{t("empty.invoices")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="payment-list"
          stackOnPhones
          minWidth="52rem"
          columns={[
            { key: "unit", header: t("column.unit"), phone: "meta", className: "w-20" },
            { key: "payer", header: t("column.payer"), phone: "title" },
            { key: "method", header: t("column.method"), phone: "meta" },
            { key: "paidAt", header: t("column.paidAt"), phone: "hidden" },
            { key: "status", header: t("column.status"), phone: "status" },
            { key: "amount", header: t("column.amount"), align: "end", phone: "figure" },
          ]}
          rows={list.data.map((payment) => ({
            key: payment.id,
            href: ownerPath(locale, `/payments/${payment.id}`),
            testId: "payment-row",
            data: { method: payment.method },
            cells: {
              unit: <span className="font-mono">{payment.unitNo ?? "—"}</span>,
              payer: (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{payment.payerName ?? "—"}</span>
                  <span className="text-muted truncate text-sm max-md:hidden">
                    {payment.allocations.map((allocation) => allocation.invoiceNumber ?? "—").join(", ") ||
                      t("unallocated")}
                  </span>
                </span>
              ),
              method: (
                <span>
                  {methods(payment.method)}
                  <span className="md:hidden"> · {formatDateTime(payment.paidAt, locale)}</span>
                </span>
              ),
              paidAt: <span className="text-muted whitespace-nowrap">{formatDateTime(payment.paidAt, locale)}</span>,
              status: (
                <span className="flex flex-wrap items-center gap-1.5 md:flex-nowrap">
                  <StatusBadgeOf map={PAYMENT_STATUS} value={payment.status} size="sm" />
                  {payment.heldReason ? (
                    <span data-testid="payment-held">
                      <Badge tone="warning" size="sm">
                        {t("heldBadge")}
                      </Badge>
                    </span>
                  ) : null}
                </span>
              ),
              amount: <span className="font-medium whitespace-nowrap">{formatTHB(payment.amount, locale)}</span>,
            },
          }))}
        />
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
