import { getTranslations } from "next-intl/server";

import { formatNumber, formatPeriodKey } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import type { IconGlyph } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";

type Record = Schemas["RentRecordDto"];
type MonthStatus = Schemas["RentRecordMonthStatus"];

/** Each month's status as an icon and its word (never colour alone). */
const STATUS = {
  on_time: { tone: "success", icon: IconCheckCircle },
  late: { tone: "warning", icon: IconClock },
  outstanding: { tone: "danger", icon: IconAlert },
} as const satisfies { [K in MonthStatus]: { tone: "success" | "warning" | "danger"; icon: IconGlyph } };

/** "ต.ค." — the month alone, for the compact cells (the full month and year are their accessible name). */
function shortMonth(key: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(`${key}-15T00:00:00Z`),
  );
}

/**
 * A rent record (D-256) as facts: months paid on time, late and still owed — confirmed by getproperty (gateway or
 * verified slip) — then the months themselves, newest first. Never a score; the words say what happened.
 */
export async function RentRecordSummary({
  record,
  locale,
  compact = false,
}: {
  record: Record;
  locale: Locale;
  /** A narrow panel (the enquiry inbox): the months as small cells, each with its icon and its name for assistive tech. */
  compact?: boolean;
}) {
  const t = await getTranslations("owner.rentRecord");
  const counts: { key: MonthStatus; value: number }[] = [
    { key: "on_time", value: record.onTime },
    { key: "late", value: record.late },
    { key: "outstanding", value: record.outstanding },
  ];
  return (
    <div className="flex flex-col gap-4" data-testid="rent-record">
      <dl className="border-border divide-border m-0 grid grid-cols-3 divide-x border-y">
        {counts.map((c) => (
          <div key={c.key} className="flex flex-col gap-1 px-3 py-3 first:ps-0" data-testid={`rent-record-${c.key}`}>
            <dt className="text-muted text-sm">{t(`status.${c.key}`)}</dt>
            <dd className={`m-0 font-semibold tabular-nums ${compact ? "text-lg" : "text-2xl"}`}>
              {t("months", { count: formatNumber(c.value, locale) })}
            </dd>
          </div>
        ))}
      </dl>
      {record.months.length && compact ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label={t("monthsLabel")}>
          {record.months.map((m) => (
            <li
              key={m.month}
              data-status={m.status}
              title={t("monthStatus", { month: formatPeriodKey(m.month, locale), status: t(`status.${m.status}`) })}
            >
              <Badge tone={STATUS[m.status].tone} icon={STATUS[m.status].icon} size="sm">
                <span className="sr-only">
                  {t("monthStatus", { month: formatPeriodKey(m.month, locale), status: t(`status.${m.status}`) })}
                </span>
                <span aria-hidden="true">{shortMonth(m.month, locale)}</span>
              </Badge>
            </li>
          ))}
        </ul>
      ) : record.months.length ? (
        <ul
          className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 md:grid-cols-4"
          aria-label={t("monthsLabel")}
        >
          {record.months.map((m) => (
            <li
              key={m.month}
              data-status={m.status}
              className="border-border bg-surface rounded-thumb flex flex-col items-start gap-1.5 border px-3 py-2 text-sm"
            >
              <span className="font-medium tabular-nums">{formatPeriodKey(m.month, locale)}</span>
              <Badge tone={STATUS[m.status].tone} icon={STATUS[m.status].icon} size="sm">
                {t(`status.${m.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-muted m-0 text-xs">
        {record.notConfirmed > 0 ? `${t("notConfirmed", { count: record.notConfirmed })} ` : ""}
        {t("footnote")}
      </p>
    </div>
  );
}
