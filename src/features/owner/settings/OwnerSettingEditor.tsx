"use client";

import { useTranslations } from "next-intl";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import {
  bangkokInstant,
  parseSettingValue,
  settingInput,
  type SettingValueType,
} from "@/features/shared/console/SettingEditor";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconEdit } from "@/ui/icons/glyphs/edit";

type Json = Record<string, unknown>;

const asRecord = (value: unknown): Json =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {};
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The value of a setting from the dialog's fields: the structured editors of the keys an operator
 * changes most (cut-off, auto-issue, reminder days, quiet hours, estimate policy) and a typed field for
 * the rest. `undefined` = the input does not make a valid value (the API validates again).
 */
export function settingValueFrom(key: string, valueType: SettingValueType, data: FormData, current: unknown): unknown {
  switch (key) {
    case "billing.cutoff": {
      const time = text(data, "time") ?? "";
      if (!TIME.test(time)) return undefined;
      const mode = text(data, "mode");
      const day = Number(text(data, "day"));
      const timezone = String(asRecord(current).timezone ?? "Asia/Bangkok");
      if (mode === "end_of_month") return { day: "end_of_month", time, timezone };
      return Number.isInteger(day) && day >= 1 && day <= 28 ? { day, time, timezone } : undefined;
    }
    case "billing.auto_issue": {
      const hours = Number(text(data, "afterHours"));
      if (!Number.isInteger(hours) || hours < 0) return undefined;
      return { ...asRecord(current), enabled: data.get("enabled") === "on", afterHours: hours };
    }
    case "reminders.schedule": {
      const days = (text(data, "days") ?? "")
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      if (days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 90)) return undefined;
      return [...new Set(days)].sort((a, b) => a - b);
    }
    case "notifications.quiet_hours": {
      const start = text(data, "start") ?? "";
      const end = text(data, "end") ?? "";
      if (!TIME.test(start) || !TIME.test(end)) return undefined;
      return { ...asRecord(current), start, end, timezone: String(asRecord(current).timezone ?? "Asia/Bangkok") };
    }
    default:
      return parseSettingValue(valueType, String(data.get("value") ?? ""));
  }
}

