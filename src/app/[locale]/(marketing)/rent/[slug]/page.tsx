import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { BackLink, PhoneActionBar, WRAP } from "@/features/owner/marketing/Layout";
import { ChannelLink } from "@/features/owner/marketing/listings/ChannelLink";
import { ListingCard } from "@/features/owner/marketing/listings/ListingCard";
import { ListingImage } from "@/features/owner/marketing/listings/ListingImage";
import { ListingUtility } from "@/features/owner/marketing/listings/ListingUtility";
import { VerifiedVacantBadge } from "@/features/owner/marketing/listings/VerifiedVacant";
import { ListingReviews } from "@/features/owner/marketing/listings/ListingReviews";
import { publicListing, publicListingReviews, publicListings } from "@/features/owner/marketing/publicApi";
import { reviewsPage } from "@/features/shared/growth/reviews";
import { liffRentHref, lineOaMessageHref, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema } from "@/features/owner/marketing/structured-data";
import { formatDate, formatDecimal, formatTHB } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { PhotoPlaceholder } from "@/ui/components/PhotoPlaceholder";
import { cn } from "@/ui/lib/cn";
import { Button } from "@/ui/components/Button";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconDoor } from "@/ui/icons/glyphs/door";
import { IconFloor } from "@/ui/icons/glyphs/floor";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconRoom } from "@/ui/icons/glyphs/room";
import { IconWater } from "@/ui/icons/glyphs/water";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconFlag } from "@/ui/icons/glyphs/flag";

type Props = { params: Promise<{ locale: Locale; slug: string }> };
type PageProps = Props & { searchParams: Promise<Record<string, string | string[] | undefined>> };

const url = (slug: string, locale: Locale) => `${marketingOrigin()}${getPathname({ href: `/rent/${slug}`, locale })}`;

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const listing = await publicListing(slug, locale);
  if (!listing) return { title: "getproperty", robots: { index: false } };
  const description = listing.description.slice(0, 160);
  // G4 (D-296): the API renders the 1200 × 630 card (photo, rent, place, badges) behind a stable URL.
  const image = { url: listing.ogImageUrl, width: 1200, height: 630, alt: listing.title };
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

/**
 * One listing (D-252): the photos first, the facts a renter checks in one glance, the full address (nothing hidden),
 * and a single way to reach the owner — a LINE chat opened with this home already named.
 */
