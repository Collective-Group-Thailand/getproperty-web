import { getTranslations } from "next-intl/server";

import { formatDate, formatDecimal, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { LinkTabs } from "@/ui/components/LinkTabs";
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
  const target = (raw: string | boolean) => (typeof raw === "boolean" ? (raw ? t("yes") : t("no")) : raw);
  return (
    <div className="flex flex-col gap-4" data-testid="pilot-kpis" data-window={kpis.window}>
      <LinkTabs
        label={t("window")}
        current={windowHref(kpis.window)}
        tabs={(["30d", "90d"] as const).map((window) => ({
          href: windowHref(window),
          label: t(`windowName.${window}`),
        }))}
      />
      <p className="text-muted text-sm">
        {t("range", { from: formatDate(kpis.from, locale), to: formatDate(kpis.to, locale) })}
        {kpis.kpiReviewOn ? ` · ${t("review", { date: formatDate(kpis.kpiReviewOn, locale) })}` : ""}
      </p>
      <SimpleTable
        caption={t("title")}
        testId="kpi-table"
        minWidth="44rem"
        columns={[
          { key: "kpi", header: t("col.kpi") },
          { key: "baseline", header: t("col.baseline"), align: "end" },
          { key: "current", header: t("col.current"), align: "end" },
          { key: "target", header: t("col.target"), align: "end" },
          { key: "met", header: t("col.met") },
        ]}
        rows={kpis.kpis.map((kpi) => ({
          key: kpi.kpi,
          testId: "kpi-row",
          data: { kpi: kpi.kpi, met: kpi.met === null ? "unknown" : String(kpi.met) },
          cells: {
            kpi: t.has(`name.${kpi.kpi}`) ? t(`name.${kpi.kpi}`) : kpi.kpi,
            baseline: value(kpi.kpi, kpi.baseline),
            current: <strong>{value(kpi.kpi, kpi.current)}</strong>,
            target: <span className="font-mono">{target(kpi.target)}</span>,
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
      <Card as="section" aria-labelledby="kpi-acceptance">
        <CardHeader title={<span id="kpi-acceptance">{t("acceptance")}</span>} description={t("acceptanceHint")} />
        <DescriptionList
          columns={2}
          items={[
            {
              id: "auto",
              term: t("buildingsAuto"),
              description: formatNumber(kpis.acceptance.buildingsBillingAutomatically, locale),
            },
            {
              id: "firstCycle",
              term: t("firstCycle"),
              description:
                kpis.acceptance.firstFullCycleWithin1h === null
                  ? null
                  : kpis.acceptance.firstFullCycleWithin1h
                    ? t("yes")
                    : t("no"),
            },
            {
              id: "qr",
              term: t("paidByQr"),
              description: kpis.acceptance.paidByQrPct
                ? t("pct", { value: formatDecimal(kpis.acceptance.paidByQrPct, locale, 2) })
                : null,
            },
            {
              id: "line",
              term: t("viaLine"),
              description: kpis.acceptance.serviceRequestsViaLinePct
                ? t("pct", { value: formatDecimal(kpis.acceptance.serviceRequestsViaLinePct, locale, 2) })
                : null,
            },
          ]}
        />
      </Card>
    </div>
  );
}
