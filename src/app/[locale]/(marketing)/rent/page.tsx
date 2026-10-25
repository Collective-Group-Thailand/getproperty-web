import { getTranslations, setRequestLocale } from "next-intl/server";

import { parseListingQuery } from "@/features/owner/marketing/listings/contract";
import { ListingCard } from "@/features/owner/marketing/listings/ListingCard";
import { ListingSearch } from "@/features/owner/marketing/listings/ListingSearch";
import { publicListingAreas, publicListings } from "@/features/owner/marketing/publicApi";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { lineOaHref, marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, itemListSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";

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
      <section className="bg-surface-subtle">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pt-12 pb-10 md:pt-16">
          <div className="flex max-w-3xl flex-col gap-3">
            <h1 className="text-4xl">{t("search.title")}</h1>
            <p className="text-muted text-lg">{t("search.body")}</p>
          </div>
          <ListingSearch query={query} action={action} />
          {popular.length > 0 ? (
            <nav aria-labelledby="popular-areas" className="flex flex-wrap items-center gap-2">
              <h2 id="popular-areas" className="text-muted me-2 text-sm font-semibold">
                {t("area.popular")}
              </h2>
              {popular.map((area) => (
                <a
                  key={area.slug}
                  href={getPathname({ href: `/rent/area/${area.slug}`, locale })}
                  className="bg-surface border-border hover:border-fg rounded-control inline-flex min-h-9 items-center border px-3 text-sm"
                >
                  {locale === "en" ? area.nameEn : area.name}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-8 pb-12 md:pb-16" aria-live="polite">
        {page && page.data.length > 0 ? (
          <>
            <p className="text-muted mb-6 text-sm" data-testid="listings-count">
              {t("search.count", { count: page.total })}
            </p>
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
        ) : (
          <div className="border-border mx-auto flex max-w-xl flex-col items-center gap-3 border-y py-14 text-center">
            <h2 className="text-2xl">{page && filtered ? t("empty.title") : t("unavailable.title")}</h2>
            <p className="text-muted">{page && filtered ? t("empty.body") : t("unavailable.body")}</p>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:pb-28">
        <div className="border-fg flex flex-col gap-6 border-y-2 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-3xl">{t("ownerCta.title")}</h2>
            <p className="text-muted text-lg">{t("ownerCta.body")}</p>
          </div>
          <Button asChild size="lg">
            <a href={list} {...(line ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
              {t("ownerCta.cta")}
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
