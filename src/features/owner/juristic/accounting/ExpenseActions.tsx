"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconPayment } from "@/ui/icons/glyphs/payment";
import { IconSend } from "@/ui/icons/glyphs/send";
import { IconUpload } from "@/ui/icons/glyphs/upload";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { uploadOwnerFile } from "../../shared/upload";
import { isZero } from "./money";

const MAX_BYTES = 10 * 1024 * 1024;
type Expense = Schemas["ExpenseRequestDto"];

/** Sends a draft for approval: the API numbers it (EXP) and snapshots the band; the band's roles are notified. */
export function SubmitExpenseButton({ expense }: { expense: Expense }) {
  const t = useTranslations("owner.accounting.expenseAction");
  const locale = useLocale() as Locale;
  return (
    <ConfirmAction
      label={t("submit")}
      icon={IconSend}
      block
      testId="expense-submit"
      title={t("submitTitle")}
      description={t("submitBody", { amount: formatTHB(expense.amount, locale) })}
      confirmLabel={t("submit")}
      successMessage={t("submitted")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/expense-requests/{expenseRequestId}/actions/submit", {
            params: { path: { expenseRequestId: expense.id }, header: { "Idempotency-Key": idempotencyKey } },
          }),
        )
      }
    />
  );
}

/** One approval of the band (maker ≠ checker: the API refuses the requester, the console never offers it). */
export function ApproveExpenseButton({ expense }: { expense: Expense }) {
  const t = useTranslations("owner.accounting.expenseAction");
  const locale = useLocale() as Locale;
  const [note, setNote] = useState("");
  return (
    <ConfirmAction
      label={t("approve")}
      icon={IconCheckCircle}
      block
      testId="expense-approve"
      title={t("approveTitle", { number: expense.number ?? "" })}
      description={t("approveBody", { amount: formatTHB(expense.amount, locale), payee: expense.payeeName })}
      confirmLabel={t("approve")}
      successMessage={t("approved")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/expense-requests/{expenseRequestId}/actions/approve", {
            params: { path: { expenseRequestId: expense.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: note.trim() ? { reason: note.trim() } : {},
          }),
        )
      }
    >
      <Field label={t("approveNote")} hint={t("approveNoteHint")}>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={400} />
      </Field>
    </ConfirmAction>
  );
}

/** A decision with a reason: reject (one rejection rejects) or cancel (before it is paid). */
export function ReasonExpenseButton({ expense, action }: { expense: Expense; action: "reject" | "cancel" }) {
  const t = useTranslations("owner.accounting.expenseAction");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t(action)}
      icon={IconXCircle}
      variant={action === "reject" ? "secondary" : "destructive"}
      tone="destructive"
      block
      testId={`expense-${action}`}
      title={t(`${action}Title`, { number: expense.number ?? t("draft") })}
      description={t(`${action}Body`)}
      confirmLabel={t(action)}
      ready={reason.trim().length >= 3}
      successMessage={t(`${action}Done`)}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST(
            action === "reject"
              ? "/v1/owner/juristic/expense-requests/{expenseRequestId}/actions/reject"
              : "/v1/owner/juristic/expense-requests/{expenseRequestId}/actions/cancel",
            {
              params: { path: { expenseRequestId: expense.id }, header: { "Idempotency-Key": idempotencyKey } },
              body: { reason: reason.trim() },
            },
          ),
        )
      }
    >
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={600}
          data-testid={`expense-${action}-reason`}
        />
      </Field>
    </ConfirmAction>
  );
}

/**
 * Records that the money left (D-320: owner, manager or accountant — never the committee): method, the day, the
 * reference, the account it was paid from, and the transfer slip or cheque copy (required except for cash). A request
 * paid from a fund is paid from the fund's bank account. With withholding tax the API issues the 50 ทวิ.
 */
