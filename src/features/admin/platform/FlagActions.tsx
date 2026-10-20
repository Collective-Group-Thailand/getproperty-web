"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Switch } from "@/ui/components/Switch";
import { IconEdit } from "@/ui/icons/glyphs/edit";

/**
 * A tenant's override of one feature flag (`PUT /v1/admin/feature-flags/{key}` with `tenantId`):
 * on, off, or back to the platform default (`enabled: null` removes the override); always with a
 * reason, which the audit row keeps.
 */
export function FlagOverride({
  flagKey,
  tenantId,
  override,
}: {
  flagKey: string;
  tenantId: string;
  override: boolean | null;
}) {
  const t = useTranslations("admin.platform.flags");
  return (
    <FormDialog
      label={t("override")}
      icon={IconEdit}
      size="sm"
      testId={`flag-override-${flagKey}`}
      title={t("overrideTitle", { key: flagKey })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) => {
        const choice = text(data, "enabled");
        return unwrap(
          browserApi().PUT("/v1/admin/feature-flags/{key}", {
            params: { path: { key: flagKey } },
            body: {
              tenantId,
              enabled: choice === "on" ? true : choice === "off" ? false : null,
              reason: text(data, "reason") ?? "",
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("value")} required error={errors.enabled}>
            <NativeSelect
              name="enabled"
              defaultValue={override === null ? "inherit" : override ? "on" : "off"}
              options={[
                { value: "inherit", label: t("inherit") },
                { value: "on", label: t("on") },
                { value: "off", label: t("off") },
              ]}
            />
          </Field>
          <Field label={t("reason")} required error={errors.reason}>
            <Textarea name="reason" rows={2} required />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** A flag's platform default and rollout percentage (`PUT /v1/admin/feature-flags/{key}` without a tenant). */
export function FlagDefault({
  flagKey,
  enabled,
  rolloutPct,
}: {
  flagKey: string;
  enabled: boolean;
  rolloutPct: number;
}) {
  const t = useTranslations("admin.platform.flags");
  const [on, setOn] = useState(enabled);
  return (
    <FormDialog
      label={t("editDefault")}
      icon={IconEdit}
      size="sm"
      testId={`flag-default-${flagKey}`}
      title={t("defaultTitle", { key: flagKey })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PUT("/v1/admin/feature-flags/{key}", {
            params: { path: { key: flagKey } },
            body: {
              defaultEnabled: on,
              rolloutPct: integer(data, "rolloutPct") ?? rolloutPct,
              reason: text(data, "reason") ?? "",
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Switch label={t("defaultOn")} checked={on} onCheckedChange={setOn} />
          <Field label={t("rollout")} hint={t("rolloutHint")} error={errors.rolloutPct}>
            <Input name="rolloutPct" type="number" min={0} max={100} defaultValue={rolloutPct} />
          </Field>
          <Field label={t("reason")} required error={errors.reason}>
            <Textarea name="reason" rows={2} required />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
