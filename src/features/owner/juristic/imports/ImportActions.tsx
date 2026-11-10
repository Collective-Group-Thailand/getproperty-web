"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { formatBytes, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, useFieldProps } from "@/ui/components/Field";
import { FieldError } from "@/ui/components/FieldError";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Icon } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconAttachment } from "@/ui/icons/glyphs/attachment";
import { IconClose } from "@/ui/icons/glyphs/close";
import { IconCompare } from "@/ui/icons/glyphs/compare";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconFile } from "@/ui/icons/glyphs/file";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconUpload } from "@/ui/icons/glyphs/upload";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../../shared/links";
import { uploadOwnerFile, whenScanned } from "../../shared/upload";
import { ExportButton } from "../../shared/ExportButton";
import {
  importProblem,
  rollbackBlocker,
  normaliseDeclared,
  NOTE_MAX,
  problemStep,
  reconcileProblem,
  type ReconcileProblem,
} from "./wizard";

type Job = Schemas["JuristicImportJobDto"];
type UploadSheet = Schemas["ImportUploadSheet"];
const MAX_BYTES = 5 * 1024 * 1024;
const EVIDENCE_BYTES = 10 * 1024 * 1024;
const SPREADSHEETS = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const EVIDENCE = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

/** A hidden file input that takes its `<Field>`'s id and descriptions, opened by a visible button. */
function FieldFileInput({
  inputRef,
  accept,
  onFile,
  testId,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  onFile: (file: File) => void;
  testId?: string;
}) {
  const field = useFieldProps();
  return (
    <input
      {...field}
      ref={inputRef}
      type="file"
      accept={accept}
      className="sr-only"
      onChange={(event) => {
        const chosen = event.target.files?.[0];
        event.target.value = "";
        if (chosen) onFile(chosen);
      }}
      data-testid={testId}
    />
  );
}

const jobPath = (locale: Locale, jobId: string, query = "") => ownerPath(locale, `/juristic/import/${jobId}${query}`);

/**
 * A refusal of an import operation in the wizard's own words with the one next step that resolves it (JW3a,
 * `importProblem`); anything else falls back to the API's own problem notice.
 */
export function ImportProblem({
  error,
  jobId,
  openJobId,
}: {
  error: unknown;
  jobId?: string;
  openJobId?: string | null;
}) {
  const t = useTranslations("owner.imports.problem");
  const locale = useLocale() as Locale;
  if (!error) return null;
  const mapped = isApiError(error) ? importProblem(error.code) : null;
  if (!mapped) return <ProblemNotice error={error} />;
  const problem = isApiError(error) ? error.problem : {};
  // J-CR (D-335): `import.job_open` names the open job, `import.rollback_blocked` the table that still refers to it.
  const openJob = problem.jobId ?? openJobId ?? null;
  const blocker = mapped.key === "rollback_blocked" ? rollbackBlocker(problem.table) : null;
  const step = problemStep(mapped.next);
  const href =
    mapped.next === "open_job" && openJob
      ? jobPath(locale, openJob)
      : step && jobId
        ? jobPath(
            locale,
            jobId,
            `?step=${step}${mapped.next === "to_differences" ? "&diff=unexplained#differences" : mapped.next === "to_cycle" ? "#parallel" : ""}`,
          )
        : mapped.next === "reload" && jobId
          ? jobPath(locale, jobId)
          : null;
  return (
    <div
      role="alert"
      data-testid="import-problem"
      data-code={isApiError(error) ? error.code : undefined}
      data-blocker={blocker ?? undefined}
    >
      <Callout tone={mapped.next === null ? "danger" : "warning"} title={t(`${mapped.key}.title`)}>
        <p>
          {blocker
            ? t("rollback_blocked.blockedBy", { what: t(`rollback_blocked.table.${blocker}`) })
            : t(`${mapped.key}.body`)}
        </p>
        {href ? (
          <a className="text-primary mt-1 inline-block font-medium underline-offset-4 hover:underline" href={href}>
            {mapped.key === "job_open" && problem.jobNumber !== undefined
              ? t("job_open.nextNumbered", { number: problem.jobNumber })
              : t(`${mapped.key}.next`)}
          </a>
        ) : null}
        {isApiError(error) && error.requestId ? (
          <p className="text-muted mt-1 font-mono text-xs">{error.requestId}</p>
        ) : null}
      </Callout>
    </div>
  );
}