export function PayExpenseButton({
  expense,
  accounts,
  today,
}: {
  expense: Expense;
  accounts: { id: string; label: string }[];
  today: string;
}) {
  const t = useTranslations("owner.accounting.pay");
  const common = useTranslations("owner.accounting.common");
  const locale = useLocale() as Locale;
  const [method, setMethod] = useState<Schemas["ExpensePaymentMethod"]>(expense.fundId ? "fund" : "bank_transfer");
  const [file, setFile] = useState<File | null>(null);
  const methods: Schemas["ExpensePaymentMethod"][] = expense.fundId ? ["fund"] : ["bank_transfer", "cheque", "cash"];
  return (
    <FormDialog
      label={t("button")}
      icon={IconPayment}
      variant="primary"
      sheet
      testId="expense-pay"
      title={t("title", { number: expense.number ?? "" })}
      description={t("body", {
        net: formatTHB(expense.netAmount, locale),
        payee: expense.payeeName,
      })}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={async (data, _ack, idempotencyKey) => {
        const paidOn = text(data, "paidOn");
        if (!paidOn) invalidField("paidOn", t("error.date"));
        if (method !== "cash" && !file) invalidField("evidence", t("error.evidence"));
        const stored = file
          ? await uploadOwnerFile(file, {
              kind: "slip",
              scopeType: "building",
              scopeId: expense.buildingId,
              title: t("evidenceTitle", { number: expense.number ?? "" }),
            })
          : null;
        const fromAccountId = text(data, "fromAccountId");
        return unwrap(
          browserApi().POST("/v1/owner/juristic/expense-requests/{expenseRequestId}/actions/pay", {
            params: { path: { expenseRequestId: expense.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              method,
              paidOn: paidOn!,
              ...(text(data, "reference") ? { reference: text(data, "reference") } : {}),
              ...(stored ? { evidenceDocumentId: stored.id } : {}),
              ...(fromAccountId && (method === "bank_transfer" || method === "cheque") ? { fromAccountId } : {}),
            },
          }),
        );
      }}
      onDone={() => setFile(null)}
    >
      {(errors) => (
        <>
          <dl className="bg-bg-subtle rounded-control m-0 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 p-4 text-sm">
            <dt className="text-muted">{t("amount")}</dt>
            <dd className="m-0 text-end tabular-nums">{formatTHB(expense.amount, locale)}</dd>
            <dt className="text-muted">{t("wht")}</dt>
            <dd className="m-0 text-end tabular-nums">{formatTHB(expense.whtAmount, locale)}</dd>
            <dt className="font-medium">{t("net")}</dt>
            <dd className="m-0 text-end font-semibold tabular-nums">{formatTHB(expense.netAmount, locale)}</dd>
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("method")} required error={errors.method}>
              <NativeSelect
                name="method"
                value={method}
                onChange={(event) => setMethod(event.target.value as Schemas["ExpensePaymentMethod"])}
                options={methods.map((value) => ({ value, label: t(`methods.${value}`) }))}
                data-testid="expense-pay-method"
              />
            </Field>
            <Field label={t("paidOn")} hint={t("paidOnHint")} required error={errors.paidOn}>
              <DateField name="paidOn" defaultValue={today} max={today} />
            </Field>
          </div>
          {(method === "bank_transfer" || method === "cheque") && accounts.length ? (
            <Field label={t("from")} hint={t("fromHint")} error={errors.fromAccountId}>
              <NativeSelect
                name="fromAccountId"
                defaultValue={accounts[0]?.id}
                options={accounts.map((account) => ({ value: account.id, label: account.label }))}
              />
            </Field>
          ) : null}
          <Field label={t("reference")} hint={t("referenceHint")} error={errors.reference}>
            <Input name="reference" maxLength={100} data-testid="expense-pay-reference" />
          </Field>
          {method === "cash" ? (
            <p className="text-muted m-0 text-sm">{t("cashNote")}</p>
          ) : (
            <Field
              label={t("evidence")}
              hint={t("evidenceHint")}
              required
              error={errors.evidence ?? errors.evidenceDocumentId}
            >
              <div className="flex flex-col gap-2">
                <FileDropzone
                  label={t("evidence")}
                  hint={common("receiptHint")}
                  accept="image/*,application/pdf"
                  maxBytes={MAX_BYTES}
                  tooLargeText={common("tooLarge")}
                  chooseText={common("choose")}
                  onFiles={(files) => setFile(files[0] ?? null)}
                  data-testid="expense-pay-evidence"
                />
                {file ? <p className="text-muted m-0 text-sm">{common("attached", { file: file.name })}</p> : null}
              </div>
            </Field>
          )}
          {!isZero(expense.whtAmount) ? <p className="text-muted m-0 text-sm">{t("whtNote")}</p> : null}
        </>
      )}
    </FormDialog>
  );
}

export const ATTACHMENT_KINDS: readonly Schemas["ExpenseAttachmentKind"][] = [
  "quotation",
  "invoice",
  "receipt",
  "payment_evidence",
  "other",
];

/** Adds a document to a request (a quotation, the vendor's invoice, a receipt). */
export function AttachExpenseButton({ expense }: { expense: Expense }) {
  const t = useTranslations("owner.accounting.attach");
  const kinds = useTranslations("owner.accounting.attachmentKind");
  const common = useTranslations("owner.accounting.common");
  const [file, setFile] = useState<File | null>(null);
  return (
    <FormDialog
      label={t("button")}
      icon={IconUpload}
      testId="expense-attach"
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={async (data) => {
        if (!file) invalidField("file", t("error"));
        const stored = await uploadOwnerFile(file!, {
          kind: "other",
          scopeType: "building",
          scopeId: expense.buildingId,
          title: file!.name,
        });
        return unwrap(
          browserApi().POST("/v1/owner/juristic/expense-requests/{expenseRequestId}/attachments", {
            params: { path: { expenseRequestId: expense.id } },
            body: {
              documentId: stored.id,
              kind: (text(data, "kind") ?? "other") as Schemas["ExpenseAttachmentKind"],
            },
          }),
        );
      }}
      onDone={() => setFile(null)}
    >
      {(errors) => (
        <>
          <Field label={t("kind")} required>
            <NativeSelect
              name="kind"
              defaultValue="quotation"
              options={ATTACHMENT_KINDS.map((value) => ({ value, label: kinds(value) }))}
            />
          </Field>
          <Field label={t("file")} required error={errors.file}>
            <div className="flex flex-col gap-2">
              <FileDropzone
                label={t("file")}
                hint={common("receiptHint")}
                accept="image/*,application/pdf"
                maxBytes={MAX_BYTES}
                tooLargeText={common("tooLarge")}
                chooseText={common("choose")}
                onFiles={(files) => setFile(files[0] ?? null)}
              />
              {file ? <p className="text-muted m-0 text-sm">{common("attached", { file: file.name })}</p> : null}
            </div>
          </Field>
        </>
      )}
    </FormDialog>
  );
}
