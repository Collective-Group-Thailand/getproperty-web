"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";
import { IconUpload } from "@/ui/icons/glyphs/upload";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../../shared/links";
import { uploadOwnerFile } from "../../shared/upload";
import { decimalSatang, normaliseAmount } from "../accounting/money";

type Contract = Schemas["VendorContractDetailDto"];
const MAX_BYTES = 10 * 1024 * 1024;
const DOCUMENT_KINDS: readonly Schemas["ContractDocumentKind"][] = [
  "contract",
  "amendment",
  "insurance",
  "guarantee",
  "other",
];

/**
 * Draft → active (D-331): the API checks the quotation rule above the threshold, schedules the instalments inside the
 * term and from then on submits each one as an expense request `lead days` before it is due — requested by the person
 * who activates, so that person cannot approve them (maker ≠ checker).
 */
export function ActivateContractButton({
  contract,
  threshold,
  leadDays,
}: {
  contract: Contract;
  threshold: string | null;
  leadDays: number | null;
}) {
  const t = useTranslations("owner.vendors.contractAction");
  const locale = useLocale() as Locale;
  const value = decimalSatang(contract.value);
  const limit = threshold ? decimalSatang(threshold) : null;
  const above = value !== null && limit !== null && value > limit;
  return (
    <ConfirmAction
      label={t("activate")}
      icon={IconCheckCircle}
      block
      testId="contract-activate"
      title={t("activateTitle", { title: contract.title })}
      description={
        <span className="flex flex-col gap-2">
          <span>
            {t("activateBody", {
              vendor: contract.vendorName,
              from: formatDate(contract.startsOn, locale),
              to: formatDate(contract.endsOn, locale),
              value: formatTHB(contract.value, locale),
            })}
          </span>
          {contract.instalmentPlan ? (
            <span>
              {leadDays !== null ? t("activatePlan", { days: leadDays }) : t("activatePlanNoLead")} {t("activateMaker")}
            </span>
          ) : null}
          {above && threshold ? <span>{t("activateRule", { threshold: formatTHB(threshold, locale) })}</span> : null}
        </span>
      }
      confirmLabel={t("activate")}
      successMessage={t("activated")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/vendor-contracts/{contractId}/actions/activate", {
            params: { path: { contractId: contract.id }, header: { "Idempotency-Key": idempotencyKey } },
          }),
        )
      }
    />
  );
}

/**
 * One successor draft with the same terms for a new period (from the day after the current end unless given); the
 * value and the plan stay unless changed; an adopted resolution lets a renewal above the threshold activate without a
 * new quotation round. Opens the renewal draft.
 */
export function RenewContractButton({
  contract,
  resolutions,
  threshold,
  variant,
}: {
  contract: Contract;
  resolutions: { id: string; label: string }[];
  threshold: string | null;
  variant: "primary" | "secondary";
}) {
  const t = useTranslations("owner.vendors.contractAction");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("renew")}
      icon={IconRepeat}
      variant={variant}
      testId="contract-renew"
      title={t("renewTitle", { title: contract.title })}
      description={t("renewBody", { end: formatDate(contract.endsOn, locale) })}
      submitLabel={t("renewSubmit")}
      successMessage={t("renewed")}
      size_="lg"
      onSubmit={(data, _ack, idempotencyKey) => {
        const endsOn = text(data, "endsOn");
        if (!endsOn) invalidField("endsOn", t("error.endsOn"));
        const startsOn = text(data, "startsOn");
        if (startsOn && endsOn && endsOn <= startsOn) invalidField("endsOn", t("error.order"));
        const valueText = text(data, "value");
        const value = valueText ? normaliseAmount(valueText) : null;
        if (valueText && !value) invalidField("value", t("error.value"));
        const resolutionId = text(data, "resolutionId");
        return unwrap(
          browserApi().POST("/v1/owner/juristic/vendor-contracts/{contractId}/actions/renew", {
            params: { path: { contractId: contract.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              endsOn: endsOn!,
              ...(startsOn ? { startsOn } : {}),
              ...(value ? { value } : {}),
              ...(resolutionId ? { resolutionId } : {}),
            },
          }),
        );
      }}
      onDone={(result) => {
        const renewal = result as Contract;
        window.location.assign(ownerPath(locale, `/juristic/contracts/${renewal.id}`));
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("startsOn")} hint={t("startsOnHint")} error={errors.startsOn}>
              <DateField name="startsOn" min={contract.startsOn} />
            </Field>
            <Field label={t("endsOn")} required error={errors.endsOn}>
              <DateField name="endsOn" min={contract.endsOn} />
            </Field>
          </div>
          <Field
            label={t("value")}
            hint={t("valueHint", { value: formatTHB(contract.value, locale) })}
            error={errors.value}
          >
            <Input
              name="value"
              inputMode="decimal"
              className="text-end tabular-nums sm:max-w-xs"
              data-testid="renew-value"
            />
          </Field>
          <Field
            label={t("resolution")}
            hint={
              threshold ? t("resolutionHint", { threshold: formatTHB(threshold, locale) }) : t("resolutionHintPlain")
            }
            error={errors.resolutionId}
          >
            <NativeSelect
              name="resolutionId"
              defaultValue=""
              placeholder={resolutions.length ? t("resolutionPlaceholder") : t("noResolutions")}
              options={resolutions.map((resolution) => ({ value: resolution.id, label: resolution.label }))}
              data-testid="renew-resolution"
            />
          </Field>
          <p className="text-muted m-0 text-sm">{t("renewNote")}</p>
        </>
      )}
    </FormDialog>
  );
}

