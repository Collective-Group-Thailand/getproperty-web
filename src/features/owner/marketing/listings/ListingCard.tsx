import { getTranslations } from "next-intl/server";

import { formatDate, formatDecimal, formatTHB } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { IconCalendarCheck } from "@/ui/icons/glyphs/calendar-check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconShield } from "@/ui/icons/glyphs/shield";

import type { PublicListingSummary } from "./contract";
import { ListingImage } from "./ListingImage";

/**
 * One listing in a grid: the photo carries it, the facts sit under it in one quiet line. A boosted result in a
 * sponsored slot (G5, D-297) carries the API's own label ("โฆษณา" / "Ad") on the photo and in its accessible name;
 * the verified-vacant badge (G4, D-296) sits on the photo too.
 */
export async function ListingCard({ listing, locale }: { listing: PublicListingSummary; locale: Locale }) {
  const t = await getTranslations("owner.marketing.listings");
  const href = getPathname({ href: `/rent/${listing.slug}`, locale });
  const ad = listing.sponsored && listing.sponsoredLabel ? listing.sponsoredLabel : null;
  return (
    <article
      className="group relative flex flex-col gap-3"
      data-testid="listing-card"
      data-sponsored={listing.sponsored}
      aria-label={ad ? `${ad} · ${listing.title}` : undefined}
    >
      <div className="relative">
        {listing.cover ? (
          <ListingImage
            photo={listing.cover}
            alt={listing.cover.caption ?? listing.title}
            className="rounded-photo aspect-[4/3]"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <div className="rounded-photo bg-bg-subtle aspect-[4/3]" aria-hidden="true" />
        )}
        {ad || listing.verifiedVacant ? (
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
            {ad ? (
              <span
                className="bg-surface/95 text-fg rounded-sm px-2 py-0.5 text-xs font-semibold shadow-sm"
                data-testid="listing-sponsored"
              >
                {ad}
              </span>
            ) : (
              <span />
            )}
            {listing.verifiedVacant ? (
              <span
                className="bg-success-subtle text-success-subtle-fg inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold shadow-sm"
                data-testid="listing-card-vacant"
              >
                <Icon icon={IconCalendarCheck} />
                {t("vacant.badge")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base leading-snug font-semibold">
          <a href={href} className="after:absolute after:inset-0">
            {listing.title}
          </a>
        </h3>
        {listing.verifiedOwner || listing.ownerIdentityVerified ? (
          <span className="text-primary mt-0.5 flex shrink-0 gap-1">
            {listing.verifiedOwner ? <Icon icon={IconCheckCircle} aria-label={t("card.verified")} /> : null}
            {listing.ownerIdentityVerified ? <Icon icon={IconShield} aria-label={t("card.identityVerified")} /> : null}
          </span>
        ) : null}
      </div>
      <p className="text-muted -mt-2 text-sm">
        {[
          listing.bedrooms !== null ? t("card.bedrooms", { count: listing.bedrooms }) : null,
          listing.sizeSqm ? t("card.sqm", { size: formatDecimal(listing.sizeSqm, locale, 0) }) : null,
          listing.nearestTransit
            ? t("card.transit", {
                distance: formatDecimal(String(listing.nearestTransit.distanceM), locale, 0),
                name: listing.nearestTransit.name,
              })
            : listing.district,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums">{formatTHB(listing.rent, locale, { decimals: 0 })}</span>
        <span className="text-muted text-sm">{t("card.perMonth")}</span>
        {listing.availableFrom ? (
          <span className="text-muted ms-auto text-xs">
            {t("card.availableFrom", { date: formatDate(listing.availableFrom, locale) })}
          </span>
        ) : null}
      </p>
    </article>
  );
}
