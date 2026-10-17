"use client";

import { useTranslations } from "next-intl";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconEdit } from "@/ui/icons/glyphs/edit";

import { FormDialog, text } from "../shared/FormDialog";

/**
 * Manual unit status (D-171): only vacant ↔ inactive | maintenance, with a reason that is audited.
 * The choices offered follow the API's rule; the API refuses anything else.
 */
export function UnitStatusAction({ unit, onDone }: { unit: Schemas["UnitDto"]; onDone?: () => void }) {
  const t = useTranslations("owner.units.status");
  const statuses = useTranslations("status.unit");
  const choices: Schemas["ManualUnitStatus"][] = unit.status === "vacant" ? ["maintenance", "inactive"] : ["vacant"];
  return (
    <FormDialog
      label={t("change")}
      icon={IconEdit}
      size="sm"
      variant="ghost"
      testId="unit-status-change"
      title={t("title", { unit: unit.unitNo })}
      description={t("body")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onDone={onDone}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/units/{unitId}/actions/set-status", {
            params: { path: { unitId: unit.id } },
            body: {
              status: (text(data, "status") ?? choices[0]) as Schemas["ManualUnitStatus"],
              reason: text(data, "reason") ?? "",
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("status")} required error={errors.status}>
            <NativeSelect
              name="status"
              options={choices.map((status) => ({ value: status, label: statuses(status) }))}
            />
          </Field>
          <Field label={t("reason")} required hint={t("reasonHint")} error={errors.reason}>
            <Textarea name="reason" required rows={2} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
