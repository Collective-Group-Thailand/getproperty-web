import { getTranslations } from "next-intl/server";

import { CREDIT_NOTE_STATUS } from "@/domain/status/creditNote";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatDecimal, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

import { QrImage } from "./QrImage";
import { SimpleTable } from "@/ui/components/SimpleTable";

/**
 * The body of a platform invoice (D-146, D-204) for the admin and the owner: the lines exactly as the
 * API issued them (discount lines negative), subtotal / discount / VAT / total / paid / credited /
 * open — every figure the API's — the Thai QR while it is open, payments with their receipts, and
 * credit notes with their state. `creditNoteActions` renders the checker's buttons (admin only).
 */
export async function PlatformInvoiceBody({
  invoice,
  locale,
  creditNoteActions,
}: {
  invoice: Schemas["PlatformInvoiceDto"];
  locale: Locale;
  creditNoteActions?: (note: Schemas["PlatformCreditNoteDto"]) => React.ReactNode;
}) {
  const t = await getTranslations("console.platformInvoice");
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card as="section" aria-labelledby="pinv-summary" className="lg:col-span-2">
          <CardHeader title={<span id="pinv-summary">{t("summary")}</span>} />
          <DescriptionList
            columns={3}
            items={[
              {
                id: "period",
                term: t("period"),
                description: `${formatDate(invoice.periodStart, locale)} – ${formatDate(invoice.periodEnd, locale)}`,
              },
              { id: "issued", term: t("issued"), description: formatDate(invoice.issuedAt, locale) },
              { id: "due", term: t("due"), description: formatDate(invoice.dueAt, locale) },
              { id: "subtotal", term: t("subtotal"), description: formatTHB(invoice.subtotal, locale) },
              { id: "discount", term: t("discount"), description: formatTHB(invoice.discount, locale) },
              { id: "vat", term: t("vat"), description: formatTHB(invoice.vatAmount, locale) },
              {
                id: "total",
                term: t("total"),
                description: <strong data-testid="pinv-total">{formatTHB(invoice.total, locale)}</strong>,
              },
              { id: "paid", term: t("paid"), description: formatTHB(invoice.paidTotal, locale) },
              { id: "credited", term: t("credited"), description: formatTHB(invoice.creditedTotal, locale) },
              {
                id: "open",
                term: t("open"),
                description: <strong data-testid="pinv-open">{formatTHB(invoice.openAmount, locale)}</strong>,
              },
              {
                id: "overdue",
                term: t("overdueSince"),
                description: invoice.overdueSince ? formatDate(invoice.overdueSince, locale) : null,
              },
            ]}
          />
        </Card>
        <Card as="section" aria-labelledby="pinv-qr" className="flex flex-col items-start gap-3">
          <CardHeader title={<span id="pinv-qr">{t("qrTitle")}</span>} />
          {invoice.qr ? (
            <>
              <QrImage payload={invoice.qr.payload} label={t("qrAlt", { number: invoice.number })} />
              <p className="text-sm">
                {t("reference")}:{" "}
                <span className="font-mono" data-testid="pinv-reference">
                  {invoice.qr.reference}
                </span>
              </p>
              {invoice.qr.expiresAt ? (
                <p className="text-muted text-xs">
                  {t("qrExpires", { date: formatDateTime(invoice.qr.expiresAt, locale) })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted text-sm">{t("noQr")}</p>
          )}
        </Card>
      </div>
      <section aria-labelledby="pinv-lines" className="flex flex-col gap-3">
        <h2 id="pinv-lines" className="text-lg font-semibold">
          {t("lines")}
        </h2>
        <SimpleTable
          caption={t("lines")}
          testId="pinv-lines"
          columns={[
            { key: "description", header: t("col.description") },
            { key: "kind", header: t("col.kind") },
            { key: "quantity", header: t("col.quantity"), align: "end" },
            { key: "unitPrice", header: t("col.unitPrice"), align: "end" },
            { key: "amount", header: t("col.amount"), align: "end" },
          ]}
          rows={invoice.lines.map((line) => ({
            key: String(line.lineNo),
            testId: "pinv-line",
            data: { kind: line.kind },
            cells: {
              description: line.description,
              kind: t(`lineKind.${line.kind}`),
              quantity: formatDecimal(line.quantity, locale, 3),
              unitPrice: formatTHB(line.unitPrice, locale),
              amount: formatTHB(line.amount, locale),
            },
          }))}
        />
      </section>
      <section aria-labelledby="pinv-payments" className="flex flex-col gap-3">
        <h2 id="pinv-payments" className="text-lg font-semibold">
          {t("payments")}
        </h2>
        {invoice.payments.length === 0 ? (
          <p className="text-muted">{t("noPayments")}</p>
        ) : (
          <SimpleTable
            caption={t("payments")}
            testId="pinv-payments"
            columns={[
              { key: "paidAt", header: t("col.paidAt") },
              { key: "method", header: t("col.method") },
              { key: "reference", header: t("col.reference") },
              { key: "receipt", header: t("col.receipt") },
              { key: "amount", header: t("col.amount"), align: "end" },
            ]}
            rows={invoice.payments.map((payment) => ({
              key: payment.id,
              testId: "pinv-payment",
              cells: {
                paidAt: formatDateTime(payment.paidAt, locale),
                method: t(`method.${payment.method}`),
                reference: <span className="font-mono">{payment.providerRef ?? "—"}</span>,
                receipt: payment.receiptNumber ? <span className="font-mono">{payment.receiptNumber}</span> : "—",
                amount: formatTHB(payment.amount, locale),
              },
            }))}
          />
        )}
      </section>
      <section aria-labelledby="pinv-credits" className="flex flex-col gap-3">
        <h2 id="pinv-credits" className="text-lg font-semibold">
          {t("creditNotes")}
        </h2>
        {invoice.creditNotes.length === 0 ? (
          <p className="text-muted">{t("noCreditNotes")}</p>
        ) : (
          <SimpleTable
            caption={t("creditNotes")}
            testId="pinv-credit-notes"
            columns={[
              { key: "number", header: t("col.number") },
              { key: "reason", header: t("col.reason") },
              { key: "state", header: t("col.state") },
              { key: "amount", header: t("col.amount"), align: "end" },
              ...(creditNoteActions
                ? [{ key: "actions", header: <span className="sr-only">{t("col.actions")}</span> }]
                : []),
            ]}
            rows={invoice.creditNotes.map((note) => ({
              key: note.id,
              testId: "pinv-credit-note",
              data: { state: note.state },
              cells: {
                number: note.number ? <span className="font-mono">{note.number}</span> : t("notIssued"),
                reason: note.reason,
                state: <StatusBadgeOf map={CREDIT_NOTE_STATUS} value={note.state} size="sm" />,
                amount: formatTHB(note.amount, locale),
                actions: creditNoteActions?.(note) ?? null,
              },
            }))}
          />
        )}
      </section>
    </div>
  );
}