function StructuredFields({ setting, errors }: { setting: Schemas["SettingDto"]; errors: Record<string, string> }) {
  const t = useTranslations("owner.settings.editor");
  const common = useTranslations("console.setting");
  const value = setting.value as unknown;
  const record = asRecord(value);
  switch (setting.key) {
    case "billing.cutoff":
      return (
        <>
          <Field label={t("cutoffMode")} required>
            <NativeSelect
              name="mode"
              defaultValue={record.day === "end_of_month" ? "end_of_month" : "day"}
              options={[
                { value: "end_of_month", label: t("endOfMonth") },
                { value: "day", label: t("dayOfMonth") },
              ]}
              data-testid="cutoff-mode"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("day")} hint={t("dayHint")}>
              <Input
                name="day"
                type="number"
                min={1}
                max={28}
                defaultValue={typeof record.day === "number" ? record.day : ""}
                data-testid="cutoff-day"
              />
            </Field>
            <Field label={t("time")} required error={errors.value}>
              <Input
                name="time"
                type="time"
                required
                defaultValue={String(record.time ?? "23:59")}
                data-testid="cutoff-time"
              />
            </Field>
          </div>
        </>
      );
    case "billing.auto_issue":
      return (
        <>
          <Checkbox
            name="enabled"
            label={t("autoIssueOn")}
            defaultChecked={record.enabled === true}
            data-testid="auto-issue-enabled"
          />
          <Field label={t("afterHours")} hint={t("afterHoursHint")} required error={errors.value}>
            <Input name="afterHours" type="number" min={0} max={720} defaultValue={String(record.afterHours ?? 24)} />
          </Field>
        </>
      );
    case "reminders.schedule":
      return (
        <Field label={t("reminderDays")} hint={t("reminderDaysHint")} required error={errors.value}>
          <Input
            name="days"
            defaultValue={Array.isArray(value) ? value.join(", ") : ""}
            inputMode="numeric"
            data-testid="reminder-days"
          />
        </Field>
      );
    case "notifications.quiet_hours":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("quietStart")} required error={errors.value}>
            <Input
              name="start"
              type="time"
              required
              defaultValue={String(record.start ?? "21:00")}
              data-testid="quiet-start"
            />
          </Field>
          <Field label={t("quietEnd")} required>
            <Input
              name="end"
              type="time"
              required
              defaultValue={String(record.end ?? "08:00")}
              data-testid="quiet-end"
            />
          </Field>
        </div>
      );
    case "billing.estimate_policy":
      return (
        <Field label={common("value")} required error={errors.value}>
          <NativeSelect
            name="value"
            defaultValue={String(value)}
            options={[
              { value: "allow", label: t("estimateAllow") },
              { value: "block", label: t("estimateBlock") },
            ]}
            data-testid="setting-value"
          />
        </Field>
      );
  }
  const type = setting.valueType as SettingValueType;
  return (
    <Field label={common("value")} hint={common(`hint.${type}`)} required error={errors.value}>
      {type === "bool" ? (
        <NativeSelect
          name="value"
          defaultValue={settingInput(type, value)}
          options={[
            { value: "true", label: common("on") },
            { value: "false", label: common("off") },
          ]}
          data-testid="setting-value"
        />
      ) : type === "json" ? (
        <Textarea
          name="value"
          rows={6}
          defaultValue={settingInput(type, value)}
          className="font-mono text-sm"
          data-testid="setting-value"
        />
      ) : (
        <Input name="value" defaultValue={settingInput(type, value)} data-testid="setting-value" />
      )}
    </Field>
  );
}

/**
 * Changes one setting for the tenant (`PUT /v1/owner/settings/{key}`) or one property
 * (`PUT /v1/owner/properties/{id}/settings/{key}`) as a new effective-dated version (ADR-0004): now or a
 * later Bangkok time, never the past (`settings.backdated`), with the reason the audit log keeps.
 */
export function OwnerSettingEditor({
  setting,
  label,
  propertyId,
}: {
  setting: Schemas["SettingDto"];
  label: string;
  propertyId?: string;
}) {
  const t = useTranslations("owner.settings.editor");
  const common = useTranslations("console.setting");
  return (
    <FormDialog
      label={common("edit")}
      icon={IconEdit}
      size="sm"
      testId={`edit-${setting.key}`}
      title={t("title", { name: label })}
      description={propertyId ? t("propertyScope") : t("tenantScope")}
      submitLabel={common("save")}
      successMessage={common("saved")}
      onSubmit={(data) => {
        const value = settingValueFrom(setting.key, setting.valueType as SettingValueType, data, setting.value);
        if (value === undefined) return Promise.reject(new Error(common("invalid")));
        const body = {
          value: value as Schemas["SettingUpdateDto"]["value"],
          effectiveFrom: bangkokInstant(text(data, "effectiveFrom")),
          reason: text(data, "reason") ?? "",
        };
        return propertyId
          ? unwrap(
              browserApi().PUT("/v1/owner/properties/{propertyId}/settings/{key}", {
                params: { path: { propertyId, key: setting.key } },
                body,
              }),
            )
          : unwrap(browserApi().PUT("/v1/owner/settings/{key}", { params: { path: { key: setting.key } }, body }));
      }}
    >
      {(errors) => (
        <>
          <StructuredFields setting={setting} errors={errors} />
          <Field label={common("effectiveFrom")} hint={common("effectiveFromHint")} error={errors.effectiveFrom}>
            <Input name="effectiveFrom" type="datetime-local" data-testid="setting-effective" />
          </Field>
          <Field label={common("reason")} required error={errors.reason}>
            <Textarea name="reason" rows={2} required data-testid="setting-reason" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
