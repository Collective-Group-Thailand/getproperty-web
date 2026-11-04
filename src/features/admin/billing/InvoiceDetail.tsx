import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PLATFORM_INVOICE_STATUS } from "@/domain/status/platformInvoice";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { PlatformInvoicePdfButton } from "@/features/shared/console/PlatformInvoicePdfButton";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { CREDIT_NOTE_STATUS } from "@/domain/status/creditNote";
import { QrImage } from "@/features/shared/console/QrImage";
import { formatDate, formatDateTime, formatDecimal, formatTHB } from "@/i18n/format";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { Paper, PaperHead, PaperParties, PaperSection, PaperTotals } from "@/ui/components/Paper";
import { Statement } from "@/ui/components/Statement";

import { isForbidden, NotAllowed } from "../shared/NotAllowed";
import { can, type AdminContext } from "../shared/server";
import { CreditNoteDecision, InvoiceActions } from "./InvoiceActions";

/**
 * One platform invoice (F5 5.1): lines, totals, QR, payments with receipts, credit notes; Finance
 * records transfers and asks for credit notes, a second person approves them (D-091).
 */
export async function InvoiceDetail({ context, invoiceId }: { context: AdminContext; invoiceId: string }) {
  const t = await getTranslations("admin.billing.invoice");
  const { api, locale, me } = context;
  let invoice: Schemas["PlatformInvoiceDto"];
  try {
    invoice = await unwrap(api.GET("/v1/admin/platform-invoices/{invoiceId}", { params: { path: { invoiceId } } }));
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 400)) notFound();
    if (isForbidden(error)) return <NotAllowed context={context} />;
    throw error;
  }
  const issue = can(me, "admin.platform_invoice.issue");
  const approve = can(me, "admin.platform_credit_note.approve");
  const doc = await getTranslations("console.platformInvoice");
  const waiting = invoice.creditNotes.filter((note) => note.state === "requested");
  const actions = issue && invoice.nextActions.length > 0;
  const panel = (
    <ActionPanel
      title={t("panelTitle")}
      testId="platform-invoice-panel"
      facts={[
        {
          key: "open",
          label: doc("open"),
          value: <span data-testid="pinv-open">{formatTHB(invoice.openAmount, locale)}</span>,
        },
        { key: "due", label: doc("due"), value: formatDate(invoice.dueAt, locale) },
        ...(invoice.overdueSince
          ? [{ key: "overdue", label: doc("overdueSince"), value: formatDate(invoice.overdueSince, locale) }]
          : []),
      ]}
      primary={actions ? <InvoiceActions invoice={invoice} /> : undefined}
      secondary={
        invoice.documentId ? (
          <div className="flex flex-col [&_a]:w-full [&_button]:w-full">
            <PlatformInvoicePdfButton invoiceId={invoice.id} surface="admin" />
          </div>
        ) : undefined
      }
      footer={
        invoice.qr ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-fg text-sm font-medium">{doc("qrTitle")}</span>
            <QrImage payload={invoice.qr.payload} label={doc("qrAlt", { number: invoice.number })} />
            <span className="text-sm">
              {doc("reference")}{" "}
              <span className="font-mono" data-testid="pinv-reference">
                {invoice.qr.reference}
              </span>
            </span>
            {invoice.qr.expiresAt ? (
              <span className="text-xs">
                {doc("qrExpires", { date: formatDateTime(invoice.qr.expiresAt, locale) })}
              </span>
            ) : null}
          </div>
        ) : undefined
      }
    />
  );
  return (
    <ConsolePage testId="platform-invoice">
      <PageHeader
        title={<span className="font-mono">{invoice.number}</span>}
        testId="platform-invoice-number"
        crumbs={[{ label: t("crumb"), href: "/subscriptions/invoices" }, { label: invoice.number }]}
        description={
          <a href={`/tenants/${invoice.tenantId}`} className="hover:underline">
            {invoice.tenantName}
          </a>
        }
        status={
          <span data-testid="platform-invoice-state" data-state={invoice.state}>
            <StatusBadgeOf map={PLATFORM_INVOICE_STATUS} value={invoice.state} />
          </span>
        }
      />
      <DetailLayout panel={panel}>
        {waiting.length > 0 ? (
          <Callout tone="info" title={t("waitingTitle", { count: waiting.length })}>
            {t("waitingBody")}
          </Callout>
        ) : null}
        <Paper label={`${t("crumb")} ${invoice.number}`} testId="platform-invoice-document">
          <PaperHead
            kind={t("documentKind")}
            number={invoice.number}
            facts={[
              {
                key: "period",
                label: doc("period"),
                value: `${formatDate(invoice.periodStart, locale)} – ${formatDate(invoice.periodEnd, locale)}`,
              },
              { key: "issued", label: doc("issued"), value: formatDate(invoice.issuedAt, locale) },
              { key: "due", label: doc("due"), value: formatDate(invoice.dueAt, locale) },
            ]}
          />
          <PaperParties items={[{ key: "to", label: t("billedTo"), value: invoice.tenantName }]} />
          <PaperSection title={doc("lines")}>
            {/* Phones: each line as a block — description and amount, then its kind and "qty × price" (no sideways scroll). */}
            <div className="relative -mx-1 px-1 md:overflow-x-auto">
              <table className="w-full text-base max-md:block md:min-w-[34rem]" data-testid="pinv-lines">
                <caption className="sr-only">{doc("lines")}</caption>
                <thead className="max-md:sr-only">
                  <tr className="border-border text-muted border-b text-sm">
                    <th scope="col" className="py-2 pe-4 text-start font-medium">
                      {doc("col.description")}
                    </th>
                    <th scope="col" className="py-2 pe-4 text-end font-medium">
                      {doc("col.quantity")}
                    </th>
                    <th scope="col" className="py-2 pe-4 text-end font-medium">
                      {doc("col.unitPrice")}
                    </th>
                    <th scope="col" className="py-2 text-end font-medium">
                      {doc("col.amount")}
                    </th>
                  </tr>
                </thead>
                <tbody className="max-md:block">
                  {invoice.lines.map((line) => (
                    <tr
                      key={line.lineNo}
                      className="border-border border-b last:border-b-0 max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:py-3"
                      data-testid="pinv-line"
                      data-kind={line.kind}
                    >
                      <th
                        scope="row"
                        className="py-3 pe-4 text-start align-top font-normal max-md:col-start-1 max-md:row-start-1 max-md:p-0"
                      >
                        <span className="block">{line.description}</span>
                        <span className="text-muted text-sm">{doc(`lineKind.${line.kind}`)}</span>
                      </th>
                      <td className="text-muted md:text-fg py-3 pe-4 text-end align-top text-sm tabular-nums max-md:col-start-1 max-md:row-start-2 max-md:inline max-md:p-0 max-md:text-start md:text-base">
                        <span className="md:hidden">{doc("col.quantity")} </span>
                        {formatDecimal(line.quantity, locale, 3)}
                        <span className="md:hidden">
                          {" × "}
                          {formatTHB(line.unitPrice, locale)}
                        </span>
                      </td>
                      <td className="py-3 pe-4 text-end align-top whitespace-nowrap tabular-nums max-md:hidden">
                        {formatTHB(line.unitPrice, locale)}
                      </td>
                      <td className="py-3 text-end align-top font-medium whitespace-nowrap tabular-nums max-md:col-start-2 max-md:row-start-1 max-md:p-0 md:font-normal">
                        {formatTHB(line.amount, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PaperSection>
          <PaperTotals testId="pinv-totals">
            <Statement
              caption={doc("summary")}
              lines={[
                { key: "subtotal", label: doc("subtotal"), value: formatTHB(invoice.subtotal, locale) },
                { key: "discount", label: doc("discount"), value: formatTHB(invoice.discount, locale) },
                { key: "vat", label: doc("vat"), value: formatTHB(invoice.vatAmount, locale) },
                {
                  key: "total",
                  label: doc("total"),
                  value: <span data-testid="pinv-total">{formatTHB(invoice.total, locale)}</span>,
                  kind: "subtotal",
                },
                { key: "paid", label: doc("paid"), value: formatTHB(invoice.paidTotal, locale), level: 1 },
                { key: "credited", label: doc("credited"), value: formatTHB(invoice.creditedTotal, locale), level: 1 },
                { key: "open", label: doc("open"), value: formatTHB(invoice.openAmount, locale), kind: "result" },
              ]}
            />
          </PaperTotals>
        </Paper>
        <Card as="section" aria-labelledby="pinv-payments">
          <CardHeader title={<span id="pinv-payments">{doc("payments")}</span>} />
          {invoice.payments.length === 0 ? (
            <p className="text-muted text-sm">{doc("noPayments")}</p>
          ) : (
            <ul className="divide-border flex flex-col divide-y" data-testid="pinv-payments">
              {invoice.payments.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-4 py-3" data-testid="pinv-payment">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{doc(`method.${payment.method}`)}</span>
                    <span className="text-muted text-sm">
                      {formatDateTime(payment.paidAt, locale)}
                      {payment.providerRef ? ` · ${payment.providerRef}` : ""}
                      {payment.receiptNumber ? ` · ${t("receipt", { number: payment.receiptNumber })}` : ""}
                    </span>
                  </span>
                  <span className="font-medium whitespace-nowrap tabular-nums">
                    {formatTHB(payment.amount, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card as="section" aria-labelledby="pinv-credits">
          <CardHeader title={<span id="pinv-credits">{doc("creditNotes")}</span>} />
          {invoice.creditNotes.length === 0 ? (
            <p className="text-muted text-sm">{doc("noCreditNotes")}</p>
          ) : (
            <ul className="divide-border flex flex-col divide-y" data-testid="pinv-credit-notes">
              {invoice.creditNotes.map((note) => (
                <li
                  key={note.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                  data-testid="pinv-credit-note"
                  data-state={note.state}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm">{note.number ?? doc("notIssued")}</span>
                      <StatusBadgeOf map={CREDIT_NOTE_STATUS} value={note.state} size="sm" />
                    </span>
                    <span className="text-muted text-sm">{note.reason}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    <span className="font-medium whitespace-nowrap tabular-nums">{formatTHB(note.amount, locale)}</span>
                    {approve ? <CreditNoteDecision note={note} number={invoice.number} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </DetailLayout>
    </ConsolePage>
  );
}