/** Starts a job: the building (one open or committed job each — those buildings say so and cannot be chosen), the legacy cut-off, a note. */
export function StartImportButton({
  buildings,
  defaultBuildingId,
  today,
  variant = "primary",
}: {
  buildings: { id: string; name: string; openJob: { id: string; number: number } | null }[];
  defaultBuildingId?: string;
  today: string;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("owner.imports.start");
  const locale = useLocale() as Locale;
  const first =
    buildings.find((building) => building.id === defaultBuildingId && !building.openJob) ??
    buildings.find((building) => !building.openJob);
  return (
    <FormDialog
      label={t("button")}
      icon={IconAdd}
      variant={variant}
      testId={variant === "primary" ? "import-start" : "import-start-empty"}
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={(data) => {
        const buildingId = text(data, "buildingId");
        const chosen = buildings.find((building) => building.id === buildingId);
        if (!chosen) invalidField("buildingId", t("error.building"));
        if (chosen!.openJob) invalidField("buildingId", t("error.open", { number: chosen!.openJob.number }));
        const asOfDate = text(data, "asOfDate");
        if (!asOfDate) invalidField("asOfDate", t("error.asOf"));
        if (asOfDate! > today) invalidField("asOfDate", t("error.future"));
        return unwrap(
          browserApi().POST("/v1/owner/juristic/imports", {
            body: {
              buildingId: buildingId!,
              asOfDate: asOfDate!,
              ...(text(data, "note") ? { note: text(data, "note") } : {}),
            },
          }),
        );
      }}
      onDone={(result) => window.location.assign(jobPath(locale, (result as Job).id))}
    >
      {(errors) => (
        <>
          <Field label={t("building")} hint={t("buildingHint")} required error={errors.buildingId}>
            <NativeSelect
              name="buildingId"
              defaultValue={first?.id}
              options={buildings.map((building) => ({
                value: building.id,
                label: building.openJob
                  ? t("buildingOpen", { name: building.name, number: building.openJob.number })
                  : building.name,
                disabled: !!building.openJob,
              }))}
              data-testid="import-building"
            />
          </Field>
          <Field label={t("asOf")} hint={t("asOfHint")} required error={errors.asOfDate}>
            <DateField name="asOfDate" max={today} />
          </Field>
          <Field label={t("note")} hint={t("noteHint")}>
            <Textarea name="note" rows={2} maxLength={2000} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * One sheet's file (Stitch dataset chip): no file → a drop zone (drag or choose, CSV / XLSX ≤ 5 MB); a file → the chip
 * with its name, rows, errors / warnings and replace / remove. Upload = presign → PUT → the job's `files` (the API
 * re-validates the whole job and answers it; the page then shows what the API holds).
 */
export function SheetUpload({
  jobId,
  buildingId,
  sheet,
  file,
  canEdit,
  label,
}: {
  jobId: string;
  buildingId: string;
  sheet: UploadSheet;
  file: Schemas["JuristicImportFileDto"] | null;
  canEdit: boolean;
  label: string;
}) {
  const t = useTranslations("owner.imports.upload");
  const action = useApiAction<Job>();
  const replace = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [tooLarge, setTooLarge] = useState(false);
  const send = (chosen: File) => {
    setTooLarge(false);
    setSending(chosen.name);
    void action
      .run(async () => {
        const stored = await uploadOwnerFile(chosen, {
          kind: "other",
          scopeType: "building",
          scopeId: buildingId,
          title: chosen.name,
        });
        return whenScanned(() =>
          unwrap(
            browserApi().POST("/v1/owner/juristic/imports/{importId}/files", {
              params: { path: { importId: jobId } },
              body: { sheet, fileId: stored.id },
            }),
          ),
        );
      })
      .finally(() => setSending(null));
  };
  const remove = () =>
    void action.run(() =>
      unwrap(
        browserApi().DELETE("/v1/owner/juristic/imports/{importId}/files/{sheet}", {
          params: { path: { importId: jobId, sheet } },
        }),
      ),
    );
  return (
    <div className="flex flex-col gap-2" data-testid={`sheet-${sheet}`} data-state={file ? "uploaded" : "empty"}>
      {file ? (
        <div
          className="border-border bg-surface rounded-control flex flex-wrap items-center gap-x-4 gap-y-2 border px-4 py-3"
          data-testid="file-chip"
        >
          <Icon icon={IconFile} size={20} className="text-subtle shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium" title={file.fileName}>
              {sending ?? file.fileName}
            </span>
            <span className="text-muted text-sm">{sending ? t("checking") : t("rows", { count: file.rowCount })}</span>
          </span>
          {!sending ? (
            <span className="flex flex-wrap items-center gap-1.5" data-testid="file-chip-state">
              {file.errorCount > 0 ? (
                <Badge tone="danger" size="sm" icon={IconAlert}>
                  {t("errors", { count: file.errorCount })}
                </Badge>
              ) : (
                <Badge tone="success" size="sm">
                  {t("clean")}
                </Badge>
              )}
              {file.warningCount > 0 ? (
                <Badge tone="warning" size="sm">
                  {t("warnings", { count: file.warningCount })}
                </Badge>
              ) : null}
            </span>
          ) : null}
          {canEdit ? (
            <span className="flex shrink-0 items-center gap-1">
              <input
                ref={replace}
                type="file"
                accept={SPREADSHEETS}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  event.target.value = "";
                  if (!chosen) return;
                  // Review W7: a file over the limit is refused in words, never dropped silently.
                  if (chosen.size > MAX_BYTES) setTooLarge(true);
                  else send(chosen);
                }}
                data-testid="file-replace-input"
              />
              <Button
                variant="ghost"
                size="sm"
                iconStart={IconRefresh}
                loading={!!sending}
                onClick={() => replace.current?.click()}
                data-testid="file-replace"
              >
                {t("replace")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconStart={IconDelete}
                disabled={!!sending || action.busy}
                onClick={remove}
                data-testid="file-remove"
                aria-label={t("removeLabel", { sheet: label })}
              >
                {t("remove")}
              </Button>
            </span>
          ) : null}
        </div>
      ) : canEdit ? (
        sending ? (
          <div
            className="border-border bg-bg-subtle rounded-card flex min-h-28 items-center justify-center gap-2 border-2 border-dashed p-4 text-sm"
            role="status"
          >
            <Icon icon={IconUpload} size={18} className="text-subtle" />
            {t("sending", { name: sending })}
          </div>
        ) : (
          <FileDropzone
            label={t("drop", { sheet: label })}
            hint={t("dropHint")}
            accept={SPREADSHEETS}
            maxBytes={MAX_BYTES}
            tooLargeText={t("tooLarge")}
            chooseText={t("choose")}
            onFiles={(files) => files[0] && send(files[0])}
            data-testid={`dropzone-${sheet}`}
          />
        )
      ) : (
        <p className="text-muted m-0 text-sm">{t("none")}</p>
      )}
      {file && tooLarge ? (
        <div data-testid="file-too-large">
          <FieldError alert className="m-0">
            {t("tooLarge")}
          </FieldError>
        </div>
      ) : null}
      <ImportProblem error={action.error} jobId={jobId} />
    </div>
  );
}

/** Re-reads every file and re-checks the job against the building as it is now (`actions/validate`). */
export function RevalidateButton({
  jobId,
  variant = "secondary",
  block,
}: {
  jobId: string;
  variant?: "primary" | "secondary";
  block?: boolean;
}) {
  const t = useTranslations("owner.imports.validate");
  const action = useApiAction<Job>();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        iconStart={IconRefresh}
        loading={action.busy}
        className={block ? "w-full" : undefined}
        onClick={() =>
          void action.run(() =>
            whenScanned(() =>
              unwrap(
                browserApi().POST("/v1/owner/juristic/imports/{importId}/actions/validate", {
                  params: { path: { importId: jobId } },
                }),
              ),
            ),
          )
        }
        data-testid="import-revalidate"
      >
        {t("again")}
      </Button>
      <ImportProblem error={action.error} jobId={jobId} />
    </div>
  );
}

/**
 * The reconcile form (Stitch step 3): the legacy system's declared total of receivables; when an item differs, the
 * explanation — a note (10–2000) and an attachment, together (D-332 (4)). The attachment button keeps one line at a
 * fixed minimum width (J-DESIGN §3). The blocks themselves are the API's answer, rendered by the page above the form.
 */
export function ReconcileForm({
  jobId,
  buildingId,
  reconciliation,
  readOnly,
}: {
  jobId: string;
  buildingId: string;
  reconciliation: Schemas["JuristicImportReconciliationDto"] | null;
  readOnly: boolean;
}) {
  const t = useTranslations("owner.imports.reconcileForm");
  const locale = useLocale() as Locale;
  const action = useApiAction<Job>();
  const attach = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const required = !!reconciliation?.explanationRequired;
  const [declared, setDeclared] = useState(reconciliation?.declaredReceivables ?? "");
  const [note, setNote] = useState(reconciliation?.note ?? "");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [evidenceTooLarge, setEvidenceTooLarge] = useState(false);
  const [keptDocument, setKeptDocument] = useState<string | null>(reconciliation?.documentId ?? null);
  const [problem, setProblem] = useState<ReconcileProblem | null>(null);
  const [touched, setTouched] = useState(false);
  const hasAttachment = !!evidence || !!keptDocument;
  const check = () =>
    reconcileProblem({
      declared: normaliseDeclared(declared) ?? (declared.trim() ? "x" : ""),
      note,
      hasAttachment,
      explanationRequired: required,
    });
  const declaredError =
    touched && (problem === "declared_missing" || problem === "declared_invalid") ? t(`problem.${problem}`) : undefined;
  const noteError =
    touched && (problem === "note" || problem === "note_short" || problem === "note_long")
      ? t(`problem.${problem}`, { max: NOTE_MAX })
      : undefined;
  const attachmentError = evidenceTooLarge
    ? t("attachTooLarge")
    : touched && problem === "attachment"
      ? t("problem.attachment")
      : undefined;
  const submit = () => {
    setTouched(true);
    const found = check();
    setProblem(found);
    if (found) {
      summary.current?.focus();
      return;
    }
    void action.run(
      async () => {
        const documentId = evidence
          ? (
              await uploadOwnerFile(evidence, {
                kind: "other",
                scopeType: "building",
                scopeId: buildingId,
                title: evidence.name,
              })
            ).id
          : keptDocument;
        return whenScanned(() =>
          unwrap(
            browserApi().POST("/v1/owner/juristic/imports/{importId}/actions/reconcile", {
              params: { path: { importId: jobId } },
              body: {
                declaredReceivables: normaliseDeclared(declared)!,
                ...(note.trim() ? { note: note.trim(), documentId } : {}),
              },
            }),
          ),
        );
      },
      () => {
        setEvidence(null);
        setTouched(false);
      },
    );
  };
  if (readOnly) return null;
  const showExplanation = required || !!note || hasAttachment;
  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      data-testid="reconcile-form"
    >
      {touched && problem ? (
        <div ref={summary} tabIndex={-1} role="alert" className="outline-none" data-testid="reconcile-error-summary">
          <Callout tone="danger" title={t("summaryTitle")}>
            <a
              href={
                problem.startsWith("declared")
                  ? "#reconcile-declared"
                  : problem === "attachment"
                    ? "#reconcile-attach"
                    : "#reconcile-note"
              }
              className="underline underline-offset-4"
            >
              {t(`problem.${problem}`, { max: NOTE_MAX })}
            </a>
          </Callout>
        </div>
      ) : (
        <div ref={summary} tabIndex={-1} className="outline-none" />
      )}
      <h3 className="border-border border-t pt-5 text-base font-semibold">{t("heading")}</h3>
      <div id="reconcile-declared">
        <Field label={t("declared")} hint={t("declaredHint")} required error={declaredError}>
          <Input
            value={declared}
            inputMode="decimal"
            autoComplete="off"
            className="text-end tabular-nums sm:max-w-xs"
            onChange={(event) => setDeclared(event.target.value)}
            onBlur={() => touched && setProblem(check())}
            data-testid="reconcile-declared"
          />
        </Field>
      </div>
      {showExplanation ? (
        <div
          className="border-border rounded-card flex flex-col gap-4 border p-4 sm:p-5"
          data-testid="reconcile-explanation"
        >
          <div id="reconcile-note">
            <Field label={t("note")} hint={t("noteHint")} required={required} error={noteError}>
              <Textarea
                rows={3}
                maxLength={NOTE_MAX}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onBlur={() => touched && setProblem(check())}
                data-testid="reconcile-note"
              />
            </Field>
          </div>
          <div id="reconcile-attach">
            <Field label={t("attachment")} hint={t("attachHint")} required={required} error={attachmentError}>
              <div className="flex flex-wrap items-center gap-3">
                <FieldFileInput
                  inputRef={attach}
                  accept={EVIDENCE}
                  onFile={(chosen) => {
                    // Review W7: over 10 MB is said on the field, never ignored.
                    setEvidenceTooLarge(chosen.size > EVIDENCE_BYTES);
                    if (chosen.size > EVIDENCE_BYTES) return;
                    setEvidence(chosen);
                    setKeptDocument(null);
                  }}
                  testId="reconcile-attach-input"
                />
                <Button
                  variant="secondary"
                  iconStart={IconAttachment}
                  className="min-w-40 shrink-0 whitespace-nowrap"
                  onClick={() => attach.current?.click()}
                  data-testid="reconcile-attach"
                >
                  {hasAttachment ? t("attachAnother") : t("attach")}
                </Button>
                {evidence || keptDocument ? (
                  <span
                    className="bg-primary-subtle text-primary-subtle-fg rounded-control flex min-w-0 items-center gap-2 py-2 ps-3 pe-1.5 text-sm"
                    data-testid="reconcile-attachment"
                  >
                    <Icon icon={IconFile} size={16} className="shrink-0" />
                    <span className="truncate font-medium">{evidence ? evidence.name : t("kept")}</span>
                    {evidence ? (
                      <span className="whitespace-nowrap opacity-80">{formatBytes(evidence.size, locale)}</span>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-thumb grid size-7 place-items-center hover:bg-current/10"
                      aria-label={t("removeAttachment")}
                      onClick={() => {
                        setEvidence(null);
                        setKeptDocument(null);
                      }}
                    >
                      <Icon icon={IconClose} size={14} />
                    </button>
                  </span>
                ) : null}
              </div>
            </Field>
          </div>
        </div>
      ) : null}
      <ImportProblem error={action.error} jobId={jobId} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={action.busy} iconStart={IconCompare} data-testid="reconcile-submit">
          {reconciliation ? (required ? t("submitExplained") : t("again")) : t("submit")}
        </Button>
        {reconciliation ? <span className="text-muted text-sm">{t("rerunHint")}</span> : null}
      </div>
    </form>
  );
}

/**
 * Commits the job (Idempotency-Key): the building's name typed to confirm; the bill-to consent document when the
 * register names a bill-to (one scan of the owners' signed consents covers the batch, 422
 * `import.bill_to_consent_required`).
 */
export function CommitButton({ job, needsConsent, building }: { job: Job; needsConsent: boolean; building: string }) {
  const t = useTranslations("owner.imports.commit");
  const [consent, setConsent] = useState<File | null>(null);
  return (
    <ConfirmAction
      label={t("button")}
      block
      testId="import-commit"
      title={t("title", { building })}
      description={t("body", { units: job.totals?.units ?? 0, invoices: job.totals?.openingInvoices ?? 0 })}
      confirmLabel={t("confirm")}
      phrase={building}
      ready={!needsConsent || !!consent}
      onConfirm={async (key) => {
        const documentId = consent
          ? (
              await uploadOwnerFile(consent, {
                kind: "other",
                scopeType: "building",
                scopeId: job.buildingId,
                title: consent.name,
              })
            ).id
          : null;
        return whenScanned(() =>
          unwrap(
            browserApi().POST("/v1/owner/juristic/imports/{importId}/actions/commit", {
              params: { path: { importId: job.id }, header: { "Idempotency-Key": key } },
              body: documentId ? { billToConsentDocumentId: documentId } : {},
            }),
          ),
        );
      }}
      explain={(error) =>
        isApiError(error) && importProblem(error.code) ? <ImportProblem error={error} jobId={job.id} /> : null
      }
      successMessage={t("done")}
    >
      {needsConsent ? (
        <div className="flex flex-col gap-2" data-testid="commit-consent">
          <p className="m-0 text-sm">{t("consentBody", { count: job.totals?.billTos ?? 0 })}</p>
          {consent ? (
            <span className="bg-primary-subtle text-primary-subtle-fg rounded-control flex items-center gap-2 py-2 ps-3 pe-1.5 text-sm">
              <Icon icon={IconFile} size={16} />
              <span className="min-w-0 flex-1 truncate font-medium">{consent.name}</span>
              <button
                type="button"
                className="rounded-thumb grid size-7 place-items-center hover:bg-current/10"
                aria-label={t("consentRemove")}
                onClick={() => setConsent(null)}
              >
                <Icon icon={IconClose} size={14} />
              </button>
            </span>
          ) : (
            <FileDropzone
              label={t("consent")}
              hint={t("consentHint")}
              accept={EVIDENCE}
              maxBytes={EVIDENCE_BYTES}
              tooLargeText={t("consentTooLarge")}
              chooseText={t("consentChoose")}
              onFiles={(files) => setConsent(files[0] ?? null)}
              data-testid="commit-consent-file"
            />
          )}
        </div>
      ) : null}
    </ConfirmAction>
  );
}

/** Cancels a job before its commit: the files are dropped, nothing was created. */
export function CancelImportButton({ job }: { job: Job }) {
  const t = useTranslations("owner.imports.cancel");
  return (
    <ConfirmAction
      label={t("button")}
      variant="destructive"
      tone="destructive"
      block
      icon={IconXCircle}
      testId="import-cancel"
      title={t("title", { number: job.number })}
      description={t("body", { building: job.buildingName })}
      confirmLabel={t("confirm")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/imports/{importId}/actions/cancel", {
            params: { path: { importId: job.id } },
          }),
        )
      }
      explain={(error) =>
        isApiError(error) && importProblem(error.code) ? <ImportProblem error={error} jobId={job.id} /> : null
      }
      successMessage={t("done")}
    />
  );
}

