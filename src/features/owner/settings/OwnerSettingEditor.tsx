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
    case "tax.vat": {
      // The rate is typed as a percentage ("7") and sent as the API's fraction string ("0.07").
      const percent = (text(data, "ratePercent") ?? "").trim();
      if (!/^\d{1,2}(\.\d{1,2})?$/.test(percent)) return undefined;
      const [whole = "0", fraction = ""] = percent.split(".");
      const digits = `${whole.padStart(3, "0")}${fraction.padEnd(2, "0")}`; // 7 → "00700" = 0.0700
      const rate = `${digits.slice(0, 1)}.${digits.slice(1)}`.replace(/0+$/, "").replace(/\.$/, ".0");
      return { ...asRecord(current), rate };
    }
    default:
      return parseSettingValue(valueType, String(data.get("value") ?? ""));
  }
}

/** The unit a number setting is typed in (shown beside the field and in the row's value). */
export const SETTING_UNIT: Record<string, "hours" | "days" | "minutes" | "percent" | "months"> = {
  "billing.reading_grace_hours": "hours",
  "payments.duplicate_window_hours": "hours",
  "tm30.notify_within_hours": "hours",
  "access.work_order_window_hours": "hours",
  "access.resident_visitor_max_hours": "hours",
  "deposit.refund_days": "days",
  "payments.slip_max_age_days": "days",
  "juristic.plan_default_days": "days",
  "juristic.debt_clearance.validity_days": "days",
  "juristic.bank_match_days": "days",
  "readings.round_window_days": "days",
  "analytics.csat_survey_interval_days": "days",
  "viewing.self.code_minutes": "minutes",
  "viewing.self.code_early_minutes": "minutes",
  "viewing.self.overstay_minutes": "minutes",
  "access.battery_low_pct": "percent",
  "readings.plausibility_pct": "percent",
  "deposit.max_months_short": "months",
};

/** "0.07" → "7" for the VAT field (string work only — no arithmetic on the API's decimal). */
function vatPercentText(rate: unknown): string {
  if (typeof rate !== "string" || !/^0\.\d+$/.test(rate)) return "";
  const digits = rate.slice(2).padEnd(4, "0");
  const whole = String(Number(digits.slice(0, 2)));
  const fraction = digits.slice(2).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/** A field with its unit beside it ("24 ชั่วโมง"): the unit is part of the control, not a hint to read. */
function UnitInput({ unit, children }: { unit: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <span className="w-40">{children}</span>
      <span className="text-muted text-base">{unit}</span>
    </span>
  );
}

function StructuredFields({ setting, errors }: { setting: Schemas["SettingDto"]; errors: Record<string, string> }) {
  const t = useTranslations("owner.settings.editor");
  const common = useTranslations("console.setting");
  const units = useTranslations("owner.settings.unit");
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
    case "tax.vat":
      return (
        <Field label={t("vatRate")} hint={t("vatRateHint")} required error={errors.value}>
          <UnitInput unit={units("percent")}>
            <Input
              name="ratePercent"
              inputMode="decimal"
              required
              defaultValue={vatPercentText(record.rate)}
              data-testid="setting-value"
            />
          </UnitInput>
        </Field>
      );
    case "payments.allocation_policy":
      return (
        <Field label={common("value")} required error={errors.value}>
          <NativeSelect
            name="value"
            defaultValue={String(value)}
            options={[
              { value: "oldest_first", label: t("allocationOldest") },
              { value: "surcharge_first", label: t("allocationSurcharge") },
            ]}
            data-testid="setting-value"
          />
        </Field>
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
  const unit = SETTING_UNIT[setting.key];
  if (unit && (type === "int" || type === "decimal"))
    return (
      <Field label={common("value")} required error={errors.value}>
        <UnitInput unit={units(unit)}>
          <Input
            name="value"
            inputMode={type === "int" ? "numeric" : "decimal"}
            defaultValue={settingInput(type, value)}
            data-testid="setting-value"
          />
        </UnitInput>
      </Field>
    );
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
