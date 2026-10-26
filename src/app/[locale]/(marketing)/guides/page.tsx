import { getTranslations, setRequestLocale } from "next-intl/server";

import { guidesFor, type GuideCategory } from "@/features/owner/marketing/guides";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, itemListSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.guides.meta");
  return marketingMetadata("/guides", locale, { title: t("title"), description: t("description") });
}

const ORDER: GuideCategory[] = ["landlord", "law", "tax", "operations"];

/** Guides (D-271): the reading list for owners, by topic — an editorial index, not a card grid. */
export default async function Guides({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.guides");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  const guides = await guidesFor(locale);
  const groups = ORDER.map((category) => ({ category, items: guides.filter((g) => g.category === category) })).filter(
    (group) => group.items.length > 0,
  );

  return (
    <>
      <JsonLdScript
        graphs={[
          webPageSchema("CollectionPage", {
            url: `${origin}${href("/guides")}`,
            name: t("title"),
            description: t("intro"),
            inLanguage: locale,
          }),
          breadcrumbSchema([{ name: nav("home"), url: `${origin}${href("/")}` }, { name: t("title") }]),
          itemListSchema(guides.map((g) => `${origin}${href(`/guides/${g.slug}`)}`)),
        ]}
      />
      <header className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-14 pb-10 md:pt-20">
        <p className="text-muted text-sm font-medium">{t("eyebrow")}</p>
        <h1 className="text-display max-w-3xl">{t("title")}</h1>
        <p className="text-muted max-w-2xl text-lg">{t("intro")}</p>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-24">
        {groups.map((group) => (
          <section
            key={group.category}
            aria-labelledby={`cat-${group.category}`}
            className="grid gap-6 md:grid-cols-12"
          >
            <h2 id={`cat-${group.category}`} className="text-muted text-sm font-semibold md:col-span-3 md:pt-7">
              {t(`categories.${group.category}`)}
            </h2>
            <ol className="m-0 flex list-none flex-col p-0 md:col-span-9">
              {group.items.map((guide) => (
                <li key={guide.slug} className="border-border first:border-fg border-t first:border-t-2">
                  <a
                    href={href(`/guides/${guide.slug}`)}
                    className="group grid gap-2 py-7 md:grid-cols-[1fr_auto] md:gap-8"
                  >
                    <span className="flex flex-col gap-2">
                      <span className="group-hover:text-primary text-2xl leading-snug font-semibold transition-colors">
                        {guide.title}
                      </span>
                      <span className="text-muted max-w-2xl">{guide.summary}</span>
                    </span>
                    <span className="text-muted text-sm whitespace-nowrap md:pt-1">
                      {t("readMinutes", { count: guide.readMinutes })}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
