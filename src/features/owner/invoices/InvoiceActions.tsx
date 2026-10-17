"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconBell } from "@/ui/icons/glyphs/bell";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ConfirmAction } from "../shared/ConfirmAction";
import { FormDialog, text } from "../shared/FormDialog";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "../shared/useApiAction";

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const REASONS: Schemas["NoteReason"][] = [
  "reading_correction",
  "tariff_correction",
  "goodwill",
  "duplicate",
  "estimate_settlement",
  "other",
];

type Invoice = Pick<
  Schemas["InvoiceDto"],
  "id" | "number" | "unitNo" | "nextActions" | "lines" | "billedPartyName" | "total" | "balance" | "status"
>;

/** `nextActions` as the API lists them; the contract spells some with `_` (`credit_note`), routes with `-`. */
function actionsOf(invoice: Pick<Invoice, "nextActions">) {
  const set = new Set(invoice.nextActions.map((action) => action.replace(/_/g, "-")));
  return (name: string) => set.has(name);
}

/**
 * An invoice's actions (F2 2.3), exactly those in `nextActions`: issue a draft (typed, Idempotency-Key,
 * tariff-cap acknowledgement), recompute, resend to the resident, send a reminder now, void before any
 * payment (typed, reason, optional replacement draft), and credit / debit notes.
 */
export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const t = useTranslations("owner.invoices.actions");
  const locale = useLocale() as Locale;
  const can = actionsOf(invoice);
  const recompute = useApiAction();
  const [voidReason, setVoidReason] = useState("");
  const [reissue, setReissue] = useState(false);
  const path = { invoiceId: invoice.id };
  const label = invoice.number ?? invoice.unitNo ?? "";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2" data-testid="invoice-actions">
        {can("issue") ? (
          <ConfirmAction
            label={t("issue")}
            icon={IconBill}
            testId="invoice-issue"
            title={t("issueTitle")}
            description={t("issueBody", {
              unit: invoice.unitNo ?? "",
              party: invoice.billedPartyName,
              total: formatTHB(invoice.total, locale),
            })}
            confirmLabel={t("issue")}
            phrase={invoice.unitNo ?? undefined}
            successMessage={t("issued")}
            onConfirm={(key, acknowledgementIds) =>
              unwrap(
                browserApi().POST("/v1/owner/invoices/{invoiceId}/actions/issue", {
                  params: { path, header: { "Idempotency-Key": key } },
                  body: { acknowledgementIds: acknowledgementIds.length ? acknowledgementIds : undefined },
                }),
              )
            }
          />
        ) : null}
        {can("recompute") ? (
          <Button
            variant="secondary"
            iconStart={IconRefresh}
            loading={recompute.busy}
            onClick={() =>
              void recompute.run(() =>
                unwrap(browserApi().POST("/v1/owner/invoices/{invoiceId}/actions/recompute", { params: { path } })),
              )
            }
            data-testid="invoice-recompute"
          >
            {t("recompute")}
          </Button>
        ) : null}
        {can("resend") ? (
          <ConfirmAction
            label={t("resend")}
            variant="secondary"
            testId="invoice-resend"
            title={t("resendTitle")}
            description={t("resendBody", { number: label, party: invoice.billedPartyName })}
            confirmLabel={t("resend")}
            successMessage={t("resent")}
            onConfirm={(key) =>
              unwrap(
                browserApi().POST("/v1/owner/invoices/{invoiceId}/actions/resend", {
                  params: { path, header: { "Idempotency-Key": key } },
                }),
              )
            }
          />
        ) : null}
        {can("send-reminder") ? (
          <ConfirmAction
            label={t("remind")}
            icon={IconBell}
            variant="secondary"
            testId="invoice-remind"
            title={t("remindTitle")}
            description={t("remindBody", { number: label, balance: formatTHB(invoice.balance, locale) })}
            confirmLabel={t("remind")}
            successMessage={t("reminded")}
            onConfirm={(key) =>
              unwrap(
                browserApi().POST("/v1/owner/invoices/{invoiceId}/actions/send-reminder", {
                  params: { path, header: { "Idempotency-Key": key } },
                }),
              )
            }
          />
        ) : null}
        {can("credit-note") ? <NoteButton invoice={invoice} kind="credit" /> : null}
        {can("debit-note") ? <NoteButton invoice={invoice} kind="debit" /> : null}
        {can("void") ? (
          <ConfirmAction
            label={t("void")}
            icon={IconXCircle}
            variant="destructive"
            tone="destructive"
            testId="invoice-void"
            title={t("voidTitle")}
            description={t("voidBody", { number: label })}
            confirmLabel={t("void")}
            phrase={invoice.number ?? undefined}
            ready={voidReason.trim().length > 0}
            successMessage={t("voided")}
            onConfirm={(key) =>
              unwrap(
                browserApi().POST("/v1/owner/invoices/{invoiceId}/actions/void", {
                  params: { path, header: { "Idempotency-Key": key } },
                  body: { reason: voidReason.trim(), reissue },
                }),
              )
            }
          >
            <Field label={t("voidReason")} required>
              <Textarea
                rows={2}
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                data-testid="void-reason"
              />
            </Field>
            <Checkbox checked={reissue} onCheckedChange={(value) => setReissue(value === true)} label={t("reissue")} />
          </ConfirmAction>
        ) : null}
      </div>
      <ProblemNotice error={recompute.error} />
    </div>
  );
}

