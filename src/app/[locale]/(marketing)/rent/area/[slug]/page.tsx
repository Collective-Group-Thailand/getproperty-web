import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { ListingCard } from "@/features/owner/marketing/listings/ListingCard";
import type { PublicListingArea } from "@/features/owner/marketing/listings/contract";
import { publicListingAreas, publicListings } from "@/features/owner/marketing/publicApi";
import { marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, itemListSchema } from "@/features/owner/marketing/structured-data";
import { formatTHB } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";

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
      <section className="bg-surface-subtle">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-8 pb-12">
          <a href={href("/rent")} className="text-muted hover:text-fg inline-flex items-center gap-1 text-sm">
            <Icon icon={IconChevronLeft} />
            {t("area.back")}
          </a>
          <div className="grid gap-8 md:grid-cols-12 md:items-end">
            <div className="flex flex-col gap-3 md:col-span-8">
              <p className="text-primary text-sm font-semibold">
                {area.kind === "station" && area.line
                  ? area.line
                  : locale === "en"
                    ? (area.provinceEn ?? area.province)
                    : area.province}
              </p>
              <h1 className="text-display">{t(`area.title.${area.kind}`, { name })}</h1>
              <p className="text-muted text-lg">{t("area.count", { count: area.count })}</p>
            </div>
            {area.band ? (
              <dl className="border-fg m-0 flex flex-col gap-1 border-s-2 ps-5 md:col-span-4">
                <dt className="text-muted text-sm">{t("area.band")}</dt>
                <dd className="m-0 text-3xl font-semibold tabular-nums">
                  {formatTHB(area.band.p25, locale, { decimals: 0 })}–
                  {formatTHB(area.band.p75, locale, { decimals: 0 })}
                </dd>
                <dd className="text-muted m-0 text-sm">
                  {t("area.median", { amount: formatTHB(area.band.p50, locale, { decimals: 0 }) })}
                </dd>
              </dl>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        {page && page.data.length > 0 ? (
          <ul className="m-0 grid list-none gap-x-6 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3" data-testid="listings">
            {page.data.map((listing) => (
              <li key={listing.slug}>
                <ListingCard listing={listing} locale={locale} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted py-10 text-center">{t("unavailable.body")}</p>
        )}
      </section>

      {others.length > 0 ? (
        <section aria-labelledby="nearby" className="mx-auto max-w-7xl px-4 pb-12">
          <h2 id="nearby" className="border-fg border-t-2 pt-6 text-2xl">
            {t("area.nearby")}
          </h2>
          <ul className="m-0 mt-5 flex list-none flex-wrap gap-2 p-0">
            {others.map((other) => (
              <li key={other.slug}>
                <a
                  href={href(`/rent/area/${other.slug}`)}
                  className="border-border hover:border-fg rounded-control inline-flex min-h-10 items-center gap-2 border px-4"
                >
                  {areaName(other, locale)}
                  <span className="text-muted text-sm tabular-nums">{other.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="border-border flex flex-col gap-4 border-t pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-lg">{t("area.ownerCta", { name })}</p>
          <Button asChild>
            <a href={ownerHref("/login", locale)}>{t("ownerCta.cta")}</a>
          </Button>
        </div>
      </section>
    </>
  );
}
