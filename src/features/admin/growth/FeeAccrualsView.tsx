import { getTranslations } from "next-intl/server";

import { FEE_ACCRUAL_STATUS, FEE_ACCRUAL_VALUES } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatPercent, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconPercent } from "@/ui/icons/glyphs/percent";

import { BillingFrame } from "../billing/SubscriptionsView";
import { can, enumParam, pageParam, param, section, type AdminContext } from "../shared/server";
import { FeeDispute } from "./FeeDispute";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Subscriptions › Growth fees (G5, D-293, D-297): every agency's success / co-broke fee per deal — the basis and rate
 * of the price-plan version that priced it, the amount (capped or not), the month's invoice it went on (one per
 * agency per month, the monthly cap as a discount line) and its credit note. An invoiced fee can be **disputed**: a
 * credit note is requested (maker) and another platform user approves or rejects it on the invoice (D-091). Fees of
 * the current month wait for next month's invoice; nothing is ever deducted from rent.
 */
export async function FeeAccrualsView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("admin.growth.fees");
  const billing = await getTranslations("admin.billing");
  const status = await getTranslations("status.feeAccrual");
  const { api, locale, me } = context;
  const list = await section(
    unwrap(
      api.GET("/v1/admin/fee-accruals", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q: param(searchParams.q),
            state: enumParam(searchParams.state, FEE_ACCRUAL_VALUES),
          },
        },
      }),
    ),
  );
  const canDispute = can(me, "admin.platform_invoice.issue");

  return (
    <BillingFrame current="fees" title={billing("tab.fees")} description={billing("description.fees")}>
      <Callout tone="info">{t("intro")}</Callout>
      <FilterBar
        fields={[
          { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
          {
            name: "state",
            label: t("state"),
            type: "select",
            placeholder: t("allStates"),
            options: FEE_ACCRUAL_VALUES.map((value) => ({ value, label: status(value) })),
          },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconPercent} title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <>
          <SimpleTable
            caption={billing("tab.fees")}
            testId="fee-accruals"
            minWidth="68rem"
            columns={[
              { key: "tenant", header: t("col.tenant") },
              { key: "kind", header: t("col.kind") },
              { key: "basis", header: t("col.basis") },
              { key: "amount", header: t("col.amount"), align: "end" },
              { key: "state", header: t("col.state") },
              { key: "invoice", header: t("col.invoice") },
              { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
            ]}
            rows={list.data.data.map((fee) => ({
              key: fee.id,
              testId: "fee-accrual-row",
              data: { state: fee.state, id: fee.id },
              cells: {
                tenant: (
                  <span className="flex flex-col">
                    <a href={`/tenants/${fee.tenantId}`} className="font-semibold hover:underline">
                      {fee.tenantName}
                    </a>
                    <span className="text-muted text-sm">
                      {t("unitOn", { unit: fee.unitNo, date: formatDate(fee.accruedOn, locale) })}
                    </span>
                  </span>
                ),
                kind: t(`kind.${fee.kind}`),
                basis: (
                  <span className="text-sm tabular-nums">
                    {fee.billingUnit === "percent_of_amount"
                      ? fee.baseAmount
                        ? t("basis.percentOf", {
                            rate: formatPercent(fee.rate, locale),
                            base: formatTHB(fee.baseAmount, locale),
                          })
                        : t("basis.percent", { rate: formatPercent(fee.rate, locale) })
                      : t("basis.perDeal")}
                  </span>
                ),
                amount: (
                  <span className="flex flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{formatTHB(fee.amount, locale)}</span>
                    {fee.capped ? (
                      <Badge tone="info" size="sm">
                        {t("capped")}
                      </Badge>
                    ) : null}
                  </span>
                ),
                state: <StatusBadgeOf map={FEE_ACCRUAL_STATUS} value={fee.state} size="sm" />,
                invoice: (
                  <span className="flex flex-col gap-0.5 text-sm">
                    {fee.invoice ? (
                      <a
                        href={`/subscriptions/invoices/${fee.invoice.id}`}
                        className="font-mono font-semibold hover:underline"
                        data-testid="fee-invoice"
                      >
                        {fee.invoice.number}
                      </a>
                    ) : (
                      <span className="text-muted">{t("waitsForMonth")}</span>
                    )}
                    {fee.creditNote ? (
                      <span className="text-muted tabular-nums" data-testid="fee-credit-note">
                        {t("creditNote", {
                          number: fee.creditNote.number ?? t("creditNoteRequested"),
                          amount: formatTHB(fee.creditNote.amount, locale),
                        })}
                      </span>
                    ) : null}
                  </span>
                ),
                actions:
                  fee.state === "invoiced" && fee.invoice && canDispute ? (
                    <FeeDispute
                      accrualId={fee.id}
                      tenant={fee.tenantName}
                      unit={fee.unitNo}
                      amount={formatTHB(fee.amount, locale)}
                      invoice={fee.invoice.number}
                    />
                  ) : fee.state === "disputed" && fee.invoice ? (
                    <a
                      href={`/subscriptions/invoices/${fee.invoice.id}`}
                      className="text-primary text-sm font-medium hover:underline"
                      data-testid="fee-decide"
                    >
                      {t("decideOnInvoice")}
                    </a>
                  ) : null,
              },
            }))}
          />
          <ListPagination
            meta={list.data.meta}
            path="/subscriptions/fees"
            searchParams={searchParams}
            locale={locale}
          />
        </>
      )}
    </BillingFrame>
  );
}
