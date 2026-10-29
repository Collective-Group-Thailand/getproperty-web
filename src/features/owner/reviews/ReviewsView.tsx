import { getTranslations } from "next-intl/server";

import { BUILDING_REVIEW_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { Stars } from "@/features/shared/growth/Stars";
import { reviewTenure } from "@/features/shared/growth/reviews";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconStar } from "@/ui/icons/glyphs/star";

import { ownerPath } from "../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../shared/server";
import { ReviewActions } from "./ReviewActions";

type SearchParams = Record<string, string | string[] | undefined>;
const STATES: Schemas["OwnerReviewState"][] = ["published", "hidden"];

/**
 * Verified reviews of my buildings (G9, D-301): only people who lived under one of my leases can write one, and the
 * getproperty moderators publish it. Each shows the rating, the text, how long the reviewer lived there (months only)
 * and my public reply; a hidden review shows the moderators' reason. I can reply and report — never hide or delete.
 */
export async function ReviewsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.insight.reviews");
  const { api, locale, me } = context;
  const buildingParam = param(searchParams.building);
  const building = context.buildings.find((candidate) => candidate.id === buildingParam);
  const stateParam = param(searchParams.state);
  const state = STATES.includes(stateParam as Schemas["OwnerReviewState"])
    ? (stateParam as Schemas["OwnerReviewState"])
    : undefined;
  const list = await section(
    unwrap(
      api.GET("/v1/owner/reviews", {
        params: {
          query: { buildingId: building?.id, state, page: pageParam(searchParams.page), perPage: 20 },
        },
      }),
    ),
  );
  const canAct = !readOnly(me) && ownerCan(me, "listing.manage");
  const rows = list.data?.data ?? [];

  return (
    <OwnerPage testId="owner-reviews">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("crumb"), href: ownerPath(locale, "/listings") }, { label: t("title") }]}
      />
      <Callout tone="info" icon={IconShield} title={t("howTitle")}>
        {t("howBody")}
      </Callout>
      <FilterBar
        fields={[
          {
            name: "building",
            label: t("filter.building"),
            type: "select",
            placeholder: t("filter.allBuildings"),
            options: context.buildings.map((candidate) => ({ value: candidate.id, label: candidate.name })),
          },
          {
            name: "state",
            label: t("filter.state"),
            type: "select",
            placeholder: t("filter.allStates"),
            options: STATES.map((value) => ({ value, label: t(`filter.states.${value}`) })),
          },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <Card padding="lg">
          <EmptyState icon={IconStar} title={t("empty.title")} description={t("empty.description")} />
        </Card>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0" data-testid="review-rows">
          {rows.map((review) => (
            <ReviewCard key={review.id} review={review} locale={locale} canAct={canAct} />
          ))}
        </ul>
      )}
      {list.data ? (
        <ListPagination
          meta={list.data.meta}
          path={ownerPath(locale, "/reviews")}
          searchParams={searchParams}
          locale={locale}
        />
      ) : null}
    </OwnerPage>
  );
}

async function ReviewCard({
  review,
  locale,
  canAct,
}: {
  review: Schemas["OwnerReviewDto"];
  locale: Locale;
  canAct: boolean;
}) {
  const t = await getTranslations("owner.insight.reviews");
  const tenure = reviewTenure(review.tenure, locale);
  return (
    <Card as="li" className="flex flex-col gap-3" data-testid="review-row" data-state={review.state}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Stars rating={review.rating} label={t("stars", { rating: review.rating })} size={18} />
          <span className="text-muted text-sm">
            {review.buildingName} · {t(tenure.to ? "tenureFromTo" : "tenureFrom", tenure)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge size="sm" tone="primary" icon={IconShield}>
            {t("verified")}
          </Badge>
          <StatusBadgeOf map={BUILDING_REVIEW_STATUS} value={review.state} size="sm" />
        </div>
      </div>
      {review.body ? (
        <p className="m-0 leading-relaxed break-words whitespace-pre-line" data-testid="review-body">
          {review.body}
        </p>
      ) : null}
      {review.state === "hidden" && review.moderationReason ? (
        <div data-testid="review-moderation-reason">
          <Callout tone="warning" title={t("hiddenTitle")}>
            {review.moderationReason}
          </Callout>
        </div>
      ) : null}
      {review.reportedAt ? (
        <p className="text-muted m-0 inline-flex items-center gap-1 text-sm" data-testid="review-reported">
          <Icon icon={IconFlag} />
          {t("reportedOn", { date: formatDate(review.reportedAt, locale) })}
          {review.reportReason ? ` — ${review.reportReason}` : ""}
        </p>
      ) : null}
      {review.ownerReply ? (
        <div className="bg-bg-subtle rounded-card flex flex-col gap-1 p-3" data-testid="review-owner-reply">
          <span className="text-sm font-semibold">
            {t("yourReply")}
            {review.ownerRepliedAt ? (
              <span className="text-muted font-normal"> · {formatDate(review.ownerRepliedAt, locale)}</span>
            ) : null}
          </span>
          <p className="m-0 text-sm break-words whitespace-pre-line">{review.ownerReply}</p>
        </div>
      ) : null}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-muted text-xs">
          {review.publishedAt ? t("publishedOn", { date: formatDate(review.publishedAt, locale) }) : null}
        </span>
        {canAct ? <ReviewActions review={review} /> : null}
      </div>
    </Card>
  );
}
