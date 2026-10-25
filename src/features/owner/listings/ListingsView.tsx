import { getTranslations } from "next-intl/server";

import { LISTING_STATUS } from "@/domain/status/listing";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconImage } from "@/ui/icons/glyphs/image";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconShield } from "@/ui/icons/glyphs/shield";

import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";

/**
 * The owner's listings (F6.2, D-252): one row per listing with its cover, state, the moderation facts the owner
 * should know (why it is in review, hidden by reports) and the rent; a click opens the editor.
 */
export async function ListingsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.listings");
  const { api, locale } = context;
  const listings = await section(unwrap(api.GET("/v1/owner/listings")));
  const create = (
    <Button asChild iconStart={IconAdd} data-testid="listing-new">
      <a href={ownerPath(locale, "/listings/new")}>{t("new")}</a>
    </Button>
  );
  return (
    <OwnerPage testId="listings">
      <PageHeader title={t("title")} description={t("description")} actions={create} />
      {!listings.data ? (
        <SectionError error={listings.error} />
      ) : listings.data.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={IconMegaphone}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <Button asChild size="lg" iconStart={IconAdd}>
                <a href={ownerPath(locale, "/listings/new")}>{t("empty.action")}</a>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3" data-testid="listing-cards">
          {listings.data.map((listing) => (
            <ListingRow key={listing.id} listing={listing} context={context} />
          ))}
        </ul>
      )}
    </OwnerPage>
  );
}

async function ListingRow({ listing, context }: { listing: Schemas["ListingDto"]; context: OwnerContext }) {
  const t = await getTranslations("owner.listings");
  const { locale } = context;
  const cover = listing.photos[0];
  const href = ownerPath(locale, `/listings/${listing.id}`);
  return (
    <Card
      as="li"
      padding="none"
      interactive
      className="relative flex flex-col overflow-hidden"
      data-testid="listing-card"
      data-state={listing.state}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed object-storage preview, not a static asset
        <img src={cover.url} alt="" className="bg-bg-subtle aspect-[16/10] w-full object-cover" loading="lazy" />
      ) : (
        <div className="bg-bg-subtle text-muted flex aspect-[16/10] w-full items-center justify-center gap-2 text-sm">
          <Icon icon={IconImage} />
          {t("card.noPhoto")}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base leading-snug font-semibold">
            <a href={href} className="after:absolute after:inset-0">
              {listing.titleTh}
            </a>
          </h2>
          <StatusBadgeOf map={LISTING_STATUS} value={listing.state} size="sm" />
        </div>
        <p className="text-muted truncate text-sm">{listing.address ?? listing.district ?? ""}</p>
        <div className="flex flex-wrap gap-2">
          {listing.hidden ? (
            <Badge tone="warning" size="sm" icon={IconHide}>
              {t("card.hidden")}
            </Badge>
          ) : null}
          {listing.reportCount > 0 ? (
            <Badge tone="warning" size="sm">
              {t("card.reports", { count: listing.reportCount })}
            </Badge>
          ) : null}
          {listing.verifiedOwner ? (
            <Badge tone="primary" size="sm" icon={IconShield}>
              {t("verification.verified")}
            </Badge>
          ) : null}
          {listing.state === "pending_review"
            ? listing.reviewReasons.map((reason) => (
                <Badge key={reason} tone="info" size="sm">
                  {t(`reasons.${reason}`)}
                </Badge>
              ))
            : null}
        </div>
        <div className="border-border mt-auto flex items-baseline justify-between gap-3 border-t pt-3 text-sm">
          <span>
            <span className="text-base font-semibold tabular-nums">
              {formatTHB(listing.rent, locale, { decimals: 0 })}
            </span>
            <span className="text-muted">{t("card.perMonth")}</span>
          </span>
          <span className="text-muted">
            {listing.publishedAt
              ? t("card.publishedOn", { date: formatDate(listing.publishedAt, locale) })
              : t("card.photos", { count: listing.photos.length })}
          </span>
        </div>
      </div>
    </Card>
  );
}
