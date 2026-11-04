import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PAYMENT_STATUS } from "@/domain/status/payment";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { Paper, PaperFoot, PaperHead, PaperParties, PaperSection, PaperTotals } from "@/ui/components/Paper";
import { Statement } from "@/ui/components/Statement";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { PhotoThumb } from "../shared/PhotoThumb";
import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { HeldPaymentActions } from "./HeldPaymentActions";
import { HeldNotice } from "./HeldPaymentsView";
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
  const canDecide = ownerCan(context.me, "payment.record") && !readOnly(context.me);
  return (
    <OwnerPage testId="payment-detail">
      <PageHeader
        title={title}
        testId="payment-title"
        description={[payment.payerName, payment.unitNo].filter(Boolean).join(" · ") || undefined}
        crumbs={[{ label: methods(payment.method) }]}
        status={<StatusBadgeOf map={PAYMENT_STATUS} value={payment.status} />}
      />
      {payment.status === "pending" && payment.heldReason ? <HeldNotice payment={payment} locale={locale} /> : null}
      <DetailLayout
        panel={
          <ActionPanel
            title={t("panelTitle")}
            testId="payment-panel"
            facts={[
              { key: "amount", label: t("amount"), value: amount },
              { key: "paidAt", label: t("paidAt"), value: formatDateTime(payment.paidAt, locale) },
            ]}
            primary={canDecide ? <HeldPaymentActions payment={payment} amountLabel={amount} /> : undefined}
            secondary={
              payment.receipts.length ? (
                <div className="flex flex-col gap-2 [&>*]:w-full">
                  {payment.receipts.map((receipt) => (
                    <DocumentButton
                      key={receipt.id}
                      document={{ kind: "receipt", id: receipt.id }}
                      label={
                        receipt.voided
                          ? `${t("receiptTitle", { number: receipt.number })} · ${t("receiptVoided")}`
                          : t("receiptTitle", { number: receipt.number })
                      }
                      title={t("receiptTitle", { number: receipt.number })}
                      testId="receipt-pdf"
                    />
                  ))}
                </div>
              ) : undefined
            }
            destructive={
              payment.nextActions.includes("reverse") ? (
                <ReversePayment payment={payment} amountLabel={amount} />
              ) : undefined
            }
            footer={
              payment.confirmedAt
                ? t("confirmedLine", {
                    date: formatDateTime(payment.confirmedAt, locale),
                    via: payment.confirmedVia ? via(payment.confirmedVia) : "—",
                  })
                : undefined
            }
          />
        }
      >
        <Paper label={title} testId="payment-paper">
          <PaperHead
            kind={t("paperKind")}
            number={payment.providerRef ?? undefined}
            facts={[
              { key: "paidAt", label: t("paidAt"), value: formatDateTime(payment.paidAt, locale) },
              ...(payment.confirmedAt
                ? [{ key: "confirmed", label: t("confirmedAt"), value: formatDateTime(payment.confirmedAt, locale) }]
                : []),
            ]}
          />
          <PaperParties
            items={[
              { key: "payer", label: t("payer"), value: payment.payerName ?? "—" },
              { key: "unit", label: t("unit"), value: <span className="font-mono">{payment.unitNo ?? "—"}</span> },
              {
                key: "method",
                label: t("method"),
                value: methods(payment.method),
                detail: [payment.confirmedVia ? via(payment.confirmedVia) : null, payment.provider]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />
          <PaperSection title={t("allocations")}>
            <div data-testid="payment-allocations">
              {payment.allocations.length ? (
                <ul className="divide-border border-border flex flex-col divide-y border-y">
                  {payment.allocations.map((allocation) => (
                    <li
                      key={allocation.invoiceId}
                      className="flex items-baseline justify-between gap-4 py-2.5"
                      data-testid="allocation"
                    >
                      <a
                        className="font-mono underline-offset-4 hover:underline"
                        href={ownerPath(locale, `/invoices/${allocation.invoiceId}`)}
                      >
                        {allocation.invoiceNumber ?? "—"}
                      </a>
                      <span className="flex items-baseline gap-2 font-medium tabular-nums">
                        {allocation.reversedAt ? (
                          <span className="text-muted text-sm font-normal">{t("allocationReversed")}</span>
                        ) : null}
                        {formatTHB(allocation.amount, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">{t("noAllocations")}</p>
              )}
            </div>
          </PaperSection>
          <PaperTotals>
            <Statement
              caption={t("facts")}
              lines={[
                { key: "wht", label: t("wht"), value: formatTHB(payment.whtAmount, locale) },
                { key: "credited", label: t("credited"), value: formatTHB(payment.creditedAmount, locale) },
                { key: "amount", label: t("amount"), kind: "result", value: amount },
              ]}
            />
          </PaperTotals>
          {payment.notes || payment.evidenceDocumentId || payment.dismissedAt || payment.reversedAt ? (
            <PaperFoot>
              <div className="flex flex-col gap-1">
                {payment.notes ? (
                  <p>
                    {t("notes")}: <span className="text-fg">{payment.notes}</span>
                  </p>
                ) : null}
                {payment.dismissedAt ? (
                  <p data-testid="payment-dismissed">
                    {t("dismissed")}{" "}
                    {t("dismissedOn", {
                      date: formatDateTime(payment.dismissedAt, locale),
                      reason: payment.dismissReason ?? "",
                    })}
                  </p>
                ) : null}
                {payment.reversedAt ? (
                  <p>
                    {t("reversed")}{" "}
                    {t("reversedOn", {
                      date: formatDateTime(payment.reversedAt, locale),
                      reason: payment.reverseReason ?? "",
                    })}
                  </p>
                ) : null}
              </div>
              {payment.evidenceDocumentId ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span>{t("evidence")}</span>
                  <PhotoThumb fileId={payment.evidenceDocumentId} alt={t("evidenceAlt", { amount })} />
                </div>
              ) : null}
            </PaperFoot>
          ) : null}
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}
