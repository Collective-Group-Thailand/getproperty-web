"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatTHB } from "@/i18n/format";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconPayment } from "@/ui/icons/glyphs/payment";

import { ConfirmAction } from "../shared/ConfirmAction";
import { DateField } from "../shared/DateField";
import { uploadOwnerFile } from "../shared/upload";

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const TIME = /^\d{2}:\d{2}$/;
const MAX_BYTES = 10 * 1024 * 1024;

function bangkokToday(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/**
 * Record money received outside the payment provider (F2 2.4, D-044): cash or a bank transfer with its
 * evidence, against one open invoice; the amount the resident actually paid, when, the reference and
 * any withholding tax. A typed confirmation restates the unit and the amount; one Idempotency-Key per
 * confirmation. The API allocates, issues the receipt and refuses a partial payment when not allowed.
 */
export function ManualPaymentForm({
  invoices,
  initialInvoiceId,
}: {
  invoices: Schemas["InvoiceSummaryDto"][];
  initialInvoiceId?: string;
}) {
  const t = useTranslations("owner.payments.manual");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const now = bangkokToday();
  const [invoiceId, setInvoiceId] = useState(
    initialInvoiceId && invoices.some((invoice) => invoice.id === initialInvoiceId) ? initialInvoiceId : "",
  );
  const [method, setMethod] = useState<Schemas["ManualPaymentMethod"]>("cash");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<string | null>(now.date);
  const [time, setTime] = useState(now.time);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [wht, setWht] = useState("");
  const [evidence, setEvidence] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const invoice = invoices.find((candidate) => candidate.id === invoiceId) ?? null;
  const ready =
    invoice !== null &&
    MONEY.test(amount) &&
    Boolean(date) &&
    TIME.test(time) &&
    (wht === "" || MONEY.test(wht)) &&
    (method === "cash" || evidence !== null) &&
    !uploading;

  return (
    <Card className="flex max-w-2xl flex-col gap-4" data-testid="manual-payment">
      <Field label={t("invoice")} required>
        <NativeSelect
          value={invoiceId}
          placeholder={t("chooseInvoice")}
          onChange={(event) => {
            setInvoiceId(event.target.value);
            const chosen = invoices.find((candidate) => candidate.id === event.target.value);
            if (chosen && !amount) setAmount(chosen.balance);
          }}
          options={invoices.map((candidate) => ({
            value: candidate.id,
            label: t("invoiceOption", {
              number: candidate.number ?? "—",
              unit: candidate.unitNo ?? "—",
              party: candidate.billedPartyName,
              balance: formatTHB(candidate.balance, locale),
            }),
          }))}
          data-testid="manual-invoice"
        />
      </Field>
      {invoice ? (
        <p className="text-muted text-sm" data-testid="manual-balance">
          {t("balance", { balance: formatTHB(invoice.balance, locale), due: formatTHB(invoice.amountDue, locale) })}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <span className="font-medium">{t("method")}</span>
        <SegmentedControl
          label={t("method")}
          value={method}
          onValueChange={(value) => setMethod(value as Schemas["ManualPaymentMethod"])}
          options={[
            { value: "cash", label: t("cash") },
            { value: "bank_transfer_manual", label: t("transfer") },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("amount")} required hint={t("amountHint")}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            data-testid="manual-amount"
          />
        </Field>
        <Field label={t("date")} required>
          <DateField name="paidDate" defaultValue={date} onChange={setDate} />
        </Field>
        <Field label={t("time")} required>
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("reference")}>
          <Input value={reference} onChange={(event) => setReference(event.target.value)} />
        </Field>
        <Field label={t("wht")} hint={t("whtHint")}>
          <Input inputMode="decimal" value={wht} onChange={(event) => setWht(event.target.value)} />
        </Field>
      </div>
      <Field label={t("notes")}>
        <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {method === "bank_transfer_manual" ? (
        <div className="flex flex-col gap-2">
          <FileDropzone
            label={t("evidence")}
            hint={t("evidenceHint")}
            accept="image/*,application/pdf"
            maxBytes={MAX_BYTES}
            tooLargeText={t("tooLarge")}
            chooseText={t("choose")}
            disabled={uploading}
            onFiles={(files) => {
              const file = files[0];
              if (!file) return;
              setUploading(true);
              setUploadFailed(false);
              uploadOwnerFile(file, { kind: "slip", scopeType: "unit", scopeId: invoice?.unitId ?? null })
                .then((stored) => setEvidence({ id: stored.id, name: file.name }))
                .catch(() => setUploadFailed(true))
                .finally(() => setUploading(false));
            }}
            data-testid="manual-evidence"
          />
          {evidence ? (
            <p className="text-muted text-sm" data-testid="manual-evidence-name">
              {t("attached", { file: evidence.name })}
            </p>
          ) : null}
          {uploadFailed ? <Callout tone="danger">{t("uploadFailed")}</Callout> : null}
        </div>
      ) : null}
      <div>
        <ConfirmAction
          label={t("record")}
          icon={IconPayment}
          disabled={!ready}
          testId="manual-record"
          title={t("confirmTitle")}
          description={t("confirmBody", {
            amount: MONEY.test(amount) ? formatTHB(amount, locale) : "—",
            unit: invoice?.unitNo ?? "—",
            number: invoice?.number ?? "—",
          })}
          confirmLabel={t("record")}
          phrase={invoice?.unitNo ?? undefined}
          successMessage={t("recorded")}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/owner/payments", {
                params: { header: { "Idempotency-Key": key } },
                body: {
                  invoiceId,
                  method,
                  amount,
                  paidAt: `${date}T${time}:00+07:00`,
                  reference: reference.trim() || undefined,
                  notes: notes.trim() || undefined,
                  whtAmount: wht || undefined,
                  evidenceDocumentId: evidence?.id,
                },
              }),
            )
          }
          onDone={(result) => router.push(`/payments/${(result as Schemas["PaymentDto"]).id}`)}
        />
      </div>
    </Card>
  );
}
