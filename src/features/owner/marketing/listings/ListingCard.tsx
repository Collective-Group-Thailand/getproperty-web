import { getTranslations } from "next-intl/server";

import { formatDate, formatDecimal, formatTHB } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import type { PublicListingSummary } from "./contract";
import { ListingImage } from "./ListingImage";

/** One listing in a grid: the photo carries it, the facts sit under it in one quiet line. */
export async function ListingCard({ listing, locale }: { listing: PublicListingSummary; locale: Locale }) {
  const t = await getTranslations("owner.marketing.listings");
  const href = getPathname({ href: `/rent/${listing.slug}`, locale });
  return (
    <article className="group relative flex flex-col gap-3">
      <ListingImage
        photo={listing.cover}
        alt={listing.cover.caption ?? listing.title}
        className="rounded-photo aspect-[4/3]"
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base leading-snug font-semibold">
          <a href={href} className="after:absolute after:inset-0">
            {listing.title}
          </a>
        </h3>
        {listing.verifiedOwner ? (
          <Icon icon={IconCheckCircle} className="text-primary mt-0.5 shrink-0" aria-label={t("card.verified")} />
        ) : null}
      </div>
      <p className="text-muted -mt-2 text-sm">
        {[
          t("card.bedrooms", { count: listing.bedrooms }),
          t("card.sqm", { size: formatDecimal(listing.sizeSqm, locale, 0) }),
          listing.nearestTransit
            ? t("card.transit", {
                distance: formatDecimal(String(listing.nearestTransit.distanceM), locale, 0),
                name: listing.nearestTransit.name,
              })
            : listing.district,
        ].join(" · ")}
      </p>
      <p className="flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums">
          {formatTHB(listing.rent, locale, { decimals: 0 })}
        </span>
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
