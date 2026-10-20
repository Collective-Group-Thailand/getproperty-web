"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { bangkokInstant } from "@/features/shared/console/SettingEditor";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconPayment } from "@/ui/icons/glyphs/payment";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

const DECIMAL = /^\d{1,9}(\.\d{1,2})?$/;

/**
 * Finance's actions on a platform invoice (D-091, D-204): record a bank transfer or card payment
 * (typed confirmation of the invoice number; the amount as typed is sent, the API checks it against
 * what is open) and ask for a credit note — which a second person approves.
 */
export function InvoiceActions({ invoice }: { invoice: Schemas["PlatformInvoiceDto"] }) {
  const t = useTranslations("admin.billing.invoice");
  const locale = useLocale() as Locale;
  const [payment, setPayment] = useState({
    amount: invoice.openAmount,
    method: "bank_transfer",
    reference: "",
    paidAt: "",
  });
  const [credit, setCredit] = useState({ amount: "", reason: "" });
  const actions = new Set(invoice.nextActions);
  const path = { invoiceId: invoice.id };
  return (
    <div className="flex flex-wrap gap-2">
      {actions.has("record-payment") ? (
        <ConfirmAction
          label={t("recordPayment")}
          icon={IconPayment}
          testId="record-payment"
          title={t("recordPaymentTitle", { number: invoice.number })}
          description={t("recordPaymentBody", {
            number: invoice.number,
            tenant: invoice.tenantName,
            open: formatTHB(invoice.openAmount, locale),
          })}
          confirmLabel={t("recordPayment")}
          phrase={invoice.number}
          ready={DECIMAL.test(payment.amount) && payment.reference.trim() !== "" && payment.paidAt !== ""}
          onConfirm={(idempotencyKey) =>
            unwrap(
              browserApi().POST("/v1/admin/platform-invoices/{invoiceId}/payments", {
                params: { path, header: { "Idempotency-Key": idempotencyKey } },
                body: {
                  amount: payment.amount,
                  method: payment.method as Schemas["ManualPlatformPaymentMethod"],
                  reference: payment.reference.trim(),
                  paidAt: bangkokInstant(payment.paidAt) ?? new Date().toISOString(),
                },
              }),
            )
          }
          successMessage={t("paymentRecorded")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("amount")} required>
              <Input
                inputMode="decimal"
                value={payment.amount}
                onChange={(event) => setPayment({ ...payment, amount: event.target.value.trim() })}
                data-testid="payment-amount"
              />
            </Field>
            <Field label={t("method")} required>
              <NativeSelect
                value={payment.method}
                onChange={(event) => setPayment({ ...payment, method: event.target.value })}
                options={(["bank_transfer", "card"] as const).map((value) => ({
                  value,
                  label: t(`methodName.${value}`),
                }))}
              />
            </Field>
            <Field label={t("reference")} hint={t("referenceHint")} required>
              <Input
                value={payment.reference}
                onChange={(event) => setPayment({ ...payment, reference: event.target.value })}
                data-testid="payment-reference"
              />
            </Field>
            <Field label={t("paidAt")} required>
              <Input
                type="datetime-local"
                value={payment.paidAt}
                onChange={(event) => setPayment({ ...payment, paidAt: event.target.value })}
                data-testid="payment-paid-at"
              />
            </Field>
          </div>
        </ConfirmAction>
      ) : null}
      {actions.has("request-credit-note") ? (
        <ConfirmAction
          label={t("requestCredit")}
          icon={IconUndo}
          variant="secondary"
          testId="request-credit-note"
          title={t("requestCreditTitle", { number: invoice.number })}
          description={t("requestCreditBody", { total: formatTHB(invoice.total, locale) })}
          confirmLabel={t("requestCredit")}
          ready={DECIMAL.test(credit.amount) && credit.reason.trim() !== ""}
          onConfirm={(idempotencyKey) =>
            unwrap(
              browserApi().POST("/v1/admin/platform-invoices/{invoiceId}/credit-notes", {
                params: { path, header: { "Idempotency-Key": idempotencyKey } },
                body: { amount: credit.amount, reason: credit.reason.trim() },
              }),
            )
          }
          successMessage={t("creditRequested")}
        >
          <Field label={t("creditAmount")} required>
            <Input
              inputMode="decimal"
              value={credit.amount}
              onChange={(event) => setCredit({ ...credit, amount: event.target.value.trim() })}
              data-testid="credit-amount"
            />
          </Field>
          <Field label={t("creditReason")} required>
            <Textarea
              rows={2}
              value={credit.reason}
              onChange={(event) => setCredit({ ...credit, reason: event.target.value })}
              data-testid="credit-reason"
            />
          </Field>
        </ConfirmAction>
      ) : null}
    </div>
  );
}

/**
 * The checker's decision on a credit note (maker-checker, D-091): approve (typed confirmation of the
 * amount — the API refuses the person who asked with `platform_credit_note.same_approver`) or reject.
 */
export function CreditNoteDecision({ note, number }: { note: Schemas["PlatformCreditNoteDto"]; number: string }) {
  const t = useTranslations("admin.billing.invoice");
  const locale = useLocale() as Locale;
  const amount = formatTHB(note.amount, locale);
  const path = { creditNoteId: note.id };
  return (
    <div className="flex flex-wrap gap-2">
      {note.nextActions.includes("approve") ? (
        <ConfirmAction
          label={t("approveCredit")}
          icon={IconCheck}
          size="sm"
          testId="approve-credit-note"
          title={t("approveCreditTitle", { number })}
          description={t("approveCreditBody", { amount, reason: note.reason })}
          confirmLabel={t("approveCredit")}
          phrase={note.amount}
          onConfirm={(idempotencyKey) =>
            unwrap(
              browserApi().POST("/v1/admin/platform-invoices/credit-notes/{creditNoteId}/actions/approve", {
                params: { path, header: { "Idempotency-Key": idempotencyKey } },
              }),
            )
          }
          successMessage={t("creditApproved")}
        />
      ) : null}
      {note.nextActions.includes("reject") ? (
        <ConfirmAction
          label={t("rejectCredit")}
          icon={IconXCircle}
          size="sm"
          variant="secondary"
          tone="destructive"
          testId="reject-credit-note"
          title={t("rejectCreditTitle", { number })}
          description={t("rejectCreditBody", { amount })}
          confirmLabel={t("rejectCredit")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/admin/platform-invoices/credit-notes/{creditNoteId}/actions/reject", {
                params: { path },
              }),
            )
          }
          successMessage={t("creditRejected")}
        />
      ) : null}
    </div>
  );
}
