import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { READING_STATUS } from "@/domain/status/reading";
import { READING_SOURCE_VALUES, type ReadingSource } from "@/domain/status/readingSource";
import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatUnits } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { Chart } from "@/ui/charts/Chart";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { LinkTabs } from "@/ui/components/LinkTabs";

import { ownerPath, withQuery } from "../shared/links";
import { SERIES_BUCKETS, SERIES_RANGE_MS, seriesBucketFor } from "./series";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { PhotoThumb } from "../shared/PhotoThumb";
import { pageParam, param, section, type OwnerContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;
const BUCKETS = SERIES_BUCKETS;

function isSource(value: string): value is ReadingSource {
  return (READING_SOURCE_VALUES as string[]).includes(value);
}

/**
 * One meter (F2 2.5): what and where it measures, the usage series of a smart meter (15 min / 1 h / 1 day
 * buckets as a line chart with its data-table fallback; manual meters chart the consumption between
 * readings), and the reading history with source, review state and photo.
 */
export async function MeterDetail({
  context,
  assetItemId,
  searchParams,
}: {
  context: OwnerContext;
  assetItemId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.meters.detail");
  const meterT = await getTranslations("owner.meters");
  const { api, locale } = context;
  const meter = await unwrap(api.GET("/v1/owner/meters/{assetItemId}", { params: { path: { assetItemId } } })).catch(
    (error: unknown) => {
      if (isApiError(error) && error.status === 404) notFound();
      throw error;
    },
  );
  const building = context.buildings.find((candidate) => candidate.id === meter.buildingId);
  if (!building) notFound();

  const bucketParam = param(searchParams.bucket);
  const bucket: Schemas["SeriesBucket"] = BUCKETS.includes(bucketParam as Schemas["SeriesBucket"])
    ? (bucketParam as Schemas["SeriesBucket"])
    : "1h";
  const to = new Date();
  const from = new Date(to.getTime() - SERIES_RANGE_MS[bucket]);
  // D-241: 15-minute points come from raw points (24 months); a window beyond that is asked for in a coarser bucket.
  const asked = seriesBucketFor(bucket, from, to);
  const [series, readings] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/meters/{assetItemId}/series", {
          params: {
            path: { assetItemId },
            query: { bucket: asked, from: from.toISOString(), to: to.toISOString() },
          },
        }),
      ),
    ),
    unwrap(
      api.GET("/v1/owner/meters/{assetItemId}/readings", {
        params: {
          path: { assetItemId },
          query: { page: pageParam(searchParams.page), perPage: 20, sort: "readAt", order: "desc" },
        },
      }),
    ),
  ]);
  const unit = meter.utility === "electric" ? "kWh" : "m3";
  const smart = (series.data?.points.length ?? 0) > 0;
  const points = smart
    ? series.data!.points.map((point) => ({
        key: point.bucket,
        label:
          asked === "1d"
            ? formatDate(point.bucket, locale, { style: "dayMonth" })
            : formatDateTime(point.bucket, locale, { style: "dayMonth" }),
        value: point.usage,
      }))
    : [...readings.data]
        .reverse()
        .filter((reading) => reading.consumption !== null)
        .map((reading) => ({
          key: reading.id,
          label: formatDate(reading.readAt, locale, { style: "dayMonth" }),
          value: reading.consumption,
        }));
  const tab = (value: Schemas["SeriesBucket"]) =>
    ownerPath(locale, withQuery(`/meters/${assetItemId}`, { building: building.id, bucket: value }));

  return (
    <OwnerPage testId="meter-detail">
      <PageHeader
        title={meter.code}
        testId="meter-title"
        description={`${meterT(`utility.${meter.utility}`)} · ${meter.name} · ${building.name}`}
        crumbs={[{ label: meter.code }]}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card as="section" aria-labelledby="meter-facts">
          <CardHeader title={<span id="meter-facts">{t("facts")}</span>} />
          <DescriptionList
            columns={1}
            items={[
              {
                id: "assignment",
                term: t("assignment"),
                description: meter.unitNo ? (
                  <a className="underline-offset-4 hover:underline" href={ownerPath(locale, `/units/${meter.unitId}`)}>
                    {meterT("unit", { unit: meter.unitNo })}
                  </a>
                ) : (
                  (meter.commonAreaLabel ?? meterT(`purpose.${meter.purpose}`))
                ),
              },
              { id: "serial", term: t("serial"), description: meter.serial },
              { id: "multiplier", term: t("multiplier"), description: meter.multiplier },
              {
                id: "initial",
                term: t("initial"),
                description: <span className="font-mono">{meter.initialReading}</span>,
              },
              { id: "since", term: t("since"), description: formatDate(meter.validFrom, locale) },
              ...(meter.validTo
                ? [{ id: "until", term: t("until"), description: formatDate(meter.validTo, locale) }]
                : []),
            ]}
          />
        </Card>
        <Card as="section" aria-labelledby="meter-usage" data-testid="meter-usage">
          <CardHeader
            title={<span id="meter-usage">{smart ? t("seriesTitle") : t("consumptionTitle")}</span>}
            description={smart ? t("seriesHint") : t("consumptionHint")}
          />
          {smart ? (
            <LinkTabs
              label={t("buckets")}
              current={tab(bucket)}
              className="mb-3"
              tabs={BUCKETS.map((value) => ({
                href: tab(value),
                label: t(`bucket.${value}`),
                testId: `bucket-${value}`,
              }))}
            />
          ) : null}
          <Chart
            type={smart ? "line" : "bar"}
            points={points}
            title={
              smart ? t("chartTitle", { meter: meter.code, bucket: t(`bucket.${bucket}`) }) : t("consumptionTitle")
            }
            formatValue={(value) => formatUnits(value, unit, locale)}
            table={{ summary: t("table"), label: t("when"), value: t("usage") }}
            emptyText={t("noData")}
            data-testid="meter-chart"
          />
        </Card>
      </div>
      <Card as="section" aria-labelledby="meter-readings" data-testid="meter-readings">
        <CardHeader title={<span id="meter-readings">{t("readings")}</span>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">{t("readings")}</caption>
            <thead>
              <tr className="border-border text-muted border-b">
                <th scope="col" className="py-2 text-start font-medium">
                  {t("when")}
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  {t("register")}
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  {t("usage")}
                </th>
                <th scope="col" className="py-2 ps-4 text-start font-medium">
                  {t("source")}
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  {t("photo")}
                </th>
              </tr>
            </thead>
            <tbody>
              {readings.data.map((reading) => (
                <tr key={reading.id} className="border-border border-b" data-testid="reading-row">
                  <th scope="row" className="py-2 text-start font-normal">
                    {formatDateTime(reading.readAt, locale)}
                  </th>
                  <td className="py-2 text-end font-mono tabular-nums">{reading.register}</td>
                  <td className="py-2 text-end tabular-nums">
                    {reading.consumption ? formatUnits(reading.consumption, unit, locale) : "—"}
                  </td>
                  <td className="py-2 ps-4">
                    <span className="flex flex-wrap items-center gap-1">
                      {isSource(reading.source) ? <ReadingSourceBadge source={reading.source} /> : null}
                      <StatusBadgeOf map={READING_STATUS} value={reading.reviewState} size="sm" />
                    </span>
                  </td>
                  <td className="py-2">
                    {reading.evidenceDocumentId ? (
                      <PhotoThumb
                        fileId={reading.evidenceDocumentId}
                        alt={t("photoAlt", {
                          meter: meter!.code,
                          register: reading.register,
                          date: formatDate(reading.readAt, locale),
                        })}
                        size="sm"
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination
          meta={readings.meta}
          path={ownerPath(locale, `/meters/${assetItemId}`)}
          searchParams={searchParams}
          locale={locale}
        />
      </Card>
    </OwnerPage>
  );
}
