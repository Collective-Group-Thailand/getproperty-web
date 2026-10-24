import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import type { PublicListingDetail } from "@/features/owner/marketing/listings/contract";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { ListingCard } from "@/features/owner/marketing/listings/ListingCard";
import { ListingImage } from "@/features/owner/marketing/listings/ListingImage";
import { publicListing, publicListings } from "@/features/owner/marketing/publicApi";
import { lineOaMessageHref, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, type JsonLd } from "@/features/owner/marketing/structured-data";
import { formatDate, formatDecimal, formatTHB } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { cn } from "@/ui/lib/cn";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconFlag } from "@/ui/icons/glyphs/flag";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

const url = (slug: string, locale: Locale) => `${marketingOrigin()}${getPathname({ href: `/rent/${slug}`, locale })}`;

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const listing = await publicListing(slug);
  if (!listing) return { title: "getproperty", robots: { index: false } };
  const description = listing.description.slice(0, 160);
  const image = listing.cover.url;
  return {
    title: { absolute: `${listing.title} · getproperty` },
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: url(slug, locale),
      languages: Object.fromEntries(routing.locales.map((lang) => [lang, url(slug, lang)])),
    },
    openGraph: { title: listing.title, description, url: url(slug, locale), type: "website", images: [image] },
    twitter: { card: "summary_large_image", title: listing.title, description, images: [image] },
  };
}

/** schema.org for one rental: the home and the monthly offer, as the API published them. */
function listingSchema(listing: PublicListingDetail, href: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    url: href,
    price: listing.rent,
    priceCurrency: "THB",
    businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
    availabilityStarts: listing.availableFrom ?? undefined,
    itemOffered: {
      "@type": listing.unitKind === "house" || listing.unitKind === "townhouse" ? "House" : "Apartment",
      name: listing.title,
      description: listing.description,
      numberOfRooms: listing.bedrooms,
      numberOfBathroomsTotal: listing.bathrooms,
      floorSize: { "@type": "QuantitativeValue", value: listing.sizeSqm, unitCode: "MTK" },
      petsAllowed: listing.petsAllowed,
      address: {
        "@type": "PostalAddress",
        streetAddress: listing.address,
        addressRegion: listing.province,
        addressCountry: "TH",
      },
      image: listing.photos.map((photo) => photo.url),
    },
  };
}

/**
 * One listing (D-252): the photos first, the facts a renter checks in one glance, the full address (nothing hidden),
 * and a single way to reach the owner — a LINE chat opened with this home already named.
 */
