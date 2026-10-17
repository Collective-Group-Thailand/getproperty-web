import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PAYMENT_STATUS } from "@/domain/status/payment";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { PhotoThumb } from "../shared/PhotoThumb";
import type { OwnerContext } from "../shared/server";
import { ReversePayment } from "./PaymentActions";

/** One payment (F2 2.4): how and when it came, its allocation to invoices, receipts, evidence, reversal. */
export async function PaymentDetail({ context, paymentId }: { context: OwnerContext; paymentId: string }) {
  const t = await getTranslations("owner.payments.detail");
  const methods = await getTranslations("owner.invoices.method");
  const via = await getTranslations("owner.payments.via");
  const { api, locale } = context;
  let payment: Schemas["PaymentDto"];
  try {
    payment = await unwrap(api.GET("/v1/owner/payments/{paymentId}", { params: { path: { paymentId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const amount = formatTHB(payment.amount, locale);
  const title = t("title", { amount, method: methods(payment.method) });
  return (
    <OwnerPage testId="payment-detail">
      <PageHeader
        title={title}
        testId="payment-title"
        description={[payment.payerName, payment.unitNo].filter(Boolean).join(" · ") || undefined}
        crumbs={[{ label: methods(payment.method) }]}
        status={<StatusBadgeOf map={PAYMENT_STATUS} value={payment.status} />}
        actions={<ReversePayment payment={payment} amountLabel={amount} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-labelledby="payment-facts">
          <CardHeader title={<span id="payment-facts">{t("facts")}</span>} />
          <DescriptionList
            items={[
              { id: "amount", term: t("amount"), description: amount },
              { id: "method", term: t("method"), description: methods(payment.method) },
              { id: "paidAt", term: t("paidAt"), description: formatDateTime(payment.paidAt, locale) },
              {
                id: "confirmed",
                term: t("confirmedAt"),
                description: payment.confirmedAt ? formatDateTime(payment.confirmedAt, locale) : null,
              },
              {
                id: "via",
                term: t("confirmedVia"),
                description: payment.confirmedVia ? via(payment.confirmedVia) : null,
              },
              { id: "provider", term: t("provider"), description: payment.provider },
              {
                id: "ref",
                term: t("providerRef"),
                description: payment.providerRef ? <span className="font-mono">{payment.providerRef}</span> : null,
              },
              { id: "wht", term: t("wht"), description: formatTHB(payment.whtAmount, locale) },
              { id: "credited", term: t("credited"), description: formatTHB(payment.creditedAmount, locale) },
              { id: "notes", term: t("notes"), description: payment.notes },
              ...(payment.reversedAt
                ? [
                    {
                      id: "reversed",
                      term: t("reversed"),
                      description: t("reversedOn", {
                        date: formatDateTime(payment.reversedAt, locale),
                        reason: payment.reverseReason ?? "",
                      }),
                    },
                  ]
                : []),
            ]}
          />
          {payment.evidenceDocumentId ? (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-muted text-sm">{t("evidence")}</span>
              <PhotoThumb fileId={payment.evidenceDocumentId} alt={t("evidenceAlt", { amount })} />
            </div>
          ) : null}
        </Card>
        <Card as="section" aria-labelledby="payment-allocations" data-testid="payment-allocations">
          <CardHeader title={<span id="payment-allocations">{t("allocations")}</span>} />
          {payment.allocations.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {payment.allocations.map((allocation) => (
                <li key={allocation.invoiceId} className="flex justify-between gap-2" data-testid="allocation">
                  <a
                    className="font-mono underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/invoices/${allocation.invoiceId}`)}
                  >
                    {allocation.invoiceNumber ?? "—"}
                  </a>
                  <span className="tabular-nums">
                    {formatTHB(allocation.amount, locale)}
                    {allocation.reversedAt ? ` · ${t("allocationReversed")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noAllocations")}</p>
          )}
          <h3 className="mt-4 font-semibold">{t("receipts")}</h3>
          {payment.receipts.length ? (
            <ul className="flex flex-col gap-1">
              {payment.receipts.map((receipt) => (
                <li key={receipt.id} className="flex items-center gap-2">
                  <DocumentButton
                    document={{ kind: "receipt", id: receipt.id }}
                    label={receipt.number}
                    title={t("receiptTitle", { number: receipt.number })}
                    testId="receipt-pdf"
                  />
                  {receipt.voided ? <span className="text-muted text-sm">{t("receiptVoided")}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noReceipts")}</p>
          )}
        </Card>
      </div>
    </OwnerPage>
  );
}
