import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { CtaPanel, PageHead, Section, SectionHead, WRAP } from "@/features/owner/marketing/Layout";
import { ListingCard } from "@/features/owner/marketing/listings/ListingCard";
import type { PublicListingArea } from "@/features/owner/marketing/listings/contract";
import { publicListingAreas, publicListings } from "@/features/owner/marketing/publicApi";
import { marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, itemListSchema } from "@/features/owner/marketing/structured-data";
import { formatTHB } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconHome } from "@/ui/icons/glyphs/home";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

const areaName = (area: PublicListingArea, locale: Locale) => (locale === "en" ? area.nameEn : area.name);

async function findArea(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { area: null, areas: [] as PublicListingArea[] };
  const areas = await publicListingAreas();
  return { area: areas.find((a) => a.slug === slug) ?? null, areas };
}

export async function generateMetadata({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { area } = await findArea(slug);
  if (!area) return {};
  const t = await getTranslations("owner.marketing.listings.area");
  const name = areaName(area, locale);
  return marketingMetadata(`/rent/area/${slug}`, locale, {
    title: t(`metaTitle.${area.kind}`, { name }),
    description: t("metaDescription", { name, count: area.count }),
    noindex: !area.indexable,
  });
}

/**
 * An area or station page (D-272): the listings there, the area's rent band (D-269) when the API has enough of them,
 * and the nearby areas — the internal links that let search engines and people move between neighbourhoods.
 */
export default async function AreaPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { area, areas } = await findArea(slug);
  if (!area) notFound();
  const t = await getTranslations("owner.marketing.listings");
  const nav = await getTranslations("owner.marketing.nav");
  const page = await publicListings({ area: slug }, locale);
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  const name = areaName(area, locale);
  const others = areas.filter((a) => a.slug !== slug && a.province === area.province).slice(0, 8);

  return (
    <>
      <JsonLdScript
        graphs={[
          breadcrumbSchema([
            { name: nav("home"), url: `${origin}${href("/")}` },
            { name: nav("rent"), url: `${origin}${href("/rent")}` },
            { name },
          ]),
          ...(page && page.data.length > 0
            ? [itemListSchema(page.data.map((l) => `${origin}${href(`/rent/${l.slug}`)}`))]
            : []),
        ]}
      />
      <PageHead
        back={{ href: href("/rent"), label: t("area.back") }}
        eyebrow={
          area.kind === "station" && area.line
            ? area.line
            : locale === "en"
              ? (area.provinceEn ?? area.province)
              : area.province
        }
        title={t(`area.title.${area.kind}`, { name })}
        lede={t("area.count", { count: area.count })}
        aside={
          area.band ? (
            <dl className="bg-surface border-border rounded-card shadow-card m-0 flex flex-col gap-1 border p-6 lg:ms-auto lg:max-w-sm">
              <dt className="text-muted text-sm">{t("area.band")}</dt>
              <dd className="m-0 text-3xl font-semibold tabular-nums">
                {formatTHB(area.band.p25, locale, { decimals: 0 })}–{formatTHB(area.band.p75, locale, { decimals: 0 })}
              </dd>
              <dd className="text-muted m-0 text-sm">
                {t("area.median", { amount: formatTHB(area.band.p50, locale, { decimals: 0 }) })}
              </dd>
            </dl>
          ) : undefined
        }
      />

      <section aria-labelledby="area-listings" className={`${WRAP} pb-16 md:pb-24`}>
        <h2 id="area-listings" className="sr-only">
          {t("search.results")}
        </h2>
        {page && page.data.length > 0 ? (
          <ul
            className="border-border m-0 grid list-none gap-x-6 gap-y-12 border-t p-0 pt-8 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="listings"
          >
            {page.data.map((listing) => (
              <li key={listing.slug}>
                <ListingCard listing={listing} locale={locale} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            variant="card"
            icon={IconHome}
            title={page ? t("noListings.title") : t("unavailable.title")}
            description={page ? t("area.empty", { name }) : t("unavailable.body")}
            action={
              <Button asChild variant="secondary">
                <a href={href("/rent")}>{t("area.back")}</a>
              </Button>
            }
          />
        )}
      </section>

      {others.length > 0 ? (
        <Section tone="subtle" labelledBy="nearby">
          <SectionHead id="nearby" title={t("area.nearby")} />
          <ul className="m-0 mt-8 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((other) => (
              <li key={other.slug}>
                <a
                  href={href(`/rent/area/${other.slug}`)}
                  className="bg-surface border-border rounded-card hover:border-border-strong group flex min-h-14 items-center justify-between gap-3 border px-4 py-3 transition-colors"
                >
                  <span className="font-semibold">{areaName(other, locale)}</span>
                  <span className="text-muted text-sm tabular-nums">{t("area.listings", { count: other.count })}</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <CtaPanel
        id="area-owner-cta"
        title={t("area.ownerCta", { name })}
        primary={{ href: ownerHref("/signup", locale), label: t("ownerCta.cta") }}
      />
    </>
  );
}
