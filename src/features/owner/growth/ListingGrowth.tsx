import { getTranslations } from "next-intl/server";

import { SOCIAL_POST_STATUS } from "@/domain/status";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconSettings } from "@/ui/icons/glyphs/settings";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { RetrySocialPost } from "./GrowthActions";
import { BoostOffer, BoostRow, MediaOffer, MediaOrderRow } from "./GrowthRows";

const OPEN_MEDIA: Schemas["MediaServiceState"][] = ["pending_payment", "requested", "scheduled"];

/**
 * A listing's growth (G4, G5): **promote** it — the listing boosts with the API's prices (or "not on sale yet",
 * O-027), its boosts with state and invoice — order a verified photo / 360° visit, and its **Facebook Page posts**
 * (state per connected Page, link, the reason a post failed and *Retry*). Only a published, visible listing can be
 * boosted or posted.
 */
export async function ListingGrowth({ context, listing }: { context: OwnerContext; listing: Schemas["ListingDto"] }) {
  const t = await getTranslations("owner.growth");
  const { api, locale, me } = context;
  const live = listing.state === "published" && !listing.hidden;
  const [products, boosts, media, orders, posts, pages] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/boost-products"))),
    section(unwrap(api.GET("/v1/owner/boosts", { params: { query: { listingId: listing.id } } }))),
    section(unwrap(api.GET("/v1/owner/media-service-products"))),
    section(unwrap(api.GET("/v1/owner/media-service-orders"))),
    section(
      unwrap(api.GET("/v1/owner/listings/{listingId}/social-posts", { params: { path: { listingId: listing.id } } })),
    ),
    section(unwrap(api.GET("/v1/owner/social-channels"))),
  ]);
  const canBuy = ownerCan(me, "tenant.subscription.manage") && !readOnly(me) && live;
  const canRetry = ownerCan(me, "listing.manage") && !readOnly(me);
  const listingProducts = products.data?.products.filter((product) => product.target === "listing") ?? [];
  const mine = orders.data?.data.filter((order) => order.listingId === listing.id) ?? [];
  const target = { id: listing.id, name: listing.titleTh };
  const page = pages.data?.find((channel) => channel.state !== "revoked") ?? null;

  return (
    <>
      <Card
        as="section"
        aria-labelledby="listing-promote"
        className="flex flex-col gap-6"
        data-testid="listing-promote"
      >
        <CardHeader
          title={<span id="listing-promote">{t("listing.title")}</span>}
          description={live ? t("listing.description") : t("listing.notLive")}
          action={
            <Button asChild variant="ghost" size="sm">
              <a href={ownerPath(locale, "/promote")} data-testid="listing-promote-all">
                {t("listing.all")}
              </a>
            </Button>
          }
        />
        <section aria-labelledby="listing-boosts" className="flex flex-col gap-3">
          <h3 id="listing-boosts" className="text-sm font-semibold">
            {t("boost.title")}
          </h3>
          {!products.data ? (
            <SectionError error={products.error} />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
              {listingProducts.map((product) => (
                <BoostOffer
                  key={product.id}
                  product={product}
                  target={target}
                  locale={locale}
                  canBuy={canBuy}
                  pending={
                    boosts.data?.data.find(
                      (boost) => boost.productId === product.id && boost.state === "pending_payment",
                    ) ?? null
                  }
                />
              ))}
            </ul>
          )}
          {boosts.data && boosts.data.data.length > 0 ? (
            <ul className="divide-border m-0 list-none divide-y p-0" aria-label={t("boost.mine")}>
              {boosts.data.data.map((boost) => (
                <BoostRow key={boost.id} boost={boost} locale={locale} />
              ))}
            </ul>
          ) : null}
          <p className="text-muted m-0 text-xs">{t("boost.howRanked")}</p>
        </section>

        <section aria-labelledby="listing-media" className="flex flex-col gap-3">
          <h3 id="listing-media" className="text-sm font-semibold">
            {t("media.title")}
          </h3>
          {!media.data ? (
            <SectionError error={media.error} />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
              {media.data.products.map((product) => (
                <MediaOffer
                  key={product.id}
                  product={product}
                  listing={{ id: listing.id, title: listing.titleTh }}
                  locale={locale}
                  canBuy={canBuy}
                  open={
                    mine.find((order) => order.service === product.service && OPEN_MEDIA.includes(order.state)) ?? null
                  }
                />
              ))}
            </ul>
          )}
          {mine.length > 0 ? (
            <ul className="divide-border m-0 list-none divide-y p-0" aria-label={t("media.orders")}>
              {mine.map((order) => (
                <MediaOrderRow key={order.id} order={order} locale={locale} />
              ))}
            </ul>
          ) : null}
        </section>
        <p className="text-muted m-0 text-xs">{t("noWallet")}</p>
      </Card>

      <Card as="section" aria-labelledby="listing-posts" className="flex flex-col gap-4" data-testid="listing-posts">
        <CardHeader title={<span id="listing-posts">{t("posts.title")}</span>} description={t("posts.description")} />
        {!posts.data ? (
          <SectionError error={posts.error} />
        ) : posts.data.length === 0 ? (
          page ? (
            <EmptyState
              icon={IconMegaphone}
              title={live ? t("posts.emptyQueued") : t("posts.emptyNotLive")}
              description={page.autoPost ? undefined : t("posts.autoPostOff")}
            />
          ) : (
            <EmptyState
              icon={IconLink}
              title={t("posts.noPage")}
              description={t("posts.noPageHint")}
              action={
                <Button asChild variant="secondary" iconStart={IconSettings}>
                  <a href={ownerPath(locale, "/settings/facebook-page")} data-testid="listing-posts-connect">
                    {t("posts.connect")}
                  </a>
                </Button>
              }
            />
          )
        ) : (
          <ul className="divide-border m-0 list-none divide-y p-0">
            {posts.data.map((post) => (
              <li
                key={post.id}
                className="flex flex-col gap-2 py-3 first:pt-0"
                data-testid="social-post"
                data-state={post.state}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{post.pageName ?? post.pageId}</span>
                    <StatusBadgeOf map={SOCIAL_POST_STATUS} value={post.state} size="sm" />
                  </span>
                  {post.postUrl && post.state === "posted" ? (
                    <Button asChild size="sm" variant="ghost" iconStart={IconExternal}>
                      <a href={post.postUrl} target="_blank" rel="noopener noreferrer" data-testid="social-post-link">
                        {t("posts.open")}
                      </a>
                    </Button>
                  ) : null}
                </div>
                <p className="text-muted m-0 text-sm" data-testid="social-post-detail">
                  {post.state === "queued"
                    ? t(`posts.next.${post.pendingAction ?? "publish"}`)
                    : post.state === "posted"
                      ? post.updatedOnPageAt
                        ? t("posts.updatedAt", { date: formatDateTime(post.updatedOnPageAt, locale) })
                        : post.postedAt
                          ? t("posts.postedAt", { date: formatDateTime(post.postedAt, locale) })
                          : null
                      : post.state === "deleted" && post.deletedAt
                        ? t("posts.deletedAt", { date: formatDateTime(post.deletedAt, locale) })
                        : post.state === "failed"
                          ? t("posts.failedAfter", { count: post.attempts })
                          : null}
                </p>
                {post.state === "failed" ? (
                  <Callout tone="danger" title={t("posts.failedTitle")}>
                    <span className="flex flex-col gap-3">
                      <span data-testid="social-post-error">{post.lastError ?? t("posts.noReason")}</span>
                      {canRetry ? <RetrySocialPost listingId={listing.id} postId={post.id} /> : null}
                    </span>
                  </Callout>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {page?.state === "failing" ? (
          <Callout tone="warning" title={t("posts.pageFailing")}>
            <a href={ownerPath(locale, "/settings/facebook-page")} className="font-medium underline">
              {t("posts.fixPage")}
            </a>
          </Callout>
        ) : null}
      </Card>
    </>
  );
}
