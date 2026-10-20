"use client";

import { useTranslations } from "next-intl";

import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconEdit } from "@/ui/icons/glyphs/edit";

const BASELINE: (keyof Schemas["PilotBaselineDto"])[] = [
  "timeToBillHours",
  "invoiceCorrectionRatePct",
  "onTimePaymentPct",
  "autoReconciledPct",
  "lossPct",
  "meterUptimePct",
  "csat",
];

/**
 * The pilot agreement (D-083, `PUT /v1/admin/tenants/{id}/pilot-agreement`): signed date, term, the
 * discount (a paid pilot — never 100 %), reference-site rights, anonymised data use, feedback cadence,
 * the 90-day review date, and the baseline the seven KPIs are compared against. The discount reaches
 * every platform invoice as a line the API computes.
 */
export function PilotForm({ tenantId, pilot }: { tenantId: string; pilot: Schemas["PilotAgreementDto"] | null }) {
  const t = useTranslations("admin.tenants.pilot");
  const baseline = (pilot?.baseline ?? {}) as Partial<Record<keyof Schemas["PilotBaselineDto"], string | null>>;
  return (
    <FormDialog
      label={pilot ? t("edit") : t("create")}
      icon={IconEdit}
      variant={pilot ? "secondary" : "primary"}
      testId="pilot-edit"
      title={pilot ? t("editTitle") : t("createTitle")}
      description={t("formHint")}
      submitLabel={t("save")}
      size_="lg"
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PUT("/v1/admin/tenants/{tenantId}/pilot-agreement", {
            params: { path: { tenantId } },
            body: {
              signedOn: text(data, "signedOn") ?? "",
              termMonths: integer(data, "termMonths") ?? 3,
              discountPct: text(data, "discountPct") ?? "0",
              referenceSiteRights: data.get("referenceSiteRights") === "on",
              anonymisedDataUse: data.get("anonymisedDataUse") === "on",
              feedbackCadence: text(data, "feedbackCadence") ?? "biweekly",
              kpiReviewOn: text(data, "kpiReviewOn") ?? null,
              notes: text(data, "notes") ?? null,
              baseline: Object.fromEntries(BASELINE.map((key) => [key, text(data, `baseline.${key}`) ?? null])),
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("signedOn")} required error={errors.signedOn}>
              <Input name="signedOn" type="date" required defaultValue={pilot?.signedOn} />
            </Field>
            <Field label={t("termMonths")} required error={errors.termMonths}>
              <Input name="termMonths" type="number" min={1} max={24} required defaultValue={pilot?.termMonths ?? 3} />
            </Field>
            <Field label={t("discountPct")} hint={t("discountHint")} required error={errors.discountPct}>
              <Input
                name="discountPct"
                inputMode="decimal"
                pattern="\d{1,2}(\.\d{1,2})?"
                required
                defaultValue={pilot?.discountPct}
                data-testid="pilot-discount"
              />
            </Field>
            <Field label={t("kpiReviewOn")} hint={t("kpiReviewHint")} error={errors.kpiReviewOn}>
              <Input name="kpiReviewOn" type="date" defaultValue={pilot?.kpiReviewOn} />
            </Field>
            <Field label={t("cadence")} error={errors.feedbackCadence}>
              <NativeSelect
                name="feedbackCadence"
                defaultValue={pilot?.feedbackCadence ?? "biweekly"}
                options={["weekly", "biweekly", "monthly"].map((value) => ({
                  value,
                  label: t(`cadenceName.${value}`),
                }))}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-1">
            <Checkbox
              name="referenceSiteRights"
              label={t("referenceSite")}
              defaultChecked={pilot?.referenceSiteRights}
            />
            <Checkbox name="anonymisedDataUse" label={t("anonymisedData")} defaultChecked={pilot?.anonymisedDataUse} />
          </div>
          <FormSection title={t("baseline")} description={t("baselineHint")}>
            <div className="grid gap-4 sm:grid-cols-3">
              {BASELINE.map((key) => (
                <Field key={key} label={t(`kpi.${key}`)} error={errors[`baseline.${key}`]}>
                  <Input name={`baseline.${key}`} inputMode="decimal" defaultValue={baseline[key] ?? undefined} />
                </Field>
              ))}
            </div>
          </FormSection>
          <Field label={t("notes")} error={errors.notes}>
            <Textarea name="notes" rows={2} defaultValue={pilot?.notes ?? undefined} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
