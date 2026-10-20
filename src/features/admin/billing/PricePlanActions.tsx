"use client";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheck } from "@/ui/icons/glyphs/check";

const UNITS: Schemas["PlanBillingUnit"][] = ["per_unit", "per_meter_point", "per_building", "per_tenant", "per_report"];

/** `POST /v1/admin/price-plans/{planId}/versions` — a draft version from a date not before today (D-204). */
export function NewPlanVersion({ planId, name, today }: { planId: string; name: string; today: string }) {
  const t = useTranslations("admin.billing.plans");
  return (
    <FormDialog
      label={t("newVersion")}
      icon={IconAdd}
      size="sm"
      testId="new-plan-version"
      title={t("newVersionTitle", { name })}
      description={t("newVersionHint")}
      submitLabel={t("saveDraft")}
      successMessage={t("draftSaved")}
      onSubmit={(data) => {
        const from = text(data, "priceFrom");
        const to = text(data, "priceTo");
        return unwrap(
          browserApi().POST("/v1/admin/price-plans/{planId}/versions", {
            params: { path: { planId }, header: { "Idempotency-Key": crypto.randomUUID() } },
            body: {
              effectiveFrom: text(data, "effectiveFrom") ?? today,
              billingUnit: (text(data, "billingUnit") as Schemas["PlanBillingUnit"]) ?? "per_unit",
              unitPrice: text(data, "unitPrice") ?? null,
              minUnits: integer(data, "minUnits") ?? null,
              minMonthly: text(data, "minMonthly") ?? null,
              setupFee: text(data, "setupFee"),
              termMonths: integer(data, "termMonths") ?? null,
              priceRange: from && to ? { from, to } : null,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("effectiveFrom")} required error={errors.effectiveFrom}>
            <Input name="effectiveFrom" type="date" min={today} defaultValue={today} required />
          </Field>
          <Field label={t("billingUnit")} required error={errors.billingUnit}>
            <NativeSelect name="billingUnit" options={UNITS.map((value) => ({ value, label: t(`unit.${value}`) }))} />
          </Field>
          <Field label={t("unitPrice")} hint={t("unitPriceHint")} error={errors.unitPrice}>
            <Input name="unitPrice" inputMode="decimal" pattern="\d+(\.\d{1,4})?" />
          </Field>
          <Field label={t("minUnits")} error={errors.minUnits}>
            <Input name="minUnits" type="number" min={0} />
          </Field>
          <Field label={t("minMonthly")} error={errors.minMonthly}>
            <Input name="minMonthly" inputMode="decimal" pattern="\d+(\.\d{1,2})?" />
          </Field>
          <Field label={t("setupFee")} error={errors.setupFee}>
            <Input name="setupFee" inputMode="decimal" pattern="\d+(\.\d{1,2})?" />
          </Field>
          <Field label={t("termMonths")} error={errors.termMonths}>
            <Input name="termMonths" type="number" min={1} max={120} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("priceFrom")} error={errors["priceRange.from"]}>
              <Input name="priceFrom" inputMode="decimal" />
            </Field>
            <Field label={t("priceTo")} error={errors["priceRange.to"]}>
              <Input name="priceTo" inputMode="decimal" />
            </Field>
          </div>
        </div>
      )}
    </FormDialog>
  );
}

/** Publish a draft version (never backdated: `settings.backdated`; published versions never change). */
export function PublishPlanVersion({ versionId, label }: { versionId: string; label: string }) {
  const t = useTranslations("admin.billing.plans");
  return (
    <ConfirmAction
      label={t("publish")}
      icon={IconCheck}
      size="sm"
      testId="publish-plan-version"
      title={t("publishTitle", { label })}
      description={t("publishBody")}
      confirmLabel={t("publish")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/admin/price-plans/versions/{versionId}/actions/publish", {
            params: { path: { versionId } },
          }),
        )
      }
      successMessage={t("published")}
    />
  );
}
