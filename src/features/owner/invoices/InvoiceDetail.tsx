import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { INVOICE_STATUS } from "@/domain/status/invoice";
import { PAYMENT_STATUS } from "@/domain/status/payment";
import { REMINDER_STATUS } from "@/domain/status/reminder";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "../shared/PageHeader";
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
  const [photos, payments, reminders] = await Promise.all([
    segmentPhotos(api, invoice.unitId, invoice.lines),
    invoice.status === "draft"
      ? Promise.resolve({ data: null, error: null })
      : section(unwrap(api.GET("/v1/owner/payments", { params: { query: { invoiceId, perPage: 20 } } }))),
    invoice.status === "draft"
      ? Promise.resolve({ data: null, error: null })
      : section(unwrap(api.GET("/v1/owner/invoices/{invoiceId}/reminders", { params: { path: { invoiceId } } }))),
  ]);
  const title = invoice.number ?? t("draftTitle", { unit: invoice.unitNo ?? "" });

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
        status={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadgeOf map={INVOICE_STATUS} value={invoice.status} />
            <InvoiceFlags invoice={invoice} />
          </span>
        }
        actions={<InvoiceActions invoice={invoice} />}
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card as="section" aria-labelledby="invoice-lines-title">
          <CardHeader
            title={<span id="invoice-lines-title">{t("lines")}</span>}
            action={
              invoice.number ? (
                <span className="flex flex-wrap gap-2">
                  <DocumentButton
                    document={{ kind: "invoice", id: invoice.id }}
                    label={t("pdf")}
                    title={t("pdfTitle", { number: invoice.number })}
                    testId="invoice-pdf"
                  />
                  <DocumentButton
                    document={{ kind: "invoice", id: invoice.id, paper: "thermal_80mm" }}
                    label={t("thermal")}
                    title={t("pdfTitle", { number: invoice.number })}
                    variant="ghost"
                  />
                </span>
              ) : null
            }
          />
          <InvoiceLines lines={invoice.lines} photos={photos} locale={locale} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card as="section" aria-labelledby="invoice-totals" data-testid="invoice-totals">
            <CardHeader title={<span id="invoice-totals">{t("totals")}</span>} />
            <DescriptionList
              columns={1}
              items={[
                { id: "subtotal", term: t("subtotal"), description: formatTHB(invoice.subtotal, locale) },
                { id: "vat", term: t("vat"), description: formatTHB(invoice.vatAmount, locale) },
                {
                  id: "total",
                  term: t("total"),
                  description: <span data-testid="invoice-total">{formatTHB(invoice.total, locale)}</span>,
                },
                { id: "prior", term: t("priorBalance"), description: formatTHB(invoice.priorBalance, locale) },
                { id: "due", term: t("amountDue"), description: formatTHB(invoice.amountDue, locale) },
                { id: "paid", term: t("paid"), description: formatTHB(invoice.paidTotal, locale) },
                { id: "credited", term: t("credited"), description: formatTHB(invoice.creditedTotal, locale) },
                { id: "debited", term: t("debited"), description: formatTHB(invoice.debitedTotal, locale) },
                {
                  id: "balance",
                  term: t("balance"),
                  description: <span data-testid="invoice-balance">{formatTHB(invoice.balance, locale)}</span>,
                },
              ]}
            />
          </Card>

          <Card as="section" aria-labelledby="invoice-facts">
            <CardHeader title={<span id="invoice-facts">{t("facts")}</span>} />
            <DescriptionList
              columns={1}
              items={[
                {
                  id: "party",
                  term: t("party"),
                  description: (
                    <a
                      className="underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/parties/${invoice.billedPartyId}`)}
                    >
                      {invoice.billedPartyName}
                    </a>
                  ),
                },
                {
                  id: "lease",
                  term: t("lease"),
                  description: invoice.leaseId ? (
                    <a
                      className="underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/leases/${invoice.leaseId}`)}
                    >
                      {invoice.leaseNumber ?? t("lease")}
                    </a>
                  ) : null,
                },
                {
                  id: "issued",
                  term: t("issuedAt"),
                  description: invoice.issuedAt ? formatDateTime(invoice.issuedAt, locale) : null,
                },
                {
                  id: "dueDate",
                  term: t("dueDate"),
                  description: invoice.dueDate ? formatDate(invoice.dueDate, locale) : null,
                },
                {
                  id: "qr",
                  term: t("promptpay"),
                  description: invoice.promptpayRef ? (
                    <span className="font-mono" data-testid="promptpay-ref">
                      {invoice.promptpayRef}
                    </span>
                  ) : null,
                },
                ...(invoice.voidedAt
                  ? [
                      {
                        id: "void",
                        term: t("voided"),
                        description: t("voidedOn", {
                          date: formatDateTime(invoice.voidedAt, locale),
                          reason: invoice.voidReason ?? "",
                        }),
                      },
                    ]
                  : []),
                ...(invoice.replacedByInvoiceId
                  ? [
                      {
                        id: "replaced",
                        term: t("replacedBy"),
                        description: (
                          <a
                            className="underline-offset-4 hover:underline"
                            href={ownerPath(locale, `/invoices/${invoice.replacedByInvoiceId}`)}
                            data-testid="replacement-link"
                          >
                            {t("replacement")}
                          </a>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {invoice.promptpayRef ? <p className="text-muted mt-2 text-xs">{t("qrHint")}</p> : null}
          </Card>
        </div>
      </div>

      {invoice.status !== "draft" ? (
        <div className="grid gap-4 lg:grid-cols-3">
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
            <CardHeader title={<span id="invoice-reminders">{t("reminders")}</span>} description={t("remindersHint")} />
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
    </OwnerPage>
  );
}
