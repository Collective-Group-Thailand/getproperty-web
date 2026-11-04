import { getTranslations, setRequestLocale } from "next-intl/server";

import { parseListingQuery } from "@/features/owner/marketing/listings/contract";
import { ListingCard } from "@/features/owner/marketing/listings/ListingCard";
import { ListingResultsControls } from "@/features/owner/marketing/listings/ListingResultsControls";
import { ListingKindChips, ListingSearch } from "@/features/owner/marketing/listings/ListingSearch";
import { publicListingAreas, publicListings } from "@/features/owner/marketing/publicApi";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { CtaPanel, PageHead, WRAP } from "@/features/owner/marketing/Layout";
import { lineOaHref, marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, itemListSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconSearch } from "@/ui/icons/glyphs/search";

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.listings.meta");
  return marketingMetadata("/rent", locale, { title: t("title"), description: t("description") });
}

/**
 * `/rent` — homes for rent from real owners (D-252): a GET search over the public listings the API publishes, a photo
 * grid, and the owners' way in. Nothing is typed here that the API did not send; with no API (or no listings yet) the
 * page says so plainly and invites owners to list.
 */
export default async function Rent({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.listings");
  const query = parseListingQuery(await searchParams);
  const [page, areas] = await Promise.all([publicListings(query, locale), publicListingAreas()]);
  const popular = [...areas].sort((a, b) => b.count - a.count).slice(0, 8);
  const action = getPathname({ href: "/rent", locale });
  const line = lineOaHref();
  const list = line ?? ownerHref("/login", locale);
  const filtered = Boolean(query.q || query.kind || query.minRent || query.maxRent || query.bedrooms || query.pets);

  const origin = marketingOrigin();
  const nav = await getTranslations("owner.marketing.nav");
  return (
    <>
      <JsonLdScript
        graphs={[
          breadcrumbSchema([
            { name: nav("home"), url: `${origin}${getPathname({ href: "/", locale })}` },
            { name: nav("rent") },
          ]),
          ...(page && page.data.length > 0
            ? [itemListSchema(page.data.map((l) => `${origin}${getPathname({ href: `/rent/${l.slug}`, locale })}`))]
            : []),
        ]}
      />
      <PageHead
        title={t("search.title")}
        lede={t("search.body")}
        size="search"
        className="pt-6 pb-4 md:pt-12 md:pb-8"
      />
      <div className={`${WRAP} flex flex-col gap-3 pb-4 md:gap-4 md:pb-10`}>
        <ListingSearch query={query} action={action} />
        <ListingKindChips query={query} action={action} />
        {popular.length > 0 ? (
          <nav aria-labelledby="popular-areas" className="hidden flex-wrap items-center gap-2 md:flex">
            <h2 id="popular-areas" className="text-muted m-0 me-1 text-sm font-medium">
              {t("area.popular")}
            </h2>
            {popular.map((area) => (
              <a
                key={area.slug}
                href={getPathname({ href: `/rent/area/${area.slug}`, locale })}
                className="border-border bg-surface text-fg hover:border-border-strong rounded-control inline-flex h-9 items-center border px-3 text-sm"
              >
                {locale === "en" ? area.nameEn : area.name}
              </a>
            ))}
          </nav>
        ) : null}
      </div>

      <section className={`${WRAP} pb-16 md:pb-24`} aria-labelledby="results-h" aria-live="polite">
        <h2 id="results-h" className="sr-only">
          {t("search.results")}
        </h2>
        {page && page.data.length > 0 ? (
          <>
            <div className="border-border mb-6 flex items-center justify-between gap-4 md:mb-8 md:border-t md:pt-5">
              <p className="text-muted m-0 text-sm" data-testid="listings-count">
                {t("search.count", { count: page.total })}
              </p>
              <ListingResultsControls sort={query.sort} pets={query.pets} />
            </div>
            <ul
              className="m-0 grid list-none gap-x-6 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="listings"
            >
              {page.data.map((listing) => (
                <li key={listing.slug}>
                  <ListingCard listing={listing} locale={locale} />
                </li>
              ))}
            </ul>
          </>
        ) : page && filtered ? (
          <EmptyState
            variant="card"
            icon={IconSearch}
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              <Button asChild variant="secondary">
                <a href={action}>{t("search.reset")}</a>
              </Button>
            }
          />
        ) : page ? (
          <EmptyState
            variant="card"
            icon={IconHome}
            title={t("noListings.title")}
            description={t("noListings.body")}
            action={
              <Button asChild>
                <a href={list} {...(line ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
                  {t("ownerCta.cta")}
                </a>
              </Button>
            }
          />
        ) : (
          <EmptyState
            variant="card"
            icon={IconHome}
            title={t("unavailable.title")}
            description={t("unavailable.body")}
            action={
              <Button asChild variant="secondary">
                <a href={action}>{t("unavailable.retry")}</a>
              </Button>
            }
          />
        )}
      </section>

      <CtaPanel
        id="owner-cta"
        variant="band"
        className="pt-0 md:pt-0"
        title={t("ownerCta.title")}
        body={t("ownerCta.body")}
        primary={{ href: list, label: t("ownerCta.cta"), external: Boolean(line) }}
      />
    </>
  );
}
