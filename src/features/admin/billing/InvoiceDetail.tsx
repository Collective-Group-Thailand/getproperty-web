import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PLATFORM_INVOICE_STATUS } from "@/domain/status/platformInvoice";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { PlatformInvoiceBody } from "@/features/shared/console/PlatformInvoiceBody";
import { PlatformInvoicePdfButton } from "@/features/shared/console/PlatformInvoicePdfButton";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";

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
    throw error;
  }
  const issue = can(me, "admin.platform_invoice.issue");
  const approve = can(me, "admin.platform_credit_note.approve");
  const waiting = invoice.creditNotes.filter((note) => note.state === "requested");
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
        actions={
          <>
            {invoice.documentId ? <PlatformInvoicePdfButton invoiceId={invoice.id} surface="admin" /> : null}
            {issue ? <InvoiceActions invoice={invoice} /> : null}
          </>
        }
      />
      {waiting.length > 0 ? (
        <Callout tone="info" title={t("waitingTitle", { count: waiting.length })}>
          {t("waitingBody")}
        </Callout>
      ) : null}
      <PlatformInvoiceBody
        invoice={invoice}
        locale={locale}
        creditNoteActions={approve ? (note) => <CreditNoteDecision note={note} number={invoice.number} /> : undefined}
      />
    </ConsolePage>
  );
}
