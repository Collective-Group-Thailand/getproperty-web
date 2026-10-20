"use client";

import { useTranslations } from "next-intl";

import { FormDialog, text } from "./FormDialog";
import { bangkokInstant } from "./time";

export { bangkokInstant };
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconEdit } from "@/ui/icons/glyphs/edit";

export type SettingValueType = "string" | "int" | "decimal" | "bool" | "json" | "duration" | "money" | "date" | "time";

/** A value typed into the editor as the JSON value of the setting's type, or `undefined` when it does not parse. */
export function parseSettingValue(type: SettingValueType, raw: string): unknown {
  const value = raw.trim();
  switch (type) {
    case "int":
      return /^-?\d+$/.test(value) ? Number(value) : undefined;
    case "bool":
      return value === "true" ? true : value === "false" ? false : undefined;
    case "decimal":
    case "money":
      return /^-?\d+(\.\d+)?$/.test(value) ? value : undefined;
    case "json":
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return undefined;
      }
    default:
      return value === "" ? undefined : value;
  }
}

/** A setting's current value as the editor shows it. */
export function settingInput(type: SettingValueType, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (type === "json") return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Edits one effective-dated setting (ADR-0004): a new version from now or a later moment — never
 * backdated (the API refuses with `settings.backdated`) — with the reason the audit keeps. The value is
 * typed per the setting's `valueType`; the API validates it (`settings.invalid_value`).
 */
export function SettingEditor({
  settingKey,
  description,
  valueType,
  value,
  onSave,
  testId,
}: {
  settingKey: string;
  description: string;
  valueType: SettingValueType;
  value: unknown;
  onSave: (input: { value: unknown; effectiveFrom?: string; reason: string }) => Promise<unknown>;
  testId?: string;
}) {
  const t = useTranslations("console.setting");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      size="sm"
      testId={testId ?? `edit-${settingKey}`}
      title={t("title", { key: settingKey })}
      description={description}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) => {
        const parsed = parseSettingValue(valueType, String(data.get("value") ?? ""));
        if (parsed === undefined) return Promise.reject(new Error(t("invalid")));
        const when = text(data, "effectiveFrom");
        return onSave({
          value: parsed,
          effectiveFrom: bangkokInstant(when),
          reason: text(data, "reason") ?? "",
        });
      }}
    >
      {(errors) => (
        <>
          <Field label={t("value")} hint={t(`hint.${valueType}`)} required error={errors.value}>
            {valueType === "bool" ? (
              <NativeSelect
                name="value"
                defaultValue={settingInput(valueType, value)}
                options={[
                  { value: "true", label: t("on") },
                  { value: "false", label: t("off") },
                ]}
              />
            ) : valueType === "json" ? (
              <Textarea
                name="value"
                rows={6}
                defaultValue={settingInput(valueType, value)}
                className="font-mono text-sm"
              />
            ) : (
              <Input name="value" defaultValue={settingInput(valueType, value)} data-testid="setting-value" />
            )}
          </Field>
          <Field label={t("effectiveFrom")} hint={t("effectiveFromHint")} error={errors.effectiveFrom}>
            <Input name="effectiveFrom" type="datetime-local" />
          </Field>
          <Field label={t("reason")} required error={errors.reason}>
            <Textarea name="reason" rows={2} required data-testid="setting-reason" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