/**
 * Rolls a committed job back (Idempotency-Key): exactly what the commit created is deleted, newest first — the reason
 * (5–1000) and the building's name typed. Refused (`import.rollback_blocked`) when another record now refers to it.
 */
export function RollbackButton({ job, created }: { job: Job; created: string }) {
  const t = useTranslations("owner.imports.rollback");
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= 5 && reason.trim().length <= 1000;
  return (
    <ConfirmAction
      label={t("button")}
      variant="destructive"
      tone="destructive"
      block
      icon={IconUndo}
      testId="import-rollback"
      title={t("title", { building: job.buildingName })}
      description={t("body", { created })}
      confirmLabel={t("confirm")}
      phrase={job.buildingName}
      ready={ok}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/imports/{importId}/actions/rollback", {
            params: { path: { importId: job.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
      explain={(error) =>
        isApiError(error) && importProblem(error.code) ? <ImportProblem error={error} jobId={job.id} /> : null
      }
      successMessage={t("done")}
    >
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          data-testid="rollback-reason"
        />
      </Field>
    </ConfirmAction>
  );
}

/**
 * Go-live (Idempotency-Key): the opening balances are issued (series OPB) and sent unless the office turns the notice
 * off, the bank opening balances are booked, the rollback window closes. Disabled with the reason until the
 * checklist is complete; acknowledging unexplained differences is offered only where the setting allows it.
 */
export function GoLiveButton({
  job,
  ready,
  needsAcknowledgement,
  unexplained,
}: {
  job: Job;
  ready: boolean;
  needsAcknowledgement: boolean;
  unexplained: number;
}) {
  const t = useTranslations("owner.imports.golive");
  const [notify, setNotify] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <ConfirmAction
      label={t("button")}
      block
      icon={IconFlag}
      disabled={!ready}
      testId="import-golive"
      title={t("title", { building: job.buildingName })}
      description={t("body", { invoices: job.created.invoice ?? job.totals?.openingInvoices ?? 0 })}
      confirmLabel={t("confirm")}
      phrase={job.buildingName}
      ready={!needsAcknowledgement || acknowledged}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/imports/{importId}/actions/go-live", {
            params: { path: { importId: job.id }, header: { "Idempotency-Key": key } },
            body: { notifyOpeningBalances: notify, acknowledgeDifferences: needsAcknowledgement && acknowledged },
          }),
        )
      }
      explain={(error) =>
        isApiError(error) && importProblem(error.code) ? <ImportProblem error={error} jobId={job.id} /> : null
      }
      successMessage={t("done")}
    >
      <div className="flex flex-col gap-3">
        <Checkbox
          checked={notify}
          onCheckedChange={(checked) => setNotify(checked === true)}
          label={t("notify")}
          description={notify ? t("notifyOn") : t("notifyOff")}
          data-testid="golive-notify"
        />
        {needsAcknowledgement ? (
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            label={t("acknowledge", { count: unexplained })}
            description={t("acknowledgeHint")}
            data-testid="golive-acknowledge"
          />
        ) : null}
      </div>
    </ConfirmAction>
  );
}

