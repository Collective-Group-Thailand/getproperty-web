import { getTranslations } from "next-intl/server";

import { READING_REVIEW_STATUS, READING_REVIEW_VALUES } from "@/domain/status/readingReview";
import { READING_SOURCE_VALUES, type ReadingSource } from "@/domain/status/readingSource";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber, formatUnits } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { MobileActionBar } from "@/ui/components/FormLayout";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { PhotoPlaceholder } from "@/ui/components/PhotoPlaceholder";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconFlag } from "@/ui/icons/glyphs/flag";

import { ownerPath, withQuery } from "../shared/links";
import { PhotoThumb } from "../shared/PhotoThumb";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";
import { viewCounts } from "../shared/views";
import { ReviewDecision } from "./ReviewDecision";

type SearchParams = Record<string, string | string[] | undefined>;
type Review = Schemas["ReadingReviewDto"];

function isSource(value: string): value is ReadingSource {
  return (READING_SOURCE_VALUES as string[]).includes(value);
}

/**
 * The reading review queue (F2 2.5, D-035 / D-142; G4): readings held because the photo read was unsure, the value
 * is outside the plausible band, lower than the previous one, or without its photo. On a desktop a dense table —
 * photo, meter and reason, the reading and its source, usage, the API's band and average, time — with accept /
 * correct / reject on each row; on a phone one reading at a time, the photo large and the decision in a bottom bar.
 */