export default async function ListingPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const listing = await publicListing(slug);
  if (!listing) notFound();
  const t = await getTranslations("owner.marketing.listings");
  const nav = await getTranslations("owner.marketing.nav");
  const href = url(slug, locale);
  const contact = lineOaMessageHref(t("detail.lineMessage", { title: listing.title, url: href }));
  const contactHref = contact ?? ownerHref("/login", locale);
  const similar =
    (await publicListings({ kind: listing.unitKind }))?.data.filter((l) => l.slug !== slug).slice(0, 3) ?? [];
  const photos = listing.photos.length > 0 ? listing.photos : [listing.cover];
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    listing.geo ? `${listing.geo.lat},${listing.geo.lng}` : listing.address,
  )}`;
  const yesNo = (value: boolean) => (value ? t("detail.yes") : t("detail.no"));
  const facts: [string, string][] = [
    [t("detail.size"), t("card.sqm", { size: formatDecimal(listing.sizeSqm, locale, 1) })],
    [t("search.bedrooms"), t("card.bedrooms", { count: listing.bedrooms })],
    [t("detail.bathrooms"), String(listing.bathrooms)],
    ...(listing.floor ? ([[t("detail.floor"), listing.floor]] as [string, string][]) : []),
    [t("detail.furnishing"), t(`detail.furnishings.${listing.furnishing}`)],
    [
      t("detail.available"),
      listing.availableFrom ? formatDate(listing.availableFrom, locale) : t("detail.availableNow"),
    ],
    [t("detail.petsLabel"), yesNo(listing.petsAllowed)],
    [t("detail.smokingLabel"), yesNo(listing.smokingAllowed)],
  ];

  return (
    <>
      <JsonLdScript
        graphs={[
          listingSchema(listing, href),
          breadcrumbSchema([
            { name: nav("home"), url: `${marketingOrigin()}${getPathname({ href: "/", locale })}` },
            { name: nav("rent"), url: `${marketingOrigin()}${getPathname({ href: "/rent", locale })}` },
            { name: listing.title },
          ]),
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <a
          href={getPathname({ href: "/rent", locale })}
          className="text-muted hover:text-fg inline-flex items-center gap-1 text-sm"
        >
          <Icon icon={IconChevronLeft} />
          {t("detail.back")}
        </a>
      </div>

      <section aria-label={t("detail.photos")} className="mx-auto mt-4 max-w-7xl px-4">
        <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2" data-testid="listing-gallery">
          {photos.slice(0, 5).map((photo, index) => (
            <ListingImage
              key={photo.url + index}
              photo={photo}
              alt={photo.caption ?? listing.title}
              priority={index === 0}
              sizes={index === 0 ? "(min-width: 768px) 50vw, 100vw" : "25vw"}
              className={
                index === 0
                  ? "rounded-photo aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto md:h-full"
                  : cn(
                      "rounded-card aspect-[4/3] max-md:hidden",
                      // Four photos: the last one takes the whole lower row so the mosaic has no hole.
                      index === 3 && photos.length === 4 && "md:col-span-2 md:aspect-auto",
                    )
              }
            />
          ))}
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-10 md:py-14 lg:grid-cols-12">
        <div className="flex flex-col gap-10 lg:col-span-8">
          <header className="flex flex-col gap-3">
            <p className="text-muted text-sm">
              {t(`search.kinds.${listing.unitKind}`)} · {listing.district}, {listing.province}
            </p>
            <h1 className="text-3xl">{listing.title}</h1>
            {listing.nearestTransit ? (
              <p className="text-muted">
                {t("detail.transit", {
                  distance: formatDecimal(String(listing.nearestTransit.distanceM), locale, 0),
                  name: listing.nearestTransit.name,
                  line: listing.nearestTransit.line,
                })}
              </p>
            ) : null}
          </header>

          <section aria-labelledby="facts">
            <h2 id="facts" className="text-xl">
              {t("detail.facts")}
            </h2>
            <dl className="border-border m-0 mt-4 grid grid-cols-2 border-t sm:grid-cols-4">
              {facts.map(([term, value]) => (
                <div key={term} className="border-border border-b py-4 pe-4">
                  <dt className="text-muted text-sm">{term}</dt>
                  <dd className="m-0 mt-1 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="about">
            <h2 id="about" className="text-xl">
              {t("detail.about")}
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed whitespace-pre-line">{listing.description}</p>
          </section>

          {listing.facilities.length > 0 ? (
            <section aria-labelledby="facilities">
              <h2 id="facilities" className="text-xl">
                {t("detail.facilities")}
              </h2>
              <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
                {listing.facilities.map((facility) => (
                  <li key={facility}>
                    <Badge>{facility}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="location">
            <h2 id="location" className="text-xl">
              {t("detail.location")}
            </h2>
            <p className="mt-3">{listing.address}</p>
            <a
              href={map}
              rel="noopener noreferrer"
              target="_blank"
              className="text-primary mt-2 inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              {t("detail.openMap")}
              <Icon icon={IconExternal} />
            </a>
          </section>
        </div>

        <aside className="lg:col-span-4">
          <div className="bg-surface border-border rounded-photo shadow-raised sticky top-24 flex flex-col gap-5 border p-6">
            <div>
              <p className="text-muted text-sm">{t("detail.rentLabel")}</p>
              <p className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold tabular-nums" data-testid="listing-rent">
                  {formatTHB(listing.rent, locale, { decimals: 0 })}
                </span>
                <span className="text-muted">{t("card.perMonth")}</span>
              </p>
            </div>
            <ul className="text-muted m-0 flex list-none flex-col gap-1 p-0 text-sm">
              <li>{t("detail.deposit", { months: listing.depositMonths })}</li>
              <li>{t("detail.advance", { months: listing.advanceMonths })}</li>
              <li>{t("detail.minTerm", { months: listing.minTermMonths })}</li>
            </ul>
            <Button asChild size="lg" block iconStart={contact ? IconChat : undefined}>
              <a href={contactHref} {...(contact ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
                {contact ? t("detail.contact") : t("detail.contactSignIn")}
              </a>
            </Button>
            <p className="text-muted text-xs">{t("detail.contactNote")}</p>
            <div className="border-border flex items-center gap-3 border-t pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-muted text-xs">{t("detail.owner")}</p>
                <p className="font-semibold">{listing.ownerDisplayName}</p>
              </div>
              {listing.verifiedOwner ? (
                <Badge tone="success" icon={IconCheckCircle} size="sm">
                  {t("detail.verified")}
                </Badge>
              ) : (
                <span className="text-muted text-xs">{t("detail.notVerified")}</span>
              )}
            </div>
          </div>
          <a
            href={contactHref}
            className="text-muted hover:text-fg mt-4 inline-flex items-center gap-1 text-xs"
            {...(contact ? { rel: "noopener noreferrer", target: "_blank" } : {})}
          >
            <Icon icon={IconFlag} />
            {t("detail.report")}
          </a>
        </aside>
      </div>

      {similar.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-20 md:pb-28">
          <h2 className="border-fg border-t-2 pt-6 text-2xl">{t("detail.similar")}</h2>
          <ul className="m-0 mt-8 grid list-none gap-x-6 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((item) => (
              <li key={item.slug}>
                <ListingCard listing={item} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* On a phone the price and the contact button stay at hand; the card above is far down the page. */}
      <div className="bg-surface/95 border-border fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t px-4 py-3 backdrop-blur lg:hidden">
        <p className="flex min-w-0 flex-1 items-baseline gap-1">
          <span className="text-xl font-semibold tabular-nums">{formatTHB(listing.rent, locale, { decimals: 0 })}</span>
          <span className="text-muted text-sm">{t("card.perMonth")}</span>
        </p>
        <Button asChild iconStart={contact ? IconChat : undefined}>
          <a href={contactHref} {...(contact ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
            {contact ? t("detail.contact") : t("detail.contactSignIn")}
          </a>
        </Button>
      </div>
      <div className="h-20 lg:hidden" aria-hidden />
    </>
  );
}
