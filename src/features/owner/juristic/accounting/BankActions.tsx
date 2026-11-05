"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toast } from "@/ui/components/Toast";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconUnlink } from "@/ui/icons/glyphs/unlink";
import { IconUpload } from "@/ui/icons/glyphs/upload";

import { ownerPath, withQuery } from "../../shared/links";

const MAX_BYTES = 2 * 1024 * 1024;
const FORMATS: readonly Schemas["BankStatementFormat"][] = ["kbank", "scb", "bbl", "ktb"];

/** The file as base64 (the API takes the CSV inline, ≤ 2 MB decoded). */
async function base64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

/**
 * Imports a bank's CSV statement (J2.1 §7): the bank account, the bank's file layout (KBank · SCB · BBL · KTB — kept as
 * data by the API, unverified against live files) and the file. The same file twice changes nothing; lines an
 * overlapping file already brought are skipped. The answer says what happened, then the queue opens.
 */
export function ImportStatementButton({ banks }: { banks: { id: string; label: string }[] }) {
  const t = useTranslations("owner.accounting.bankImport");
  const locale = useLocale() as Locale;
  const [file, setFile] = useState<File | null>(null);
  return (
    <FormDialog
      label={t("button")}
      icon={IconUpload}
      variant="primary"
      testId="statement-import"
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onSubmit={async (data, _ack, idempotencyKey) => {
        if (!file) invalidField("file", t("error.file"));
        return unwrap(
          browserApi().POST("/v1/owner/juristic/bank-statements", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: {
              bankAccountId: text(data, "bankAccountId") ?? banks[0]!.id,
              formatKey: (text(data, "formatKey") ?? "kbank") as Schemas["BankStatementFormat"],
              fileName: file!.name,
              content: await base64(file!),
            },
          }),
        );
      }}
      onDone={(result) => {
        const answer = result as Schemas["BankStatementImportResultDto"];
        setFile(null);
        toast.success(
          answer.replayed
            ? t("replayed")
            : t("imported", { imported: answer.imported, duplicates: answer.duplicates, matched: answer.autoMatched }),
        );
        window.location.assign(ownerPath(locale, `/juristic/bank-statements/${answer.statement.id}`));
      }}
    >
      {(errors) => (
        <>
          <Field label={t("account")} required error={errors.bankAccountId}>
            <NativeSelect
              name="bankAccountId"
              options={banks.map((bank) => ({ value: bank.id, label: bank.label }))}
              data-testid="statement-import-account"
            />
          </Field>
          <Field label={t("format")} hint={t("formatHint")} required error={errors.formatKey}>
            <NativeSelect
              name="formatKey"
              defaultValue="kbank"
              options={FORMATS.map((value) => ({ value, label: t(`formats.${value}`) }))}
              data-testid="statement-import-format"
            />
          </Field>
          <Field label={t("file")} hint={t("fileHint")} required error={errors.file ?? errors.content}>
            <div className="flex flex-col gap-2">
              <FileDropzone
                label={t("file")}
                hint={t("fileHint")}
                accept=".csv,text/csv"
                maxBytes={MAX_BYTES}
                tooLargeText={t("tooLarge")}
                chooseText={t("choose")}
                onFiles={(files) => setFile(files[0] ?? null)}
                data-testid="statement-import-file"
              />
              {file ? <p className="text-muted m-0 text-sm">{t("chosen", { file: file.name })}</p> : null}
            </div>
          </Field>
        </>
      )}
    </FormDialog>
  );
}

type Line = Schemas["BankStatementLineDetailDto"];

/** After an action the queue moves on to the next open line (server-chosen `next`), keeping the state tab. */
function goTo(base: string, state: string | undefined, next: string | null) {
  window.location.assign(withQuery(base, { state, line: next ?? undefined }));
}

/** Matches the selected line to one candidate (same amount; the API refuses a mismatch or a target already used). */
export function MatchButton({
  line,
  suggestion,
  base,
  state,
  next,
  best,
}: {
  line: Line;
  suggestion: Schemas["BankMatchSuggestionDto"];
  base: string;
  state?: string;
  next: string | null;
  best: boolean;
}) {
  const t = useTranslations("owner.accounting.bankQueue");
  const locale = useLocale() as Locale;
  return (
    <ConfirmAction
      label={t("match")}
      icon={IconLink}
      variant={best ? "primary" : "secondary"}
      size="sm"
      testId="line-match"
      title={t("matchTitle")}
      description={t("matchBody", { label: suggestion.label, amount: formatTHB(line.amount, locale) })}
      confirmLabel={t("match")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/bank-statement-lines/{lineId}/actions/match", {
            params: { path: { lineId: line.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: { kind: suggestion.kind, targetId: suggestion.id },
          }),
        )
      }
      onDone={() => goTo(base, state, next)}
    />
  );
}

/** Takes a line out of the queue with a reason (a bank fee booked monthly, an internal move). */
export function IgnoreButton({
  line,
  base,
  state,
  next,
}: {
  line: Line;
  base: string;
  state?: string;
  next: string | null;
}) {
  const t = useTranslations("owner.accounting.bankQueue");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("ignore")}
      icon={IconHide}
      variant="secondary"
      size="sm"
      testId="line-ignore"
      title={t("ignoreTitle")}
      description={t("ignoreBody", { description: line.description })}
      confirmLabel={t("ignore")}
      ready={reason.trim().length >= 3}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/bank-statement-lines/{lineId}/actions/ignore", {
            params: { path: { lineId: line.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => goTo(base, state, next)}
    >
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          maxLength={600}
          data-testid="line-ignore-reason"
        />
      </Field>
    </ConfirmAction>
  );
}

/** Puts a matched or ignored line back in the queue. */
export function UnmatchButton({ line }: { line: Line }) {
  const t = useTranslations("owner.accounting.bankQueue");
  return (
    <ConfirmAction
      label={t("unmatch")}
      icon={IconUnlink}
      variant="secondary"
      size="sm"
      testId="line-unmatch"
      title={t("unmatchTitle")}
      description={t("unmatchBody")}
      confirmLabel={t("unmatch")}
      successMessage={t("unmatched")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/bank-statement-lines/{lineId}/actions/unmatch", {
            params: { path: { lineId: line.id }, header: { "Idempotency-Key": idempotencyKey } },
          }),
        )
      }
    />
  );
}