/**
 * The parallel cycle (D-313): a billing cycle of the building's property — open one, compute it — and the legacy
 * system's bills for the same period; the API compares them unit by unit. Nothing is issued while the import waits
 * for go-live (the building issues no invoice, `import.go_live_pending`).
 */
export function ParallelCycleForm({
  jobId,
  buildingId,
  propertyId,
  cycles,
  defaultCycleId,
  hasReport,
  periodLabels,
}: {
  jobId: string;
  buildingId: string;
  propertyId: string | null;
  cycles: { id: string; status: Schemas["BillingCycleStatus"]; label: string }[];
  defaultCycleId: string | null;
  hasReport: boolean;
  periodLabels: Record<string, string>;
}) {
  const t = useTranslations("owner.imports.parallel");
  const action = useApiAction();
  const cycleAction = useApiAction();
  const usable = cycles.filter((cycle) => cycle.status === "open" || cycle.status === "computed");
  const [cycleId, setCycleId] = useState<string>(
    defaultCycleId ?? usable.find((cycle) => cycle.status === "computed")?.id ?? usable[0]?.id ?? "",
  );
  const [legacy, setLegacy] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const chosen = usable.find((cycle) => cycle.id === cycleId);
  const compare = () => {
    setTouched(true);
    if (!chosen || chosen.status !== "computed" || !legacy) return;
    void action.run(
      async () => {
        const stored = await uploadOwnerFile(legacy, {
          kind: "other",
          scopeType: "building",
          scopeId: buildingId,
          title: legacy.name,
        });
        return whenScanned(() =>
          unwrap(
            browserApi().POST("/v1/owner/juristic/imports/{importId}/parallel-cycle", {
              params: { path: { importId: jobId } },
              body: { billingCycleId: chosen.id, fileId: stored.id },
            }),
          ),
        );
      },
      () => setLegacy(null),
    );
  };
  return (
    <div className="flex flex-col gap-5" data-testid="parallel-form">
      {usable.length === 0 ? (
        <div className="bg-bg-subtle rounded-card flex flex-col gap-3 p-4" data-testid="parallel-no-cycle">
          <p className="m-0 text-sm">{t("noCycle")}</p>
          {propertyId ? (
            <Button
              variant="secondary"
              className="w-fit"
              loading={cycleAction.busy}
              onClick={() =>
                void cycleAction.run(() =>
                  unwrap(browserApi().POST("/v1/owner/billing-cycles", { body: { propertyId } })),
                )
              }
              data-testid="parallel-open-cycle"
            >
              {t("openCycle")}
            </Button>
          ) : null}
        </div>
      ) : (
        <Field
          label={t("cycle")}
          hint={t("cycleHint")}
          required
          error={touched && !chosen ? t("cycleMissing") : undefined}
        >
          <NativeSelect
            value={cycleId}
            onChange={(event) => setCycleId(event.target.value)}
            options={usable.map((cycle) => ({
              value: cycle.id,
              label: `${cycle.label} · ${periodLabels[cycle.status] ?? cycle.status}`,
            }))}
            data-testid="parallel-cycle"
          />
        </Field>
      )}
      {chosen && chosen.status === "open" ? (
        <div className="flex flex-wrap items-center gap-3" data-testid="parallel-compute">
          <p className="text-muted m-0 text-sm">{t("computeFirst")}</p>
          <Button
            variant="secondary"
            size="sm"
            iconStart={IconRefresh}
            loading={cycleAction.busy}
            onClick={() =>
              void cycleAction.run(() =>
                unwrap(
                  browserApi().POST("/v1/owner/billing-cycles/{billingCycleId}/actions/compute", {
                    params: { path: { billingCycleId: chosen.id } },
                  }),
                ),
              )
            }
            data-testid="parallel-compute-button"
          >
            {t("compute")}
          </Button>
        </div>
      ) : null}
      <ProblemNotice error={cycleAction.error} />
      <Field label={t("legacyFile")} required error={touched && !legacy ? t("legacyMissing") : undefined}>
        <div className="flex flex-col gap-2">
          {legacy ? (
            <span
              className="border-border rounded-control flex items-center gap-3 border px-4 py-3"
              data-testid="parallel-legacy-chip"
            >
              <Icon icon={IconFile} size={18} className="text-subtle" />
              <span className="min-w-0 flex-1 truncate font-medium">{legacy.name}</span>
              <Button variant="ghost" size="sm" iconStart={IconClose} onClick={() => setLegacy(null)}>
                {t("removeFile")}
              </Button>
            </span>
          ) : (
            <FileDropzone
              label={t("legacyDrop")}
              hint={t("legacyHint")}
              accept={SPREADSHEETS}
              maxBytes={MAX_BYTES}
              tooLargeText={t("tooLarge")}
              chooseText={t("choose")}
              onFiles={(files) => setLegacy(files[0] ?? null)}
              data-testid="parallel-legacy"
            />
          )}
        </div>
      </Field>
      <ImportProblem error={action.error} jobId={jobId} />
      <div>
        <Button
          variant={hasReport ? "secondary" : "primary"}
          iconStart={IconCompare}
          loading={action.busy}
          disabled={!chosen || chosen.status !== "computed"}
          onClick={compare}
          data-testid="parallel-compare"
        >
          {hasReport ? t("compareAgain") : t("compare")}
        </Button>
      </div>
    </div>
  );
}

