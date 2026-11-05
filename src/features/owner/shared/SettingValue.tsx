import { useTranslations } from "next-intl";

import { vatPercent } from "@/features/shared/growth/sponsored";
import { formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";

/**
 * A setting's value as an operator reads it (billing cut-off, grace, estimate policy, reminders…) — the
 * value the API says is in force, never a default from the UI (CLAUDE.md: configurable values are read
 * from the API). Unknown shapes are shown as they came.
 */
export function SettingValue({
  setting,
  locale,
  testId,
  withSource = true,
}: {
  setting: Pick<Schemas["SettingDto"], "key" | "value" | "valueType" | "scope" | "effectiveFrom">;
  locale: Locale;
  /** Defaults to `setting-<key>` (the value in force); a history row passes its own. */
  testId?: string;
  /** The muted "where it comes from · since" line under the value; a settings row shows it on its own. */
  withSource?: boolean;
}) {
  const t = useTranslations("owner.common.setting");
  const value = setting.value as unknown;
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  const shown = (() => {
    switch (setting.key) {
      case "billing.cutoff":
        if (record?.day === "end_of_month") return t("cutoffEndOfMonth", { time: String(record.time ?? "23:59") });
        if (record) return t("cutoffDay", { day: String(record.day), time: String(record.time ?? "23:59") });
        break;
      case "billing.auto_issue":
        if (record) return record.enabled ? t("autoIssueOn", { hours: Number(record.afterHours ?? 0) }) : t("off");
        break;
      case "billing.estimate_policy":
        return value === "allow" ? t("estimateAllow") : t("estimateBlock");
      case "payments.allocation_policy":
        if (value === "oldest_first") return t("allocationOldest");
        if (value === "surcharge_first") return t("allocationSurcharge");
        break;
      case "juristic.plan_max_instalments":
        return t("instalments", { count: Number(value) });
      case "notifications.quiet_hours":
        if (record?.start && record.end)
          return t("quietHours", { start: String(record.start), end: String(record.end) });
        break;
      case "tax.vat":
        if (record && typeof record.rate === "string") return vatPercent(record.rate, locale);
        break;
      case "compliance.tariff_cap.representative_units":
        if (record) return t("representativeUnits", { electric: String(record.electric), water: String(record.water) });
        break;
      case "compliance.tariff_cap.severity":
        if (value === "warn" || value === "block") return t(`severity.${value}`);
        break;
      case "readings.plausibility_pct":
        return t("plusMinusPercent", { value: String(value) });
      case "deposit.max_months_short":
        return t("months", { count: Number(value) });
      case "viewing.self.code_minutes":
      case "viewing.self.code_early_minutes":
      case "viewing.self.overstay_minutes":
        return t("minutes", { count: Number(value) });
      case "billing.reading_grace_hours":
      case "payments.duplicate_window_hours":
      case "tm30.notify_within_hours":
      case "access.work_order_window_hours":
      case "access.resident_visitor_max_hours":
        return t("hours", { count: Number(value) });
      case "access.battery_low_pct":
        return t("percent", { value: Number(value) });
      case "billing.default_due_day":
        return t("dueDay", { day: Number(value) });
      case "deposit.refund_days":
      case "payments.slip_max_age_days":
      case "juristic.plan_default_days":
      case "juristic.debt_clearance.validity_days":
      case "analytics.csat_survey_interval_days":
      case "readings.round_window_days":
        return t("days", { count: Number(value) });
      case "reminders.schedule":
        if (Array.isArray(value)) return t("reminderDays", { days: value.join(", ") });
        break;
    }
    if (setting.valueType === "bool") return value ? t("on") : t("off");
    if (setting.valueType === "money" && typeof value === "string") return formatTHB(value, locale);
    if (typeof value === "string" || typeof value === "number") return String(value);
    // Never raw JSON on screen: a shape this page does not know yet reads as "set" (its history shows the versions).
    return t("structured");
  })();
  if (!withSource) return <span data-testid={testId ?? `setting-${setting.key}`}>{shown}</span>;
  return (
    <span className="flex flex-col">
      <span data-testid={testId ?? `setting-${setting.key}`}>{shown}</span>
      <SettingSource setting={setting} locale={locale} />
    </span>
  );
}

/** Where a setting's value comes from and since when: "ค่าเริ่มต้นของระบบ · ตั้งแต่ 5 ส.ค. 2569 20:04". */
export function SettingSource({
  setting,
  locale,
  className,
}: {
  setting: Pick<Schemas["SettingDto"], "scope" | "effectiveFrom">;
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations("owner.common.setting");
  return (
    <span className={className ?? "text-muted text-xs"}>
      {t(`scope.${setting.scope}`)} · {t("since", { date: formatDateTime(setting.effectiveFrom, locale) })}
    </span>
  );
}
