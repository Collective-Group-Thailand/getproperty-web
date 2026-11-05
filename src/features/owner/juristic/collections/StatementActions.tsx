"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { formatPeriodKey, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { problemError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconPayment } from "@/ui/icons/glyphs/payment";
import { IconPrinter } from "@/ui/icons/glyphs/printer";

import { JURISTIC_NOTE_MIN, manualPaymentErrors } from "../../payments/manualPayment";
import { ownerPath } from "../../shared/links";
import { uploadOwnerFile } from "../../shared/upload";

const MAX_BYTES = 10 * 1024 * 1024;

/** Issues the month's statements (Idempotency-Key): one per owner across their units; owners already stated are skipped. */
export function IssueStatementsButton({
  months,
  buildings,
}: {
  months: string[];
  buildings: { id: string; name: string }[];
}) {
  const t = useTranslations("owner.collections.statements");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("issue")}
      icon={IconAdd}
      variant="primary"
      testId="statements-issue"
      title={t("issueTitle")}
      description={t("issueBody")}
      submitLabel={t("issueSubmit")}
      onSubmit={(data, _ack, key) => {
        const buildingId = text(data, "buildingId");
        return unwrap(
          browserApi().POST("/v1/owner/juristic/statements/actions/issue", {
            params: { header: { "Idempotency-Key": key } },
            body: {
              period: text(data, "period") ?? months[0]!,
              ...(buildingId ? { buildingId } : {}),
              language: (text(data, "language") as Schemas["Language"] | undefined) ?? "th",
            },
          }),
        );
      }}
      onDone={(result) => {
        const answer = result as Schemas["StatementIssueResultDto"];
        toast.success(t("issued", { count: answer.issued.length, skipped: answer.skipped }));
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("period")} required error={errors.period}>
              <NativeSelect
                name="period"
                defaultValue={months[1] ?? months[0]}
                options={months.map((month) => ({ value: month, label: formatPeriodKey(month, locale) }))}
                data-testid="statements-period"
              />
            </Field>
            <Field label={t("language")} hint={t("languageHint")}>
              <NativeSelect
                name="language"
                defaultValue="th"
                options={[
                  { value: "th", label: t("languageTh") },
                  { value: "en", label: t("languageEn") },
                ]}
              />
            </Field>
          </div>
          {buildings.length > 1 ? (
            <Field label={t("building")} hint={t("buildingHint")} error={errors.buildingId}>
              <NativeSelect
                name="buildingId"
                placeholder={t("allBuildings")}
                options={buildings.map((building) => ({ value: building.id, label: building.name }))}
              />
            </Field>
          ) : null}
          <p className="text-muted m-0 text-sm">{t("issueNote")}</p>
        </>
      )}
    </FormDialog>
  );
}

/** Builds the month's printed letters (statements of owners with no LINE, e-mail or phone) — one A4 PDF by the worker. */
export function NewLetterBatchButton({ months }: { months: string[] }) {
  const t = useTranslations("owner.collections.letters");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("create")}
      icon={IconPrinter}
      variant="primary"
      testId="letters-create"
      title={t("createTitle")}
      description={t("createBody")}
      submitLabel={t("createSubmit")}
      successMessage={t("created")}
      onSubmit={(data, _ack, key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/letter-batches", {
            params: { header: { "Idempotency-Key": key } },
            body: { period: text(data, "period") ?? months[1] ?? months[0]! },
          }),
        )
      }
      onDone={(result) =>
        window.location.assign(
          ownerPath(locale, `/juristic/statements/letters/${(result as Schemas["LetterBatchDto"]).id}`),
        )
      }
    >
      {(errors) => (
        <Field label={t("period")} required error={errors.period}>
          <NativeSelect
            name="period"
            defaultValue={months[1] ?? months[0]}
            options={months.map((month) => ({ value: month, label: formatPeriodKey(month, locale) }))}
            data-testid="letters-period"
          />
        </Field>
      )}
    </FormDialog>
  );
}

/**
 * Records one payment over a statement's open invoices (D-307): the API spreads it by the tenant's allocation policy
 * across the owner's units and books one payment per unit; the excess becomes credit. Juristic manual payments need
 * the evidence and a note of five characters (J1.2a) — checked here with inline errors, refused by the API otherwise.
 */