/** Explains one unit's difference (5–1000 characters); an explained one can be reworded until go-live. */
export function ExplainDifferenceButton({ jobId, row }: { jobId: string; row: Schemas["JuristicCycleDifferenceDto"] }) {
  const t = useTranslations("owner.imports.explain");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={row.explanation ? t("edit") : t("button")}
      icon={row.explanation ? IconEdit : undefined}
      size="sm"
      variant={row.explanation ? "ghost" : "secondary"}
      testId="difference-explain"
      title={t("title", { unit: row.unitNo })}
      description={t("body", { computed: formatTHB(row.computed, locale), legacy: formatTHB(row.legacy, locale) })}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={(data) => {
        const explanation = text(data, "explanation") ?? "";
        if (explanation.length < 5) invalidField("explanation", t("short"));
        return unwrap(
          browserApi().POST(
            "/v1/owner/juristic/imports/{importId}/parallel-cycle/differences/{differenceId}/actions/explain",
            {
              params: { path: { importId: jobId, differenceId: row.id } },
              body: { explanation },
            },
          ),
        );
      }}
    >
      {(errors) => (
        <Field label={t("label")} hint={t("hint")} required error={errors.explanation}>
          <Textarea
            name="explanation"
            rows={3}
            maxLength={1000}
            defaultValue={row.explanation ?? ""}
            data-testid="difference-explanation-input"
          />
        </Field>
      )}
    </FormDialog>
  );
}

/** Every juristic table, the register and the billing tables as one ZIP of CSVs — built by the export worker. */
export function FullExportButton() {
  const t = useTranslations("owner.imports.export");
  return (
    <ExportButton
      kind="juristic_full_export"
      params={{}}
      label={t("button")}
      testId="full-export"
      create={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/export", { params: { header: { "Idempotency-Key": idempotencyKey } } }),
        )
      }
    />
  );
}
