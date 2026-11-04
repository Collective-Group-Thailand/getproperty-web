import { getTranslations } from "next-intl/server";

import { formatDate, formatDecimal, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";
import { SimpleTable } from "@/ui/components/SimpleTable";

/** How each of the seven D-083 KPIs reads (the values themselves are the API's decimal strings). */
const UNIT: Record<string, "hours" | "pct" | "score" | "yesNo"> = {
  time_to_bill: "hours",
  invoice_correction_rate: "pct",
  on_time_payment: "pct",
  auto_reconciled: "pct",
  loss_identified: "yesNo",
  meter_uptime: "pct",
  csat: "score",
};

/** A target as the agreement states it (">=90%", "<1%", "+10pts", "-80%") in words: "อย่างน้อย 90 %". */
const TARGET = /^(>=|<=|>|<|\+|-)?\s*(\d+(?:\.\d+)?)\s*(%|pts|h)?$/;
const OPERATOR = { ">=": "atLeast", "<=": "atMost", ">": "above", "<": "below", "+": "up", "-": "down" } as const;

/**
 * The pilot's seven KPIs (D-083, D-206) for the platform admin and the tenant's own insights: baseline,
 * current over the window (30 / 90 days), target and whether it is met — `null` (not enough data) shown
 * as such — plus the Phase 1 acceptance figures. Nothing is computed here: every figure is the API's.
 */
export async function PilotKpiView({
  kpis,
  locale,
  windowHref,
}: {
  kpis: Schemas["PilotKpisDto"];
  locale: Locale;
  windowHref: (window: Schemas["KpiWindow"]) => string;
}) {
  const t = await getTranslations("console.pilotKpi");
  const value = (kpi: string, raw: string | boolean | null) => {
    if (raw === null) return <span className="text-muted">{t("noData")}</span>;
    if (typeof raw === "boolean") return raw ? t("yes") : t("no");
    switch (UNIT[kpi]) {
      case "hours":
        return t("hours", { value: formatDecimal(raw, locale, 2) });
      case "pct":
        return t("pct", { value: formatDecimal(raw, locale, 2) });
      default:
        return formatDecimal(raw, locale, 2);
    }
  };
  const target = (raw: string | boolean) => {
    if (typeof raw === "boolean") return raw ? t("yes") : t("no");
    const match = TARGET.exec(raw.trim());
    if (!match) return raw;
    const [, operator, number, unit] = match;
    const amount =
      unit === "%"
        ? t("pct", { value: formatDecimal(number!, locale, 2) })
        : unit === "pts"
          ? t("points", { value: formatDecimal(number!, locale, 2) })
          : unit === "h"
            ? t("hours", { value: formatDecimal(number!, locale, 2) })
            : formatDecimal(number!, locale, 2);
    return operator ? t(`target.${OPERATOR[operator as keyof typeof OPERATOR]}`, { value: amount }) : amount;
  };
  return (
    <div className="flex flex-col gap-4" data-testid="pilot-kpis" data-window={kpis.window}>
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("window")}
            current={kpis.window}
            tabs={(["30d", "90d"] as const).map((window) => ({
              key: window,
              href: windowHref(window),
              label: t(`windowName.${window}`),
            }))}
          />
        }
        actions={
          <p className="text-muted text-sm">
            {t("range", { from: formatDate(kpis.from, locale), to: formatDate(kpis.to, locale) })}
            {kpis.kpiReviewOn ? ` · ${t("review", { date: formatDate(kpis.kpiReviewOn, locale) })}` : ""}
          </p>
        }
      />
      <SimpleTable
        caption={t("title")}
        testId="kpi-table"
        minWidth="44rem"
        stackOnPhones
        columns={[
          { key: "kpi", header: t("col.kpi"), phone: "title" },
          { key: "current", header: t("col.current"), align: "end", phone: "figure" },
          { key: "baseline", header: t("col.baseline"), align: "end", phone: "meta", phoneLabel: true },
          { key: "target", header: t("col.target"), align: "end", phone: "meta", phoneLabel: true },
          { key: "met", header: t("col.met"), phone: "status" },
        ]}
        rows={kpis.kpis.map((kpi) => ({
          key: kpi.kpi,
          testId: "kpi-row",
          data: { kpi: kpi.kpi, met: kpi.met === null ? "unknown" : String(kpi.met) },
          cells: {
            kpi: t.has(`name.${kpi.kpi}`) ? t(`name.${kpi.kpi}`) : kpi.kpi,
            baseline: value(kpi.kpi, kpi.baseline),
            current: <span className="font-semibold">{value(kpi.kpi, kpi.current)}</span>,
            target: target(kpi.target),
            met:
              kpi.met === null ? (
                <Badge size="sm" tone="neutral" icon={IconClock}>
                  {t("unknown")}
                </Badge>
              ) : kpi.met ? (
                <Badge size="sm" tone="success" icon={IconCheckCircle}>
                  {t("met")}
                </Badge>
              ) : (
                <Badge size="sm" tone="warning" icon={IconXCircle}>
                  {t("notMet")}
                </Badge>
              ),
          },
        }))}
      />
      <section aria-labelledby="kpi-acceptance" className="flex flex-col gap-3" data-testid="kpi-acceptance">
        <div>
          <h3 id="kpi-acceptance" className="font-semibold">
            {t("acceptance")}
          </h3>
          <p className="text-muted text-sm">{t("acceptanceHint")}</p>
        </div>
        <StatsRow
          label={t("acceptance")}
          figures={[
            {
              key: "auto",
              label: t("buildingsAuto"),
              value: formatNumber(kpis.acceptance.buildingsBillingAutomatically, locale),
            },
            {
              key: "firstCycle",
              label: t("firstCycle"),
              value:
                kpis.acceptance.firstFullCycleWithin1h === null
                  ? t("noData")
                  : kpis.acceptance.firstFullCycleWithin1h
                    ? t("yes")
                    : t("no"),
            },
            {
              key: "qr",
              label: t("paidByQr"),
              value: kpis.acceptance.paidByQrPct
                ? t("pct", { value: formatDecimal(kpis.acceptance.paidByQrPct, locale, 2) })
                : t("noData"),
            },
            {
              key: "line",
              label: t("viaLine"),
              value: kpis.acceptance.serviceRequestsViaLinePct
                ? t("pct", { value: formatDecimal(kpis.acceptance.serviceRequestsViaLinePct, locale, 2) })
                : t("noData"),
            },
          ]}
        />
      </section>
    </div>
  );
}
