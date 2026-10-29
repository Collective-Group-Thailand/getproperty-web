import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BUILDING_REVIEW_STATUS } from "@/domain/status";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { Stars } from "@/features/shared/growth/Stars";
import { reviewTenure } from "@/features/shared/growth/reviews";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { ListingsTabs } from "../listings/ModerationView";
import { can, pageParam, param, section, tenantLabel, tenantNames, type AdminContext } from "../shared/server";
import { ReviewModeration } from "./ReviewModeration";

type SearchParams = Record<string, string | string[] | undefined>;
export const REVIEW_TABS = ["pending", "reported", "hidden", "all"] as const;
type ReviewTab = (typeof REVIEW_TABS)[number];

const QUERY: Record<ReviewTab, { state?: Schemas["BuildingReviewState"]; reported?: boolean }> = {
  pending: { state: "pending_moderation" },
  reported: { reported: true },
  hidden: { state: "hidden" },
  all: {},
};

/**
 * Listings › Reviews (G9, D-301, O-035): the moderators' queue of verified building reviews — waiting for approval
 * (pre-moderation is on by default), reported by an owner, hidden, or all. Each shows the rating, the text, the
 * tenure in months, the owner's report and reply; the actions are the API's rules (approve / reject a pending one,
 * hide / restore, dismiss a report). The reviewer's identity is never shown here either.
 */
export async function ReviewsModerationView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("admin.insight.reviews");
  const listings = await getTranslations("admin.listings");
  const { api, locale, me } = context;
  if (!can(me, "admin.listing.moderate")) notFound();
  const tabParam = param(searchParams.tab);
  const tab: ReviewTab = (REVIEW_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as ReviewTab)
    : "pending";
  const [list, names] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/admin/reviews", {
          params: { query: { ...QUERY[tab], page: pageParam(searchParams.page), perPage: 20 } },
        }),
      ),
    ),
    tenantNames(),
  ]);
  const href = (next: ReviewTab) => (next === "pending" ? "/listings/reviews" : `/listings/reviews?tab=${next}`);
  return (
    <ConsolePage testId="admin-reviews">
      <PageHeader title={listings("title")} description={listings("description")} />
      <ListingsTabs context={context} current="/listings/reviews" />
      <Callout tone="info" title={t("policyTitle")}>
        {t("policyBody")}
      </Callout>
      <LinkTabs
        label={t("tabsLabel")}
        current={href(tab)}
        tabs={REVIEW_TABS.map((one) => ({ href: href(one), label: t(`tab.${one}`), testId: `reviews-tab-${one}` }))}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <Card padding="lg">
          <EmptyState icon={IconCheckCircle} title={t(`empty.${tab}`)} />
        </Card>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0" data-testid="admin-review-rows">
          {list.data.data.map((review) => {
            const tenure = reviewTenure(review.tenure, locale);
            return (
              <Card
                as="li"
                key={review.id}
                className="flex flex-col gap-3"
                data-testid="admin-review-row"
                data-state={review.state}
                data-reported={review.reportedAt ? "true" : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Stars rating={review.rating} label={t("stars", { rating: review.rating })} />
                    <span className="text-sm font-semibold">{review.buildingName}</span>
                    <span className="text-muted text-xs">
                      {tenantLabel(names, review.tenantId, "—")} ·{" "}
                      {t(tenure.to ? "tenureFromTo" : "tenureFrom", tenure)} ·{" "}
                      {t("submitted", { date: formatDateTime(review.submittedAt, locale) })} ·{" "}
                      {review.language.toUpperCase()}
                    </span>
                  </div>
                  <StatusBadgeOf map={BUILDING_REVIEW_STATUS} value={review.state} size="sm" />
                </div>
                {review.body ? (
                  <p className="m-0 leading-relaxed break-words whitespace-pre-line" data-testid="admin-review-body">
                    {review.body}
                  </p>
                ) : (
                  <p className="text-muted m-0 text-sm">{t("noBody")}</p>
                )}
                {review.reportedAt ? (
                  <Callout tone="warning" title={t("reportTitle", { date: formatDateTime(review.reportedAt, locale) })}>
                    <span data-testid="admin-review-report">{review.reportReason ?? "—"}</span>
                  </Callout>
                ) : null}
                {review.moderationReason ? (
                  <p className="text-muted m-0 text-sm">{t("moderationReason", { reason: review.moderationReason })}</p>
                ) : null}
                {review.ownerReply ? (
                  <div className="bg-bg-subtle rounded-card flex flex-col gap-1 p-3">
                    <span className="text-sm font-semibold">{t("ownerReply")}</span>
                    <p className="m-0 text-sm break-words whitespace-pre-line">{review.ownerReply}</p>
                  </div>
                ) : null}
                <div className="border-border border-t pt-3">
                  <ReviewModeration review={review} />
                </div>
              </Card>
            );
          })}
        </ul>
      )}
      {list.data ? (
        <ListPagination meta={list.data.meta} path="/listings/reviews" searchParams={searchParams} locale={locale} />
      ) : null}
    </ConsolePage>
  );
}
