import { useTranslations } from "next-intl";

import { formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";

/**
 * A setting's value as an operator reads it (billing cut-off, grace, estimate policy, reminders…) — the
 * value the API says is in force, never a default from the UI (CLAUDE.md: configurable values are read
 * from the API). Unknown shapes are shown as they came.
 */
export function SettingValue({ setting, locale }: { setting: Schemas["SettingDto"]; locale: Locale }) {
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
      case "billing.reading_grace_hours":
        return t("hours", { count: Number(value) });
      case "billing.default_due_day":
        return t("dueDay", { day: Number(value) });
      case "deposit.refund_days":
      case "readings.round_window_days":
        return t("days", { count: Number(value) });
      case "reminders.schedule":
        if (Array.isArray(value)) return t("reminderDays", { days: value.join(", ") });
        break;
    }
    if (setting.valueType === "bool") return value ? t("on") : t("off");
    if (setting.valueType === "money" && typeof value === "string") return formatTHB(value, locale);
    if (typeof value === "string" || typeof value === "number") return String(value);
    return JSON.stringify(value);
  })();
  return (
    <span className="flex flex-col">
      <span data-testid={`setting-${setting.key}`}>{shown}</span>
      <span className="text-muted text-xs">
        {t(`scope.${setting.scope}`)} · {t("since", { date: formatDateTime(setting.effectiveFrom, locale) })}
      </span>
    </span>
  );
}
