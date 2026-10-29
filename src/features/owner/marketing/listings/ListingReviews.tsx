import { getTranslations } from "next-intl/server";

import { Stars } from "@/features/shared/growth/Stars";
import { ratingBars, reviewTenure } from "@/features/shared/growth/reviews";
import { formatDate, formatDecimal, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { IconShield } from "@/ui/icons/glyphs/shield";

import type { PublicReviews } from "../publicApi";

/**
 * Verified reviews on a public listing (G9, D-301): the building's rating summary and its reviews, newest first, five
 * a page (`?reviews=n`, plain links — no JavaScript on the public page). Each review says "verified tenant", how long
 * they lived there (months only) and carries the owner's public reply. No name, unit or exact date of a reviewer
 * exists here. Nothing is rendered while the building has no published review.
 */
export async function ListingReviews({
  reviews,
  locale,
  pageHref,
}: {
  reviews: PublicReviews;
  locale: Locale;
  pageHref: (page: number) => string;
}) {
  const t = await getTranslations("owner.marketing.listings.reviews");
  const { summary, meta } = reviews;
  if (summary.count === 0) return null;
  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));
  return (
    <section aria-labelledby="reviews-title" id="reviews" className="scroll-mt-24" data-testid="listing-reviews">
      <h2 id="reviews-title" className="text-xl">
        {t("title")}
      </h2>
      <p className="text-muted mt-1 text-sm">{t("intro")}</p>
      <div className="mt-4 grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3" data-testid="listing-reviews-summary">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {summary.average ? formatDecimal(summary.average, locale, 1) : "—"}
            </span>
            <span className="text-muted text-sm">{t("outOf")}</span>
          </div>
          {summary.average ? (
            <Stars rating={Number(summary.average)} label={t("stars", { rating: summary.average })} size={18} />
          ) : null}
          <span className="text-muted text-sm">{t("count", { count: summary.count })}</span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label={t("distribution")}>
            {ratingBars(summary.distribution).map((bar) => (
              <li key={bar.stars} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2 text-xs">
                <span className="text-muted tabular-nums">{t("starLabel", { stars: bar.stars })}</span>
                <span className="bg-bg-subtle h-2 overflow-hidden rounded-full" aria-hidden="true">
                  <span className="bg-primary block h-full rounded-full" style={{ width: `${bar.width}%` }} />
                </span>
                <span className="text-muted text-end tabular-nums">{formatNumber(bar.count, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <ol className="divide-border m-0 list-none divide-y p-0" data-testid="listing-review-list">
            {reviews.data.map((review) => {
              const tenure = reviewTenure(review.tenure, locale);
              return (
                <li key={review.id} className="flex flex-col gap-2 py-4 first:pt-0" data-testid="listing-review">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars rating={review.rating} label={t("stars", { rating: review.rating })} />
                    {review.verifiedTenant ? (
                      <Badge size="sm" tone="primary" icon={IconShield}>
                        {t("verified")}
                      </Badge>
                    ) : null}
                    <span className="text-muted text-xs">{t(tenure.to ? "livedFromTo" : "livesFrom", tenure)}</span>
                  </div>
                  <p className="m-0 leading-relaxed break-words whitespace-pre-line" lang={review.language}>
                    {review.body}
                  </p>
                  {review.ownerReply ? (
                    <div className="bg-surface-subtle border-border ms-4 flex flex-col gap-1 rounded-md border-s-2 p-3">
                      <span className="text-sm font-semibold">
                        {t("ownerReply")}
                        {review.ownerRepliedAt ? (
                          <span className="text-muted font-normal"> · {formatDate(review.ownerRepliedAt, locale)}</span>
                        ) : null}
                      </span>
                      <p className="m-0 text-sm break-words whitespace-pre-line">{review.ownerReply}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {pages > 1 ? (
            <nav aria-label={t("pages")} className="flex items-center justify-between gap-3 text-sm">
              {meta.page > 1 ? (
                <a
                  className="text-primary font-semibold underline-offset-4 hover:underline"
                  href={pageHref(meta.page - 1)}
                >
                  {t("newer")}
                </a>
              ) : (
                <span />
              )}
              <span className="text-muted tabular-nums">{t("page", { page: meta.page, pages })}</span>
              {meta.page < pages ? (
                <a
                  className="text-primary font-semibold underline-offset-4 hover:underline"
                  href={pageHref(meta.page + 1)}
                  data-testid="listing-reviews-next"
                >
                  {t("older")}
                </a>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
          <p className="text-muted m-0 text-xs">{t("policy")}</p>
        </div>
      </div>
    </section>
  );
}
