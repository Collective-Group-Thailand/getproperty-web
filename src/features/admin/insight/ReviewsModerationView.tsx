import { getTranslations } from "next-intl/server";

import { BUILDING_REVIEW_STATUS } from "@/domain/status";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { viewCounts } from "@/features/shared/console/views";
import { SectionError } from "@/features/shared/console/SectionError";
import { Stars } from "@/features/shared/growth/Stars";
import { reviewTenure } from "@/features/shared/growth/reviews";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { RowList } from "@/ui/components/RowList";
import { SplitView } from "@/ui/components/SplitView";
import { Icon } from "@/ui/icons";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { NotAllowed } from "../shared/NotAllowed";
import {
  can,
  pageParam,
  param,
  section,
  tenantLabel,
  tenantNames,
  withQuery,
  type AdminContext,
} from "../shared/server";
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
  if (!can(me, "admin.listing.moderate")) return <NotAllowed context={context} />;
  const selected = param(searchParams.id);
  const tabParam = param(searchParams.tab);
  const tab: ReviewTab = (REVIEW_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as ReviewTab)
    : "pending";
  const [list, names, counts] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/admin/reviews", {
          params: { query: { ...QUERY[tab], page: pageParam(searchParams.page), perPage: 20 } },
        }),
      ),
    ),
    tenantNames(),
    viewCounts(REVIEW_TABS, (key) =>
      unwrap(api.GET("/v1/admin/reviews", { params: { query: { ...QUERY[key], perPage: 1 } } })),
    ),
  ]);
  const href = (next: ReviewTab, id?: string) =>
    withQuery("/listings/reviews", { tab: next === "pending" ? undefined : next, id });
  return (
    <ConsolePage testId="admin-reviews">
      <PageHeader title={t("title")} description={t("description")} />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("tabsLabel")}
            current={tab}
            tabs={REVIEW_TABS.map((one) => ({
              key: one,
              href: href(one),
              label: t(`tab.${one}`),
              count: counts[one],
              testId: `reviews-tab-${one}`,
            }))}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCheckCircle}
          title={t(`empty.${tab}`)}
          description={listings("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <a href={tab === "pending" ? href("reported") : href("pending")}>
                {tab === "pending" ? t("openReported") : t("openPending")}
              </a>
            </Button>
          }
        />
      ) : (
        (() => {
          const rows = list.data.data;
          const review = rows.find((one) => one.id === selected) ?? rows[0]!;
          const tenure = reviewTenure(review.tenure, locale);
          return (
            <SplitView
              detailOnPhones={Boolean(selected)}
              list={
                <RowList
                  stacked
                  label={t(`tab.${tab}`)}
                  testId="admin-review-rows"
                  items={rows.map((one) => ({
                    key: one.id,
                    href: href(tab, one.id),
                    current: one.id === review.id,
                    testId: "admin-review-row",
                    title: one.buildingName,
                    meta: (
                      <span
                        className="inline-flex items-center gap-2"
                        data-state={one.state}
                        data-reported={one.reportedAt ? "true" : undefined}
                      >
                        <Stars rating={one.rating} label={t("stars", { rating: one.rating })} />
                        <span className="truncate">{tenantLabel(names, one.tenantId, "—")}</span>
                      </span>
                    ),
                    status: one.reportedAt ? (
                      <Badge size="sm" tone="warning">
                        {t("reportedBadge")}
                      </Badge>
                    ) : (
                      <StatusBadgeOf map={BUILDING_REVIEW_STATUS} value={one.state} size="sm" />
                    ),
                  }))}
                />
              }
              detail={
                <article
                  className="border-border bg-surface rounded-card shadow-card flex flex-col border"
                  data-testid="admin-review-preview"
                  data-state={review.state}
                  data-reported={review.reportedAt ? "true" : undefined}
                >
                  <div className="flex flex-col gap-4 p-5 md:p-6">
                    <a
                      href={href(tab)}
                      className="text-muted hover:text-fg inline-flex w-fit items-center gap-1 text-sm font-medium lg:hidden"
                    >
                      <Icon icon={IconChevronLeft} className="rtl:rotate-180" />
                      {t(`tab.${tab}`)}
                    </a>
                    <header className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-semibold">{review.buildingName}</h2>
                        <Stars rating={review.rating} label={t("stars", { rating: review.rating })} />
                        <span className="text-muted text-sm">
                          {tenantLabel(names, review.tenantId, "—")} ·{" "}
                          {t(tenure.to ? "tenureFromTo" : "tenureFrom", tenure)} ·{" "}
                          {t("submitted", { date: formatDateTime(review.submittedAt, locale) })}
                        </span>
                      </div>
                      <StatusBadgeOf map={BUILDING_REVIEW_STATUS} value={review.state} size="sm" />
                    </header>
                    {review.body ? (
                      <p
                        className="m-0 max-w-prose leading-relaxed break-words whitespace-pre-line"
                        data-testid="admin-review-body"
                      >
                        {review.body}
                      </p>
                    ) : (
                      <p className="text-muted m-0 text-sm">{t("noBody")}</p>
                    )}
                    {review.reportedAt ? (
                      <Callout
                        tone="warning"
                        title={t("reportTitle", { date: formatDateTime(review.reportedAt, locale) })}
                      >
                        <span data-testid="admin-review-report">{review.reportReason ?? "—"}</span>
                      </Callout>
                    ) : null}
                    {review.moderationReason ? (
                      <p className="text-muted m-0 text-sm">
                        {t("moderationReason", { reason: review.moderationReason })}
                      </p>
                    ) : null}
                    {review.ownerReply ? (
                      <div className="bg-bg-subtle rounded-control flex flex-col gap-1 p-3">
                        <span className="text-sm font-semibold">{t("ownerReply")}</span>
                        <p className="m-0 text-sm break-words whitespace-pre-line">{review.ownerReply}</p>
                      </div>
                    ) : null}
                    <details className="text-sm">
                      <summary className="text-primary w-fit cursor-pointer font-medium">{t("policyTitle")}</summary>
                      <p className="text-muted mt-2 mb-0 max-w-prose">{t("policyBody")}</p>
                    </details>
                  </div>
                  <footer className="border-border bg-bg-subtle/60 rounded-b-card border-t px-5 py-4 md:px-6">
                    <ReviewModeration review={review} />
                  </footer>
                </article>
              }
            />
          );
        })()
      )}
      {list.data ? (
        <ListPagination meta={list.data.meta} path="/listings/reviews" searchParams={searchParams} locale={locale} />
      ) : null}
    </ConsolePage>
  );
}
