import { getTranslations } from "next-intl/server";

import { formatNumber, formatPeriodKey } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";

type Record = Schemas["RentRecordDto"];
type MonthStatus = Schemas["RentRecordMonthStatus"];

const TONE = { on_time: "success", late: "warning", outstanding: "danger" } as const satisfies {
  [K in MonthStatus]: "success" | "warning" | "danger";
};

/**
 * A rent record (D-256) as facts: months paid on time, late and still owed — confirmed by getproperty (gateway or
 * verified slip) — then the months themselves, newest first. Never a score; the words say what happened.
 */
export async function RentRecordSummary({ record, locale }: { record: Record; locale: Locale }) {
  const t = await getTranslations("owner.rentRecord");
  const counts: { key: MonthStatus; value: number }[] = [
    { key: "on_time", value: record.onTime },
    { key: "late", value: record.late },
    { key: "outstanding", value: record.outstanding },
  ];
  return (
    <div className="flex flex-col gap-4" data-testid="rent-record">
      <dl className="m-0 grid grid-cols-3 gap-3">
        {counts.map((c) => (
          <div
            key={c.key}
            className="border-border flex flex-col gap-1 border-s-2 ps-3"
            data-testid={`rent-record-${c.key}`}
          >
            <dt className="text-muted text-sm">{t(`status.${c.key}`)}</dt>
            <dd className="m-0 text-2xl font-semibold tabular-nums">
              {t("months", { count: formatNumber(c.value, locale) })}
            </dd>
          </div>
        ))}
      </dl>
      {record.months.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t("monthsLabel")}>
          {record.months.map((m) => (
            <li key={m.month} data-status={m.status}>
              <Badge tone={TONE[m.status]} size="sm">
                {formatPeriodKey(m.month, locale)} · {t(`status.${m.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-muted text-xs">
        {record.notConfirmed > 0 ? `${t("notConfirmed", { count: record.notConfirmed })} ` : ""}
        {t("footnote")}
      </p>
    </div>
  );
}
