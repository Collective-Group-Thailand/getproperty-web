import { formatDecimal, formatPercent, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";

type Unit = "pct" | "hours" | "score5" | "thb_m2";

/** How each insight / benchmark metric reads (D-083, D-217). Units only — every value is the API's string. */
const UNIT: Record<Schemas["InsightMetric"] | Schemas["BenchmarkMetric"], Unit> = {
  time_to_bill_hours: "hours",
  invoice_correction_rate_pct: "pct",
  on_time_payment_pct: "pct",
  auto_reconciled_pct: "pct",
  paid_by_qr_pct: "pct",
  reminder_effectiveness_pct: "pct",
  loss_pct: "pct",
  meter_uptime_pct: "pct",
  csat: "score5",
  compliance_score: "pct",
  above_cap_acknowledged_pct: "pct",
  service_requests_via_line_pct: "pct",
  rent_per_m2: "thb_m2",
};

/** The series shown first (the pilot KPIs); the rest open under "more measures". */
export const PRIMARY_SERIES: readonly Schemas["InsightMetric"][] = [
  "time_to_bill_hours",
  "on_time_payment_pct",
  "auto_reconciled_pct",
  "loss_pct",
  "meter_uptime_pct",
  "csat",
];

/** Whether a lower value is the better one (for the "lower is better" hint under a chart). */
export const LOWER_IS_BETTER = new Set<string>(["time_to_bill_hours", "invoice_correction_rate_pct", "loss_pct"]);

/**
 * A metric value as text: percentages `88.4%`, hours `6.5 h`, CSAT `4.4 / 5`, rent per m² `฿203.13`.
 * `labels` carries the localised unit words (`{value} ชม.`).
 */
export function formatMetric(
  metric: Schemas["InsightMetric"] | Schemas["BenchmarkMetric"],
  value: string,
  locale: Locale,
  labels: { hours: (value: string) => string; score: (value: string) => string; perM2: (value: string) => string },
): string {
  switch (UNIT[metric]) {
    case "pct":
      return formatPercent(value, locale, 1);
    case "hours":
      return labels.hours(formatDecimal(value, locale, 1));
    case "score5":
      return labels.score(formatDecimal(value, locale, 1));
    case "thb_m2":
      return labels.perM2(formatTHB(value, locale));
  }
}