export async function ReviewsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.meters.reviews");
  const status = await getTranslations("status.readingReview");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const statusParam = READING_REVIEW_VALUES.find((value) => value === param(searchParams.status)) ?? "open";
  const [list, counts] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/meter-readings/reviews", {
        params: {
          query: { page: pageParam(searchParams.page), perPage: 20, buildingId: building?.id, status: statusParam },
        },
      }),
    ),
    viewCounts(["open"] as const, () =>
      unwrap(
        api.GET("/v1/owner/meter-readings/reviews", {
          params: { query: { status: "open", perPage: 1, buildingId: building?.id } },
        }),
      ),
    ),
  ]);
  const path = (query: Record<string, string | number | undefined>) =>
    ownerPath(locale, withQuery("/meters/reviews", query));
  const at = Math.min(Math.max(Number(param(searchParams.at) ?? 0) || 0, 0), Math.max(list.data.length - 1, 0));
  const focus = list.data[at];
  const photoOf = (review: Review, size: "thumb" | "lg") =>
    review.reading.evidenceDocumentId ? (
      <PhotoThumb
        fileId={review.reading.evidenceDocumentId}
        alt={t("photoAlt", { meter: review.reading.meterCode, date: formatDate(review.reading.readAt, locale) })}
        size={size}
      />
    ) : (
      <PhotoPlaceholder
        className={size === "thumb" ? "rounded-thumb h-12 w-16" : "rounded-panel aspect-[4/3] w-full"}
        label={t("noPhoto")}
      />
    );
  const value = (review: Review) => review.correctedRegister ?? review.reading.register;
  const usage = (review: Review) =>
    review.reading.consumption
      ? formatUnits(review.reading.consumption, review.reading.unit === "kwh" ? "kWh" : "m3", locale)
      : null;
  const band = (review: Review) =>
    review.bandLow && review.bandHigh ? t("bandValue", { low: review.bandLow, high: review.bandHigh }) : null;

  return (
    <OwnerPage testId="reading-reviews">
      <PageHeader title={t("title")} description={t("description")} />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("status")}
            current={statusParam}
            tabs={READING_REVIEW_VALUES.map((value) => ({
              key: value,
              href: path({ status: value === "open" ? undefined : value }),
              label: status(value),
              count: value === "open" ? counts.open : undefined,
              testId: `review-tab-${value}`,
            }))}
          />
        }
      />
      {list.data.length === 0 || !focus ? (
        <EmptyState
          variant="card"
          icon={IconCheckCircle}
          title={statusParam === "open" ? t("empty.title") : t("empty.otherTitle")}
          description={t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/meters")}>{t("empty.meters")}</a>
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop: the queue as one dense table. */}
          <div className="border-border bg-surface rounded-card shadow-card relative overflow-x-auto border max-md:hidden">
            <table className="w-full min-w-[64rem] text-base" data-testid="review-list">
              <caption className="sr-only">{t("title")}</caption>
              <thead>
                <tr className="border-border text-muted border-b text-sm">
                  <th scope="col" className="w-24 px-4 py-2.5 text-start font-medium">
                    {t("col.photo")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("col.meter")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    {t("register")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    {t("col.usage")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    {t("band")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("readAt")}
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">{t("col.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((review) => (
                  <tr
                    key={review.id}
                    className="border-border border-b align-top last:border-b-0"
                    data-testid="review-card"
                    data-reason={review.reason}
                  >
                    <td className="px-4 py-3">{photoOf(review, "thumb")}</td>
                    <th scope="row" className="px-4 py-3 text-start font-normal">
                      <span className="flex flex-col items-start gap-1">
                        <a
                          className="font-mono font-medium underline-offset-4 hover:underline"
                          href={ownerPath(locale, `/meters/${review.reading.assetItemId}`)}
                        >
                          {review.reading.meterCode}
                        </a>
                        <span className="text-muted text-sm">
                          {review.unitNo ? t("unit", { unit: review.unitNo }) : t("commonArea")}
                        </span>
                        {review.status === "open" ? (
                          <Badge tone="warning" size="sm" icon={IconFlag}>
                            {t(`reason.${review.reason}`)}
                          </Badge>
                        ) : (
                          <StatusBadgeOf map={READING_REVIEW_STATUS} value={review.status} size="sm" />
                        )}
                      </span>
                    </th>
                    <td className="px-4 py-3 text-end">
                      <span className="flex flex-col items-end gap-1">
                        <span className="font-mono font-medium tabular-nums" data-testid="review-register-value">
                          {value(review)}
                        </span>
                        {isSource(review.reading.source) ? <ReadingSourceBadge source={review.reading.source} /> : null}
                        {review.reading.ocrRawValue ? (
                          <span className="text-muted text-sm">
                            {t("ocrValue", { value: review.reading.ocrRawValue })}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap tabular-nums">
                      {usage(review) ?? <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <span className="flex flex-col items-end gap-0.5">
                        <span className="font-mono text-sm whitespace-nowrap">{band(review) ?? "—"}</span>
                        {review.trailingAvg ? (
                          <span className="text-muted text-sm whitespace-nowrap">
                            {t("avgValue", { value: review.trailingAvg })}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="text-muted px-4 py-3 text-sm whitespace-nowrap tabular-nums">
                      {formatDateTime(review.reading.readAt, locale)}
                      {review.decisionNote ? (
                        <span className="text-fg mt-1 block max-w-48 whitespace-normal">{review.decisionNote}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <ReviewDecision review={review} photo={photoOf(review, "lg")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: one reading at a time, the decision in a bottom bar. */}
          <section
            className="flex flex-col gap-4 md:hidden"
            aria-labelledby="review-focus-title"
            data-testid="review-focus"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="review-focus-title" className="text-base font-semibold tabular-nums">
                {t("position", {
                  at: formatNumber((list.meta.page - 1) * list.meta.perPage + at + 1, locale),
                  total: formatNumber(list.meta.total, locale),
                })}
              </h2>
              {list.data.length > 1 ? (
                <a
                  className="text-primary inline-flex min-h-11 items-center px-2 font-medium"
                  href={path({
                    status: statusParam === "open" ? undefined : statusParam,
                    page: list.meta.page,
                    at: (at + 1) % list.data.length,
                  })}
                >
                  {t("skip")}
                </a>
              ) : null}
            </div>
            <Card padding="none" className="overflow-hidden">
              <div className="relative">
                {photoOf(focus, "lg")}
                {focus.status === "open" ? (
                  <span className="absolute start-3 top-3">
                    <Badge tone="warning" size="sm" icon={IconFlag}>
                      {t(`reason.${focus.reason}`)}
                    </Badge>
                  </span>
                ) : null}
              </div>
              <dl className="divide-border flex flex-col divide-y px-4">
                {[
                  {
                    key: "meter",
                    label: t("col.meter"),
                    value: <span className="font-mono">{focus.reading.meterCode}</span>,
                  },
                  { key: "unit", label: t("col.place"), value: focus.unitNo ?? t("commonArea") },
                  {
                    key: "register",
                    label: t("register"),
                    value: <span className="font-mono text-lg font-semibold">{value(focus)}</span>,
                  },
                  { key: "usage", label: t("col.usage"), value: usage(focus) ?? "—" },
                  { key: "band", label: t("band"), value: band(focus) ?? "—" },
                  { key: "avg", label: t("trailingAvg"), value: focus.trailingAvg ?? "—" },
                  { key: "readAt", label: t("readAt"), value: formatDateTime(focus.reading.readAt, locale) },
                ].map((fact) => (
                  <div key={fact.key} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="text-muted text-sm">{fact.label}</dt>
                    <dd className="text-end tabular-nums">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            {focus.nextActions.includes("decide") ? (
              <MobileActionBar>
                <ReviewDecision review={focus} layout="bar" photo={photoOf(focus, "lg")} />
              </MobileActionBar>
            ) : null}
          </section>
        </>
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/meters/reviews")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