/**
 * Active → terminated with a reason, effective today or a later day up to the end: instalments due from then are
 * cancelled (requests already made stay — cancel them on the request), the contract's preventive plans stop. The
 * contract's title is typed to confirm (irreversible).
 */
export function TerminateContractButton({ contract, today }: { contract: Contract; today: string }) {
  const t = useTranslations("owner.vendors.contractAction");
  const locale = useLocale() as Locale;
  const [reason, setReason] = useState("");
  const [effectiveOn, setEffectiveOn] = useState<string | null>(today);
  const open = contract.expenseRequests.filter(
    (request) => request.state === "submitted" || request.state === "approved",
  );
  return (
    <ConfirmAction
      label={t("terminate")}
      icon={IconXCircle}
      variant="destructive"
      tone="destructive"
      block
      testId="contract-terminate"
      title={t("terminateTitle", { title: contract.title })}
      description={
        <span className="flex flex-col gap-2">
          <span>{t("terminateBody", { vendor: contract.vendorName, plans: contract.maintenancePlans.length })}</span>
          {open.length ? <span>{t("terminateOpen", { count: open.length })}</span> : null}
        </span>
      }
      confirmLabel={t("terminate")}
      phrase={t("terminatePhrase")}
      ready={reason.trim().length >= 3 && Boolean(effectiveOn)}
      successMessage={t("terminated")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/vendor-contracts/{contractId}/actions/terminate", {
            params: { path: { contractId: contract.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: { reason: reason.trim(), ...(effectiveOn ? { effectiveOn } : {}) },
          }),
        )
      }
    >
      <Field
        label={t("effectiveOn")}
        hint={t("effectiveOnHint", { end: formatDate(contract.endsOn, locale) })}
        required
      >
        <DateField
          name="effectiveOn"
          defaultValue={today}
          min={today}
          max={contract.endsOn}
          onChange={setEffectiveOn}
        />
      </Field>
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={1000}
          data-testid="contract-terminate-reason"
        />
      </Field>
    </ConfirmAction>
  );
}

/** Adds the signed contract, an amendment, insurance, a guarantee or another document (uploaded first). */
export function AttachContractButton({ contract }: { contract: Contract }) {
  const t = useTranslations("owner.vendors.contractAction");
  const kinds = useTranslations("owner.vendors.contract.documentKind");
  const common = useTranslations("owner.accounting.common");
  const [file, setFile] = useState<File | null>(null);
  return (
    <FormDialog
      label={t("attach")}
      icon={IconUpload}
      testId="contract-attach"
      title={t("attachTitle")}
      description={t("attachBody")}
      submitLabel={t("attachSubmit")}
      successMessage={t("attached")}
      onSubmit={async (data) => {
        if (!file) invalidField("file", t("error.file"));
        const stored = await uploadOwnerFile(file!, {
          kind: "other",
          scopeType: "building",
          scopeId: contract.buildingId,
          title: file!.name,
        });
        return unwrap(
          browserApi().POST("/v1/owner/juristic/vendor-contracts/{contractId}/documents", {
            params: { path: { contractId: contract.id } },
            body: { documentId: stored.id, kind: (text(data, "kind") ?? "other") as Schemas["ContractDocumentKind"] },
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
              defaultValue="contract"
              options={DOCUMENT_KINDS.map((value) => ({ value, label: kinds(value) }))}
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
