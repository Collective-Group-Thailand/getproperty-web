import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { INVOICE_STATUS } from "@/domain/status/invoice";
import { PAYMENT_STATUS } from "@/domain/status/payment";
import { INVOICE_DELIVERY_STATUS } from "@/domain/status/invoiceDelivery";
import { REMINDER_STATUS } from "@/domain/status/reminder";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { Paper, PaperFoot, PaperHead, PaperParties, PaperSection, PaperTotals } from "@/ui/components/Paper";
import { Statement } from "@/ui/components/Statement";

import { QrImage } from "@/features/shared/console/QrImage";
import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { section, type OwnerContext } from "../shared/server";
import { InvoiceActions } from "./InvoiceActions";
import { InvoiceFlags } from "./InvoiceFlags";
import { InvoiceLines } from "./InvoiceLines";
import { segmentPhotos } from "./photos";

/**
 * One invoice (F2 2.3, B4.3): who and what is billed, the lines by source with their disclosure (D-022),
 * the totals exactly as the API computed them, the PromptPay reference, payments and receipts, the
 * reminder log, credit / debit notes, the PDF (A4 and 80 mm) — and the actions the API offers.
 */
export async function InvoiceDetail({ context, invoiceId }: { context: OwnerContext; invoiceId: string }) {
  const t = await getTranslations("owner.invoices.detail");
  const methods = await getTranslations("owner.invoices.method");
  const { api, locale } = context;
  let invoice: Schemas["InvoiceDto"];
  try {
    invoice = await unwrap(api.GET("/v1/owner/invoices/{invoiceId}", { params: { path: { invoiceId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [photos, payments, reminders, deliveries] = await Promise.all([
    segmentPhotos(api, invoice.unitId, invoice.lines),
    invoice.status === "draft"
      ? Promise.resolve({ data: null, error: null })
      : section(unwrap(api.GET("/v1/owner/payments", { params: { query: { invoiceId, perPage: 20 } } }))),
    invoice.status === "draft"
      ? Promise.resolve({ data: null, error: null })
      : section(unwrap(api.GET("/v1/owner/invoices/{invoiceId}/reminders", { params: { path: { invoiceId } } }))),
    invoice.status === "draft"
      ? Promise.resolve({ data: null, error: null })
      : section(unwrap(api.GET("/v1/owner/invoices/{invoiceId}/deliveries", { params: { path: { invoiceId } } }))),
  ]);
  const title = invoice.number ?? t("draftTitle", { unit: invoice.unitNo ?? "" });

  const issued = Boolean(invoice.number);
  return (
    <OwnerPage testId="invoice-detail">
      <PageHeader
        title={title}
        testId="invoice-title"
        description={t("subtitle", {
          party: invoice.billedPartyName,
          unit: invoice.unitNo ?? "—",
          start: formatDate(invoice.periodStart, locale),
          end: formatDate(invoice.periodEnd, locale),
        })}
        crumbs={[{ label: title }]}
        status={<StatusBadgeOf map={INVOICE_STATUS} value={invoice.status} />}
      />
      {invoice.reviewFlags.length ||
      invoice.complianceFlags.length ||
      invoice.hasEstimate ||
      invoice.hasAboveCapLine ? (
        <Callout tone="warning" title={t("flagsTitle")}>
          <InvoiceFlags invoice={invoice} />
        </Callout>
      ) : null}

      <DetailLayout
        panel={
          <ActionPanel
            title={t("panelTitle")}
            testId="invoice-panel"
            facts={[
              { key: "due", label: t("amountDue"), value: formatTHB(invoice.amountDue, locale) },
              { key: "balance", label: t("balance"), value: formatTHB(invoice.balance, locale) },
              ...(invoice.dueDate
                ? [{ key: "dueDate", label: t("dueDate"), value: formatDate(invoice.dueDate, locale) }]
                : []),
              ...(invoice.issuedAt
                ? [{ key: "issued", label: t("issuedAt"), value: formatDate(invoice.issuedAt, locale) }]
                : []),
            ]}
            primary={<InvoiceActions invoice={invoice} layout="panel" />}
            secondary={
              issued ? (
                <div className="flex flex-col gap-2 [&>*]:w-full">
                  <DocumentButton
                    document={{ kind: "invoice", id: invoice.id }}
                    label={t("pdf")}
                    title={t("pdfTitle", { number: invoice.number! })}
                    variant="secondary"
                    testId="invoice-pdf"
                  />
                  <DocumentButton
                    document={{ kind: "invoice", id: invoice.id, paper: "thermal_80mm" }}
                    label={t("thermal")}
                    title={t("pdfTitle", { number: invoice.number! })}
                    variant="ghost"
                  />
                </div>
              ) : undefined
            }
          />
        }
      >
        <Paper label={title} testId="invoice-paper">
          <PaperHead
            kind={issued ? t("paperKind") : t("paperDraft")}
            number={invoice.number ?? t("draftNumber")}
            facts={[
              {
                key: "period",
                label: t("period"),
                value: `${formatDate(invoice.periodStart, locale)} – ${formatDate(invoice.periodEnd, locale)}`,
              },
              ...(invoice.issuedAt
                ? [{ key: "issued", label: t("issuedAt"), value: formatDate(invoice.issuedAt, locale) }]
                : []),
              ...(invoice.dueDate
                ? [{ key: "dueDate", label: t("dueDate"), value: formatDate(invoice.dueDate, locale) }]
                : []),
            ]}
          />
          <PaperParties
            items={[
              { key: "issuer", label: t("issuer"), value: context.me.currentTenant?.displayName ?? "—" },
              {
                key: "party",
                label: t("party"),
                value: (
                  <a
                    className="underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/parties/${invoice.billedPartyId}`)}
                  >
                    {invoice.billedPartyName}
                  </a>
                ),
              },
              { key: "unit", label: t("unit"), value: <span className="font-mono">{invoice.unitNo ?? "—"}</span> },
              ...(invoice.leaseId
                ? [
                    {
                      key: "lease",
                      label: t("lease"),
                      value: (
                        <a
                          className="underline-offset-4 hover:underline"
                          href={ownerPath(locale, `/leases/${invoice.leaseId}`)}
                        >
                          {invoice.leaseNumber ?? t("lease")}
                        </a>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <PaperSection title={t("lines")}>
            <InvoiceLines lines={invoice.lines} photos={photos} locale={locale} />
          </PaperSection>
          <PaperTotals testId="invoice-totals">
            <Statement
              caption={t("totals")}
              lines={[
                { key: "subtotal", label: t("subtotal"), value: formatTHB(invoice.subtotal, locale) },
                { key: "vat", label: t("vat"), value: formatTHB(invoice.vatAmount, locale) },
                {
                  key: "total",
                  label: t("total"),
                  kind: "subtotal",
                  value: <span data-testid="invoice-total">{formatTHB(invoice.total, locale)}</span>,
                },
                { key: "prior", label: t("priorBalance"), value: formatTHB(invoice.priorBalance, locale) },
                { key: "due", label: t("amountDue"), kind: "subtotal", value: formatTHB(invoice.amountDue, locale) },
                { key: "paid", label: t("paid"), level: 1, value: formatTHB(invoice.paidTotal, locale) },
                { key: "credited", label: t("credited"), level: 1, value: formatTHB(invoice.creditedTotal, locale) },
                { key: "debited", label: t("debited"), level: 1, value: formatTHB(invoice.debitedTotal, locale) },
                {
                  key: "balance",
                  label: t("balance"),
                  kind: "result",
                  value: <span data-testid="invoice-balance">{formatTHB(invoice.balance, locale)}</span>,
                },
              ]}
            />
          </PaperTotals>
          {invoice.qrPayload || invoice.promptpayRef || invoice.voidedAt || invoice.replacedByInvoiceId ? (
            <PaperFoot>
              <div className="flex flex-col gap-1">
                {invoice.promptpayRef ? (
                  <p>
                    {t("promptpay")}{" "}
                    <span className="text-fg font-mono" data-testid="promptpay-ref">
                      {invoice.promptpayRef}
                    </span>
                  </p>
                ) : null}
                {invoice.promptpayRef ? <p>{t("qrHint")}</p> : null}
                {invoice.voidedAt ? (
                  <p>
                    {t("voided")}{" "}
                    {t("voidedOn", {
                      date: formatDateTime(invoice.voidedAt, locale),
                      reason: invoice.voidReason ?? "",
                    })}
                  </p>
                ) : null}
                {invoice.replacedByInvoiceId ? (
                  <p>
                    {t("replacedBy")}{" "}
                    <a
                      className="text-fg font-medium underline underline-offset-4"
                      href={ownerPath(locale, `/invoices/${invoice.replacedByInvoiceId}`)}
                      data-testid="replacement-link"
                    >
                      {t("replacement")}
                    </a>
                  </p>
                ) : null}
              </div>
              {invoice.qrPayload ? (
                <div className="shrink-0" data-testid="invoice-qr">
                  <QrImage payload={invoice.qrPayload} label={t("qrAlt", { number: title })} size={136} />
                </div>
              ) : null}
            </PaperFoot>
          ) : null}
        </Paper>
        {invoice.status !== "draft" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card as="section" aria-labelledby="invoice-payments" data-testid="invoice-payments">
              <CardHeader title={<span id="invoice-payments">{t("payments")}</span>} />
              {payments.data && payments.data.data.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {payments.data.data.map((payment) => (
                    <li key={payment.id} className="flex flex-col gap-1" data-testid="invoice-payment">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <a
                          className="underline-offset-4 hover:underline"
                          href={ownerPath(locale, `/payments/${payment.id}`)}
                        >
                          {t("paymentLine", {
                            method: methods(payment.method),
                            date: formatDateTime(payment.paidAt, locale),
                          })}
                        </a>
                        <span className="tabular-nums">{formatTHB(payment.amount, locale)}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusBadgeOf map={PAYMENT_STATUS} value={payment.status} size="sm" />
                        {payment.receipts.map((receipt) => (
                          <DocumentButton
                            key={receipt.id}
                            document={{ kind: "receipt", id: receipt.id }}
                            label={receipt.number}
                            title={t("receiptTitle", { number: receipt.number })}
                            variant="ghost"
                            testId="receipt-pdf"
                          />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm">{t("noPayments")}</p>
              )}
            </Card>

            <Card as="section" aria-labelledby="invoice-reminders" data-testid="invoice-reminders">
              <CardHeader
                title={<span id="invoice-reminders">{t("reminders")}</span>}
                description={t("remindersHint")}
              />
              {reminders.data && reminders.data.reminders.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {reminders.data.reminders.map((reminder) => (
                    <li key={reminder.id} className="flex flex-wrap items-center gap-2" data-testid="reminder-row">
                      <StatusBadgeOf map={REMINDER_STATUS} value={reminder.status} size="sm" />
                      <span>
                        {reminder.triggeredBy === "owner"
                          ? t("reminderOwner")
                          : t("reminderStep", { step: reminder.step })}
                      </span>
                      <span className="text-muted">
                        {formatDateTime(reminder.sentAt ?? reminder.scheduledFor, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm">{t("noReminders")}</p>
              )}
              {reminders.data?.penalty ? (
                <p className="mt-3 text-sm" data-testid="late-fee">
                  {t("lateFee", {
                    amount: formatTHB(reminders.data.penalty.amount, locale),
                    status: t(`penalty.${reminders.data.penalty.status}`),
                  })}
                </p>
              ) : null}
            </Card>

            <Card as="section" aria-labelledby="invoice-deliveries" data-testid="invoice-deliveries">
              <CardHeader
                title={<span id="invoice-deliveries">{t("deliveries")}</span>}
                description={t("deliveriesHint")}
              />
              {deliveries.data && deliveries.data.data.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {deliveries.data.data.map((delivery) => (
                    <li key={delivery.id} className="flex flex-wrap items-center gap-2" data-testid="delivery-row">
                      <StatusBadgeOf map={INVOICE_DELIVERY_STATUS} value={delivery.status} size="sm" />
                      <span>{t(`deliveryKind.${delivery.kind}`)}</span>
                      <span className="text-muted">{delivery.channel}</span>
                      <span className="text-muted">{formatDateTime(delivery.at, locale)}</span>
                      {delivery.error ? <span className="text-muted w-full text-xs">{delivery.error}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : deliveries.error ? (
                <p className="text-muted text-sm">{t("deliveriesUnavailable")}</p>
              ) : (
                <p className="text-muted text-sm">{t("noDeliveries")}</p>
              )}
            </Card>

            <Card as="section" aria-labelledby="invoice-notes" data-testid="invoice-notes">
              <CardHeader title={<span id="invoice-notes">{t("notes")}</span>} />
              {invoice.creditNotes.length + invoice.debitNotes.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {[
                    ...invoice.creditNotes.map((note) => ({ note, kind: "creditNote" as const })),
                    ...invoice.debitNotes.map((note) => ({ note, kind: "debitNote" as const })),
                  ].map(({ note, kind }) => (
                    <li key={note.id} className="flex flex-col gap-1" data-testid="note-row">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono">{note.number}</span>
                        <span className="tabular-nums">{formatTHB(note.total, locale)}</span>
                      </span>
                      <span className="text-muted">{note.reasonText}</span>
                      <DocumentButton
                        document={{ kind, id: note.id }}
                        label={t("notePdf")}
                        title={note.number}
                        variant="ghost"
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm">{t("noNotes")}</p>
              )}
            </Card>
          </div>
        ) : null}
      </DetailLayout>
    </OwnerPage>
  );
}
