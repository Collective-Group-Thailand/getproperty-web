import { getTranslations } from "next-intl/server";

import { READING_REVIEW_STATUS, READING_REVIEW_VALUES } from "@/domain/status/readingReview";
import { READING_SOURCE_VALUES, type ReadingSource } from "@/domain/status/readingSource";
import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { FilterBar } from "../shared/FilterBar";
import { ownerPath } from "../shared/links";
import { ListPagination } from "../shared/ListPagination";
import { OwnerPage, PageHeader } from "../shared/PageHeader";
import { PhotoThumb } from "../shared/PhotoThumb";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";
import { MeteringNav } from "./MetersView";
import { ReviewDecision } from "./ReviewDecision";

type SearchParams = Record<string, string | string[] | undefined>;

function isSource(value: string): value is ReadingSource {
  return (READING_SOURCE_VALUES as string[]).includes(value);
}

/**
 * The reading review queue (F2 2.5, D-035 / D-142): readings held because OCR was unsure, the value is
 * outside the plausible band, lower than the previous one, or without its photo — each with the photo,
 * the band and trailing average the API computed, and accept / correct / reject.
 */
export async function ReviewsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.meters.reviews");
  const status = await getTranslations("status.readingReview");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const statusParam = param(searchParams.status) ?? "open";
  const list = await unwrap(
    api.GET("/v1/owner/meter-readings/reviews", {
      params: {
        query: {
          page: pageParam(searchParams.page),
          perPage: 20,
          buildingId: building?.id,
          status: READING_REVIEW_VALUES.includes(statusParam as Schemas["ReviewStatus"])
            ? (statusParam as Schemas["ReviewStatus"])
            : undefined,
        },
      },
    }),
  );
  const open =
    statusParam === "open"
      ? list.meta.total
      : await unwrap(
          api.GET("/v1/owner/meter-readings/reviews", {
            params: { query: { status: "open", perPage: 1, buildingId: building?.id } },
          }),
        )
          .then((page) => page.meta.total)
          .catch(() => undefined);

  return (
    <OwnerPage testId="reading-reviews">
      <PageHeader title={t("title")} description={t("description")} crumbs={[{ label: t("title") }]} />
      <MeteringNav current="/meters/reviews" locale={locale} open={open} />
      <FilterBar
        fields={[
          {
            name: "status",
            label: t("status"),
            type: "select",
            options: READING_REVIEW_VALUES.map((value) => ({ value, label: status(value) })),
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconCheckCircle} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="review-list">
          {list.data.map((review) => (
            <li key={review.id}>
              <Card
                className="flex flex-col gap-3 md:flex-row md:items-start"
                data-testid="review-card"
                data-reason={review.reason}
              >
                {review.reading.evidenceDocumentId ? (
                  <PhotoThumb
                    fileId={review.reading.evidenceDocumentId}
                    alt={t("photoAlt", {
                      meter: review.reading.meterCode,
                      date: formatDate(review.reading.readAt, locale),
                    })}
                    size="lg"
                    className="shrink-0 md:w-48"
                  />
                ) : (
                  <span className="text-muted w-32 text-sm">{t("noPhoto")}</span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      className="font-mono font-semibold underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/meters/${review.reading.assetItemId}`)}
                    >
                      {review.reading.meterCode}
                    </a>
                    {review.unitNo ? <span>{t("unit", { unit: review.unitNo })}</span> : null}
                    <StatusBadgeOf map={READING_REVIEW_STATUS} value={review.status} size="sm" />
                    <Badge tone="warning" size="sm">
                      {t(`reason.${review.reason}`)}
                    </Badge>
                  </div>
                  <DescriptionList
                    columns={3}
                    items={[
                      {
                        id: "register",
                        term: t("register"),
                        description: (
                          <span className="flex items-center gap-2">
                            <span className="font-mono tabular-nums" data-testid="review-register-value">
                              {review.correctedRegister ?? review.reading.register}
                            </span>
                            {isSource(review.reading.source) ? (
                              <ReadingSourceBadge source={review.reading.source} />
                            ) : null}
                          </span>
                        ),
                      },
                      { id: "readAt", term: t("readAt"), description: formatDateTime(review.reading.readAt, locale) },
                      {
                        id: "ocr",
                        term: t("ocr"),
                        description: review.reading.ocrRawValue ? (
                          <span className="font-mono">{review.reading.ocrRawValue}</span>
                        ) : null,
                      },
                      {
                        id: "band",
                        term: t("band"),
                        description:
                          review.bandLow && review.bandHigh ? (
                            <span className="font-mono">
                              {t("bandValue", { low: review.bandLow, high: review.bandHigh })}
                            </span>
                          ) : null,
                      },
                      {
                        id: "avg",
                        term: t("trailingAvg"),
                        description: review.trailingAvg ? (
                          <span className="font-mono">{review.trailingAvg}</span>
                        ) : null,
                      },
                      { id: "note", term: t("decisionNote"), description: review.decisionNote },
                    ]}
                  />
                </div>
                <ReviewDecision review={review} />
              </Card>
            </li>
          ))}
        </ul>
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
