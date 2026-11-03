import { getTranslations, setRequestLocale } from "next-intl/server";

import { guidesFor, type GuideCategory } from "@/features/owner/marketing/guides";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageHead, WRAP } from "@/features/owner/marketing/Layout";
import { marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, itemListSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconBook } from "@/ui/icons/glyphs/book";
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
      <PageHead eyebrow={t("eyebrow")} title={t("title")} lede={t("intro")} />

      <div className={`${WRAP} flex flex-col gap-14 pb-16 md:gap-20 md:pb-24`}>
        {groups.map((group) => (
          <section
            key={group.category}
            aria-labelledby={`cat-${group.category}`}
            className="grid gap-4 lg:grid-cols-12 lg:gap-8"
          >
            <h2 id={`cat-${group.category}`} className="text-muted m-0 text-sm font-semibold lg:col-span-3 lg:pt-6">
              {t(`categories.${group.category}`)}
            </h2>
            <ol className="border-border m-0 flex list-none flex-col border-t p-0 lg:col-span-9">
              {group.items.map((guide) => (
                <li key={guide.slug} className="border-border border-b">
                  <a
                    href={href(`/guides/${guide.slug}`)}
                    className="group grid gap-2 py-6 md:grid-cols-[1fr_auto] md:gap-8"
                  >
                    <span className="flex flex-col gap-2">
                      <span className="group-hover:text-primary text-xl font-semibold text-balance transition-colors">
                        {guide.title}
                      </span>
                      <span className="text-muted max-w-2xl text-pretty">{guide.summary}</span>
                    </span>
                    <span className="text-muted text-sm whitespace-nowrap tabular-nums md:pt-1">
                      {t("readMinutes", { count: guide.readMinutes })}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {groups.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconBook}
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              <Button asChild variant="secondary">
                <a href={href("/tools")}>{t("empty.action")}</a>
              </Button>
            }
          />
        ) : null}
      </div>
    </>
  );
}