export function StatementPayButton({ statement, today }: { statement: Schemas["StatementDto"]; today: string }) {
  const t = useTranslations("owner.collections.statements");
  const manual = useTranslations("owner.payments.manual");
  const locale = useLocale() as Locale;
  const [file, setFile] = useState<File | null>(null);
  return (
    <FormDialog
      label={t("pay")}
      icon={IconPayment}
      variant="primary"
      sheet
      testId="statement-pay"
      title={t("payTitle", { number: statement.number })}
      description={t("payBody", { amount: formatTHB(statement.amountDue, locale), owner: statement.partyName })}
      submitLabel={t("paySubmit")}
      onSubmit={async (data, _ack, key) => {
        const method = (text(data, "method") ?? "bank_transfer_manual") as Schemas["ManualPaymentMethod"];
        const amount = text(data, "amount") ?? "";
        const paidDate = text(data, "paidDate") ?? null;
        const time = text(data, "paidTime") ?? "12:00";
        const notes = text(data, "notes") ?? "";
        const found = manualPaymentErrors(
          { method, amount, paidDate, notes, evidenceDocumentId: file ? "pending" : null },
          { juristic: true },
        );
        const fields = Object.entries(found);
        if (fields.length)
          throw problemError(422, {
            code: "validation.failed",
            title: t("fixFields"),
            errors: fields.map(([path, error]) => ({
              path: path === "evidence" ? "evidence" : path,
              code: "invalid",
              message: manual(`error.${error}`, { min: JURISTIC_NOTE_MIN }),
            })),
          });
        const stored = await uploadOwnerFile(file!, {
          kind: "slip",
          scopeType: "unit",
          scopeId: statement.units[0]?.id ?? null,
          title: t("evidenceTitle", { number: statement.number }),
        });
        return unwrap(
          browserApi().POST("/v1/owner/juristic/statements/{statementId}/payments", {
            params: { path: { statementId: statement.id }, header: { "Idempotency-Key": key } },
            body: {
              method,
              amount: amount.trim(),
              paidAt: `${paidDate}T${time}:00+07:00`,
              notes: notes.trim(),
              evidenceDocumentId: stored.id,
              ...(text(data, "reference") ? { reference: text(data, "reference") } : {}),
            },
          }),
        );
      }}
      onDone={(result) => {
        const answer = result as Schemas["StatementPaymentResultDto"];
        setFile(null);
        toast.success(t("paid", { count: answer.payments.length }));
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={manual("method")} required>
              <NativeSelect
                name="method"
                defaultValue="bank_transfer_manual"
                options={[
                  { value: "bank_transfer_manual", label: manual("transfer") },
                  { value: "cash", label: manual("cash") },
                ]}
              />
            </Field>
            <Field label={manual("amount")} hint={t("amountHint")} required error={errors.amount}>
              <Input
                name="amount"
                inputMode="decimal"
                defaultValue={statement.amountDue}
                data-testid="statement-pay-amount"
              />
            </Field>
            <Field label={manual("date")} required error={errors.paidDate}>
              <DateField name="paidDate" defaultValue={today} />
            </Field>
            <Field label={manual("time")}>
              <Input name="paidTime" type="time" defaultValue="12:00" />
            </Field>
          </div>
          <Field label={manual("reference")}>
            <Input name="reference" maxLength={100} />
          </Field>
          <Field label={t("note")} hint={t("noteHint", { min: JURISTIC_NOTE_MIN })} required error={errors.notes}>
            <Textarea name="notes" rows={2} maxLength={500} data-testid="statement-pay-note" />
          </Field>
          <Field label={t("evidence")} hint={t("evidenceHint")} required error={errors.evidence}>
            <div className="flex flex-col gap-2">
              <FileDropzone
                label={manual("evidence")}
                hint={manual("evidenceHint")}
                accept="image/*,application/pdf"
                maxBytes={MAX_BYTES}
                tooLargeText={manual("tooLarge")}
                chooseText={manual("choose")}
                onFiles={(files) => setFile(files[0] ?? null)}
                data-testid="statement-pay-evidence"
              />
              {file ? <p className="text-muted m-0 text-sm">{manual("attached", { file: file.name })}</p> : null}
            </div>
          </Field>
        </>
      )}
    </FormDialog>
  );
}