interface NoteLine {
  refInvoiceLineId: string;
  description: string;
  amount: string;
}

/**
 * The credit / debit note wizard: the reason, then the lines — each credit line refers to an invoice
 * line and may not exceed it (the API refuses `invoice.credit_exceeds`) — and the note is issued with
 * its own number and PDF. Amounts are typed as the API's decimal strings; nothing is totalled here.
 */
function NoteButton({ invoice, kind }: { invoice: Invoice; kind: "credit" | "debit" }) {
  const t = useTranslations("owner.invoices.note");
  const reasons = useTranslations("owner.invoices.noteReason");
  const locale = useLocale() as Locale;
  const idempotency = useIdempotencyKey();
  const blank = (): NoteLine => ({ refInvoiceLineId: "", description: "", amount: "" });
  const [lines, setLines] = useState<NoteLine[]>([blank()]);
  const ready = lines.every((line) => line.description.trim() && MONEY.test(line.amount));
  const set = (row: number, patch: Partial<NoteLine>) =>
    setLines((current) => current.map((line, at) => (at === row ? { ...line, ...patch } : line)));

  return (
    <FormDialog
      label={t(`${kind}.button`)}
      icon={kind === "credit" ? IconEdit : IconAdd}
      testId={`${kind}-note`}
      title={t(`${kind}.title`, { number: invoice.number ?? "" })}
      description={t(`${kind}.body`)}
      submitLabel={t(`${kind}.submit`)}
      successMessage={t(`${kind}.issued`)}
      size_="lg"
      onSubmit={async (data) => {
        const body: Schemas["NoteCreateDto"] = {
          reason: (text(data, "reason") ?? "other") as Schemas["NoteReason"],
          reasonText: text(data, "reasonText") ?? "",
          lines: lines.map((line) => ({
            description: line.description.trim(),
            amount: line.amount,
            refInvoiceLineId: line.refInvoiceLineId || undefined,
          })),
        };
        const result =
          kind === "credit"
            ? await unwrap(
                browserApi().POST("/v1/owner/invoices/{invoiceId}/credit-notes", {
                  params: { path: { invoiceId: invoice.id }, header: { "Idempotency-Key": idempotency.key } },
                  body,
                }),
              )
            : await unwrap(
                browserApi().POST("/v1/owner/invoices/{invoiceId}/debit-notes", {
                  params: { path: { invoiceId: invoice.id }, header: { "Idempotency-Key": idempotency.key } },
                  body,
                }),
              );
        idempotency.renew();
        setLines([blank()]);
        return result;
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("reason")} error={errors.reason}>
              <NativeSelect
                name="reason"
                options={REASONS.map((reason) => ({ value: reason, label: reasons(reason) }))}
                data-testid="note-reason"
              />
            </Field>
            <Field label={t("reasonText")} required error={errors.reasonText}>
              <Input name="reasonText" required data-testid="note-reason-text" />
            </Field>
          </div>
          {lines.map((line, row) => (
            <div
              key={row}
              className="rounded-control border-border grid gap-2 border p-3 sm:grid-cols-[1fr_1fr_8rem_auto]"
              data-testid="note-line"
            >
              <Field label={t("refLine")} hint={kind === "credit" ? t("refLineHint") : undefined}>
                <NativeSelect
                  value={line.refInvoiceLineId}
                  placeholder={t("noRef")}
                  onChange={(event) => {
                    const ref = invoice.lines.find((candidate) => candidate.id === event.target.value);
                    set(row, {
                      refInvoiceLineId: event.target.value,
                      description: line.description || (ref ? ref.description : ""),
                    });
                  }}
                  options={invoice.lines.map((candidate) => ({
                    value: candidate.id,
                    label: t("refOption", {
                      description: candidate.description,
                      amount: formatTHB(candidate.amount, locale),
                    }),
                  }))}
                  data-testid="note-ref"
                />
              </Field>
              <Field label={t("description")} error={errors[`lines.${row}.description`]}>
                <Input
                  value={line.description}
                  onChange={(event) => set(row, { description: event.target.value })}
                  data-testid="note-description"
                />
              </Field>
              <Field label={t("amount")} error={errors[`lines.${row}.amount`]}>
                <Input
                  inputMode="decimal"
                  value={line.amount}
                  onChange={(event) => set(row, { amount: event.target.value })}
                  data-testid="note-amount"
                />
              </Field>
              <Button
                size="sm"
                variant="ghost"
                iconStart={IconDelete}
                className="self-end"
                disabled={lines.length === 1}
                onClick={() => setLines((current) => current.filter((_, at) => at !== row))}
              >
                {t("remove")}
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            iconStart={IconAdd}
            className="self-start"
            onClick={() => setLines((current) => [...current, blank()])}
          >
            {t("addLine")}
          </Button>
          {!ready ? <p className="text-muted text-sm">{t("incomplete")}</p> : null}
        </>
      )}
    </FormDialog>
  );
}
