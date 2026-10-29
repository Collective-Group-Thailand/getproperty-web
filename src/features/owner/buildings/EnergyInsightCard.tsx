import { getTranslations } from "next-intl/server";

import { formatDate, formatDecimal, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { cn } from "@/ui/lib/cn";

import { SectionError } from "@/features/shared/console/SectionError";

import { section } from "../shared/server";
import { penalised, ratioToPercent, scoreArc } from "./energy";
import { EnergyOptIn } from "./EnergyOptIn";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A building's energy insight (G9, D-301): the score the API computed from the building's hourly electricity
 * (insight only, D-030) over the last full days, what it is made of and what took points off — then the owner's
 * choice to share the aggregate figures with getenergy for an offer (O-036). Too little data is its own state.
 */
export async function EnergyInsightCard({
  api,
  buildingId,
  locale,
}: {
  api: ApiClient;
  buildingId: string;
  locale: Locale;
}) {
  const t = await getTranslations("owner.insight.energy");
  const result = await section(
    unwrap(api.GET("/v1/owner/buildings/{buildingId}/energy-insight", { params: { path: { buildingId } } })),
  );
  const insight = result.data;
  return (
    <Card as="section" aria-labelledby="energy-insight" className="flex flex-col gap-5" data-testid="energy-insight">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardHeader title={<span id="energy-insight">{t("title")}</span>} description={t("description")} />
        {insight ? (
          <Badge size="sm" tone="neutral">
            {t("window", {
              from: formatDate(insight.windowFrom, locale, { style: "dayMonth" }),
              to: formatDate(insight.windowTo, locale),
            })}
          </Badge>
        ) : null}
      </div>
      {!insight ? (
        <SectionError error={result.error} />
      ) : (
        <>
          {insight.reason === "insufficient_data" || insight.score === null ? (
            <div className="bg-bg-subtle rounded-card flex items-start gap-3 p-4" data-testid="energy-insufficient">
              <span className="bg-surface text-muted grid size-10 shrink-0 place-items-center rounded-full">
                <Icon icon={IconElectric} />
              </span>
              <div className="flex flex-col gap-1">
                <p className="m-0 font-semibold">{t("insufficient.title")}</p>
                <p className="text-muted m-0 text-sm">{t("insufficient.body", { days: insight.metrics.dataDays })}</p>
              </div>
            </div>
          ) : (
            <Score insight={insight} locale={locale} />
          )}
          <section aria-labelledby="energy-share" className="border-border flex flex-col gap-3 border-t pt-4">
            <h3 id="energy-share" className="text-base font-semibold">
              {t("share.title")}
            </h3>
            <p className="text-muted m-0 text-sm">{t("share.what")}</p>
            <EnergyOptIn insight={insight} />
          </section>
        </>
      )}
    </Card>
  );
}

async function Score({ insight, locale }: { insight: Schemas["EnergyInsightDto"]; locale: Locale }) {
  const t = await getTranslations("owner.insight.energy");
  const m = insight.metrics;
  const score = insight.score ?? 0;
  const share = ratioToPercent(m.commonAreaShare);
  const load = ratioToPercent(m.loadFactor);
  const metrics: [string, string, string | null][] = [
    ["total", t("metrics.total"), t("kwh", { value: formatDecimal(m.totalKwh, locale, 0) })],
    [
      "common",
      t("metrics.common"),
      share !== null
        ? t("kwhShare", { value: formatDecimal(m.commonAreaKwh, locale, 0), share: formatDecimal(share, locale, 1) })
        : t("kwh", { value: formatDecimal(m.commonAreaKwh, locale, 0) }),
    ],
    ["peak", t("metrics.peak"), t("kw", { value: formatDecimal(m.peakKw, locale, 1) })],
    ["average", t("metrics.average"), t("kw", { value: formatDecimal(m.averageKw, locale, 1) })],
    ["load", t("metrics.load"), load !== null ? `${formatDecimal(load, locale, 0)}%` : null],
    [
      "pump",
      t("metrics.pump"),
      m.pumpHoursPerDay !== null ? t("hours", { value: formatDecimal(m.pumpHoursPerDay, locale, 1) }) : null,
    ],
    ["basis", t("metrics.basis"), t(`basis.${m.basis}`)],
    ["days", t("metrics.days"), formatNumber(m.dataDays, locale)],
  ];
  const penalties = (
    [
      ["commonShare", insight.penalties.commonShare],
      ["lowLoadFactor", insight.penalties.lowLoadFactor],
      ["pumpHours", insight.penalties.pumpHours],
    ] as const
  ).map(([key, points]) => ({ key, points, hit: penalised(points) }));
  return (
    <div className="grid gap-6 md:grid-cols-[10rem_minmax(0,1fr)]" data-testid="energy-score" data-score={score}>
      <div className="flex flex-col items-center gap-2">
        <svg viewBox="0 0 100 100" className="size-36" role="img" aria-label={t("scoreLabel", { score })}>
          <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="10" className="stroke-bg-subtle" />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={scoreArc(score, CIRCUMFERENCE)}
            transform="rotate(-90 50 50)"
            className="stroke-primary"
          />
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-fg text-2xl font-semibold">
            {score}
          </text>
        </svg>
        <span className="text-muted text-xs">{t("model", { model: insight.scoreModel })}</span>
      </div>
      <div className="flex flex-col gap-4">
        <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="energy-metrics">
          {metrics
            .filter((row): row is [string, string, string] => row[2] !== null)
            .map(([key, term, value]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <dt className="text-muted text-xs">{term}</dt>
                <dd className="m-0 text-sm font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
        </dl>
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm font-semibold">{t("penalties.title")}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="energy-penalties">
            {penalties.map(({ key, points, hit }) => (
              <li key={key} className="flex items-center justify-between gap-3 text-sm">
                <span className={cn(!hit && "text-muted")}>{t(`penalties.${key}`)}</span>
                <span className={cn("tabular-nums", hit ? "font-semibold" : "text-muted")}>
                  {hit ? t("penalties.points", { points: formatDecimal(points, locale, 1) }) : t("penalties.none")}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted m-0 text-xs">{t("penalties.note")}</p>
        </div>
      </div>
    </div>
  );
}