export default async function ListingPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const reviewPage = reviewsPage((await searchParams).reviews);
  const [listing, reviews] = await Promise.all([
    publicListing(slug, locale),
    // G9 (D-301): verified reviews of the building — left out when there are none or the API is down.
    publicListingReviews(slug, reviewPage, locale),
  ]);
  if (!listing) notFound();
  const t = await getTranslations("owner.marketing.listings");
  const nav = await getTranslations("owner.marketing.nav");
  const href = url(slug, locale);
  // B7.3 / D-252: the LINE Mini App's own page for the listing (ask, book a viewing); else a chat with the OA
  const contact = liffRentHref(slug) ?? lineOaMessageHref(t("detail.lineMessage", { title: listing.title, url: href }));
  const contactHref = contact ?? ownerHref("/login", locale);
  const similar =
    (await publicListings({ kind: listing.unitKind ?? undefined }, locale))?.data
      .filter((l) => l.slug !== slug)
      .slice(0, 3) ?? [];
  const photos = listing.photos.length > 0 ? listing.photos : listing.cover ? [listing.cover] : [];
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    listing.geo ? `${listing.geo.lat},${listing.geo.lng}` : (listing.address ?? listing.title),
  )}`;
  const yesNo = (value: boolean) => (value ? t("detail.yes") : t("detail.no"));
  type Fact = { term: string; value: string; icon: IconGlyph };
  const facts = (
    [
      listing.sizeSqm
        ? {
            term: t("detail.size"),
            value: t("card.sqm", { size: formatDecimal(listing.sizeSqm, locale, 1) }),
            icon: IconRoom,
          }
        : null,
      listing.bedrooms !== null
        ? { term: t("search.bedrooms"), value: t("card.bedrooms", { count: listing.bedrooms }), icon: IconDoor }
        : null,
      listing.bathrooms !== null
        ? { term: t("detail.bathrooms"), value: String(listing.bathrooms), icon: IconWater }
        : null,
      listing.floor ? { term: t("detail.floor"), value: listing.floor, icon: IconFloor } : null,
      listing.furnishing
        ? { term: t("detail.furnishing"), value: t(`detail.furnishings.${listing.furnishing}`), icon: IconHome }
        : null,
      {
        term: t("detail.available"),
        value: listing.availableFrom ? formatDate(listing.availableFrom, locale) : t("detail.availableNow"),
        icon: IconCalendar,
      },
      {
        term: t("detail.petsLabel"),
        value: yesNo(listing.petsAllowed),
        icon: listing.petsAllowed ? IconCheckCircle : IconXCircle,
      },
      {
        term: t("detail.smokingLabel"),
        value: yesNo(listing.smokingAllowed),
        icon: listing.smokingAllowed ? IconCheckCircle : IconXCircle,
      },
    ] as (Fact | null)[]
  ).filter((fact): fact is Fact => fact !== null);

  return (
    <>
      <JsonLdScript
        graphs={[
          // G4 (D-296): the API's schema.org Offer, built from the facts already on this page.
          listing.jsonLd,
          breadcrumbSchema([
            { name: nav("home"), url: `${marketingOrigin()}${getPathname({ href: "/", locale })}` },
            { name: nav("rent"), url: `${marketingOrigin()}${getPathname({ href: "/rent", locale })}` },
            { name: listing.title },
          ]),
        ]}
      />
      <div className={`${WRAP} pt-6 md:pt-8`}>
        <BackLink href={getPathname({ href: "/rent", locale })} label={t("detail.back")} />
      </div>

      <section aria-label={t("detail.photos")} className={`${WRAP} mt-4`}>
        {photos.length > 0 ? (
          <div className={galleryGrid(photos.length)} data-testid="listing-gallery">
            {photos.slice(0, 5).map((photo, index) => (
              <ListingImage
                key={photo.url + index}
                photo={photo}
                alt={photo.caption ?? listing.title}
                priority={index === 0}
                sizes={index === 0 ? "(min-width: 768px) 60vw, 100vw" : "(min-width: 768px) 30vw, 50vw"}
                className={galleryTile(photos.length, index)}
              />
            ))}
          </div>
        ) : (
          <div data-testid="listing-gallery">
            <PhotoPlaceholder className="rounded-panel aspect-[16/9] md:aspect-[21/9]" label={t("detail.noPhotos")} />
          </div>
        )}
      </section>

      <div className={`${WRAP} grid gap-12 py-10 md:py-14 lg:grid-cols-12 lg:gap-8`}>
        <div className="flex min-w-0 flex-col gap-12 lg:col-span-7">
          <header className="flex flex-col gap-3">
            <p className="text-muted m-0 text-sm">
              {[
                listing.unitKind ? t(`search.kinds.${listing.unitKind}`) : null,
                [listing.district, listing.province].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1 className="m-0 text-4xl text-balance">{listing.title}</h1>
            {listing.verifiedVacant ? (
              <VerifiedVacantBadge since={listing.vacantSince} locale={locale} explain />
            ) : null}
            {listing.nearestTransit ? (
              <p className="text-muted m-0">
                {t("detail.transit", {
                  distance: formatDecimal(String(listing.nearestTransit.distanceM), locale, 0),
                  name: listing.nearestTransit.name,
                  line: listing.nearestTransit.line ?? "",
                })}
              </p>
            ) : null}
          </header>

          <section aria-labelledby="facts">
            <h2 id="facts" className="m-0 text-2xl">
              {t("detail.facts")}
            </h2>
            {/* One white card, 4 × 2 on a desktop (2 × 4 on a phone): an icon, the fact's name, its value. */}
            <dl
              className="border-border bg-surface rounded-card shadow-card m-0 mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border p-5 sm:grid-cols-4 md:p-6"
              data-testid="listing-facts"
            >
              {facts.map((fact) => (
                // A <dl> group holds only its <dt> and <dd> (axe definition-list): the icon lives in the term, set in the gutter.
                <div key={fact.term} className="relative min-h-9 min-w-0 ps-12">
                  <dt className="text-muted text-sm">
                    <span
                      aria-hidden="true"
                      className="bg-bg-subtle text-muted rounded-control absolute start-0 top-0 grid size-9 place-items-center"
                    >
                      <Icon icon={fact.icon} className="text-lg" />
                    </span>
                    {fact.term}
                  </dt>
                  <dd className="m-0 font-semibold">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {listing.utility ? (
            <section aria-labelledby="utility">
              <h2 id="utility" className="m-0 text-2xl">
                {t("utility.title")}
              </h2>
              <p className="text-muted mt-1 text-sm">{t("utility.intro")}</p>
              <div className="mt-4 max-w-2xl">
                <ListingUtility utility={listing.utility} locale={locale} />
              </div>
            </section>
          ) : null}

          <section aria-labelledby="about">
            <h2 id="about" className="m-0 text-2xl">
              {t("detail.about")}
            </h2>
            <p className="m-0 mt-4 max-w-2xl whitespace-pre-line">{listing.description}</p>
          </section>

          {listing.facilities.length > 0 ? (
            <section aria-labelledby="facilities">
              <h2 id="facilities" className="m-0 text-2xl">
                {t("detail.facilities")}
              </h2>
              <ul className="m-0 mt-5 flex list-none flex-wrap gap-2 p-0" data-testid="listing-facilities">
                {listing.facilities.map((facility) => (
                  <li
                    key={facility}
                    className="bg-surface border-border rounded-thumb inline-flex min-h-8 items-center gap-1.5 border px-2.5 text-sm"
                  >
                    <Icon icon={IconCheck} className="text-primary shrink-0" />
                    {facility}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="location">
            <h2 id="location" className="m-0 text-2xl">
              {t("detail.location")}
            </h2>
            <p className="m-0 mt-4">{listing.address}</p>
            <a
              href={map}
              rel="noopener noreferrer"
              target="_blank"
              className="text-primary mt-1 inline-flex min-h-11 items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              {t("detail.openMap")}
              <Icon icon={IconExternal} />
            </a>
          </section>

          {reviews ? (
            <ListingReviews
              reviews={reviews}
              locale={locale}
              pageHref={(page) => `${getPathname({ href: `/rent/${slug}`, locale })}?reviews=${page}#reviews`}
            />
          ) : null}
        </div>

        <aside className="lg:col-span-4 lg:col-start-9">
          <div className="bg-surface border-border rounded-panel shadow-card flex flex-col gap-5 border p-6 lg:sticky lg:top-24">
            <div>
              <p className="text-muted text-sm">{t("detail.rentLabel")}</p>
              <p className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold tabular-nums" data-testid="listing-rent">
                  {formatTHB(listing.rent, locale, { decimals: 0 })}
                </span>
                <span className="text-muted">{t("card.perMonth")}</span>
              </p>
            </div>
            {listing.verifiedVacant ? (
              <VerifiedVacantBadge since={listing.vacantSince} locale={locale} testId="listing-vacant-aside" />
            ) : null}
            {/* The terms as a definition list. The cash due before moving in is the renter's real question, but the API
                sends months, not amounts — it is shown only once the API computes it (never added up here). */}
            <dl className="border-border m-0 flex flex-col gap-2 border-t pt-4 text-sm">
              {(
                [
                  ["deposit", listing.depositMonths],
                  ["advance", listing.advanceMonths],
                  ["minTerm", listing.minTermMonths],
                ] as const
              ).map(([key, months]) => (
                <div key={key} className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">{t(`detail.term.${key}`)}</dt>
                  <dd className="m-0 font-medium tabular-nums">{t("detail.months", { months })}</dd>
                </div>
              ))}
            </dl>
            <Button asChild size="lg" block iconStart={contact ? IconChat : undefined}>
              <ChannelLink href={contactHref} {...(contact ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
                {contact ? t("detail.contact") : t("detail.contactSignIn")}
              </ChannelLink>
            </Button>
            <p className="text-muted -mt-2 text-xs">{contact ? t("detail.contactNote") : t("detail.signInFirst")}</p>
            <div className="border-border flex items-center gap-3 border-t pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-muted text-xs">{t("detail.owner")}</p>
                {listing.ownerProfileSlug ? (
                  <a
                    href={getPathname({ href: `/owners/${listing.ownerProfileSlug}`, locale })}
                    className="font-semibold underline-offset-4 hover:underline"
                    data-testid="listing-owner-link"
                  >
                    {listing.ownerDisplayName}
                  </a>
                ) : (
                  <p className="font-semibold">{listing.ownerDisplayName}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {listing.verifiedOwner ? (
                  <Badge tone="success" icon={IconCheckCircle} size="sm">
                    {t("detail.verified")}
                  </Badge>
                ) : (
                  <span className="text-muted text-xs">{t("detail.notVerified")}</span>
                )}
                {listing.ownerIdentityVerified ? (
                  <span data-testid="listing-identity-verified">
                    <Badge tone="success" icon={IconShield} size="sm">
                      {t("detail.identityVerified")}
                    </Badge>
                  </span>
                ) : null}
              </div>
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
        <section aria-labelledby="similar-h" className={`${WRAP} pb-16 md:pb-24`}>
          <h2 id="similar-h" className="border-border m-0 border-t pt-10 text-2xl">
            {t("detail.similar")}
          </h2>
          <ul className="m-0 mt-8 grid list-none gap-x-6 gap-y-12 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((item) => (
              <li key={item.slug}>
                <ListingCard listing={item} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* On a phone the price and the contact button stay at hand; the card above is far down the page. */}
      <PhoneActionBar
        summary={
          <p className="m-0 flex items-baseline gap-1">
            <span className="text-xl font-semibold tabular-nums">
              {formatTHB(listing.rent, locale, { decimals: 0 })}
            </span>
            <span className="text-muted text-sm">{t("card.perMonth")}</span>
          </p>
        }
      >
        <Button asChild iconStart={contact ? IconChat : undefined}>
          <ChannelLink href={contactHref} {...(contact ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
            {contact ? t("detail.contact") : t("detail.contactSignIn")}
          </ChannelLink>
        </Button>
      </PhoneActionBar>
    </>
  );
}

/**
 * The photo mosaic (Stitch revision): one large photo over two thirds of the width and a 2 × 2 block beside it, one
 * outer radius and 4-px seams, equal total height — sized to the photos there are, never an empty cell.
 */
function galleryGrid(count: number) {
  if (count === 1) return "grid";
  if (count === 2) return "grid gap-1 overflow-hidden rounded-panel md:grid-cols-2";
  return "grid gap-1 overflow-hidden rounded-panel md:h-[26rem] md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2";
}

function galleryTile(count: number, index: number) {
  if (count === 1) return "rounded-panel aspect-[4/3] md:aspect-[21/9]";
  if (count === 2) return cn("aspect-[4/3]", index > 0 && "max-md:hidden");
  if (index === 0) return "aspect-[4/3] md:row-span-2 md:aspect-auto md:h-full";
  const small = "max-md:hidden md:h-full";
  // three photos: two stacked, each two cells wide; four: two on top, one wide below; five: the 2 × 2 block
  if (count === 3) return cn(small, "md:col-span-2");
  if (count === 4 && index === 3) return cn(small, "md:col-span-2");
  return small;
}
