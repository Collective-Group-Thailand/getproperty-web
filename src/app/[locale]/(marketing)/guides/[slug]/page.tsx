import { articleGraphs, hasAffiliateLinks } from "@collective/content";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { GuideBlocks } from "@/features/owner/marketing/guides/GuideBlocks";
import { guideBySlug, guideSlugs, guidesFor } from "@/features/owner/marketing/guides";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { formatDate } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { IconExternal } from "@/ui/icons/glyphs/external";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/** Published guides at build time (none when the API is not reachable then — pages render on first request). */
export async function generateStaticParams() {
  const slugs = await guideSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

/** A guide edited in admin shows within five minutes (the API read is cached that long). */
export const revalidate = 300;

export async function generateMetadata({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const guide = await guideBySlug(locale, slug);
  if (!guide) return {};
  const t = await getTranslations("owner.marketing.guides");
  return marketingMetadata(`/guides/${slug}`, locale, {
    title: t("articleTitle", { title: guide.title }),
    description: guide.summary,
    type: "article",
  });
}

/**
 * One guide (D-271): the short answer first (what an answer engine quotes), then the sections with a table of
 * contents beside them, the FAQ, the sources and the review date, and one call to action at the end.
 */
export default async function GuidePage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const guide = await guideBySlug(locale, slug);
  if (!guide) notFound();
  const t = await getTranslations("owner.marketing.guides");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  const url = `${origin}${href(`/guides/${slug}`)}`;
  const related = (await guidesFor(locale))
    .filter((g) => g.slug !== slug)
    .sort((a, b) => Number(b.category === guide.category) - Number(a.category === guide.category))
    .slice(0, 3);
  const noteLabels = { info: t("notes.info"), warning: t("notes.warning"), product: t("notes.product") };
  const affiliateLabels = {
    label: t("affiliate.label"),
    at: (merchant: string) => t("affiliate.at", { merchant }),
  };
  const { audience, ...article } = guide;
  // Article (with the category's label as its section), breadcrumb and FAQ graphs from @collective/content (D-277).
  const [articleGraph, ...otherGraphs] = articleGraphs(
    article,
    { name: "getproperty", origin, logo: `${origin}/brand/getproperty-logo.png`, url },
    [
      { name: nav("home"), url: `${origin}${href("/")}` },
      { name: t("title"), url: `${origin}${href("/guides")}` },
      { name: guide.title },
    ],
  );
  const cta = audience === "landlord" ? "landlord" : "apartment";

  return (
    <>
      <JsonLdScript graphs={[{ ...articleGraph, articleSection: t(`categories.${guide.category}`) }, ...otherGraphs]} />
      <article className="mx-auto max-w-7xl px-4 pt-8 pb-20">
        <a href={href("/guides")} className="text-muted hover:text-fg inline-flex items-center gap-1 text-sm">
          <Icon icon={IconChevronLeft} />
          {t("back")}
        </a>

        <header className="mt-8 flex max-w-3xl flex-col gap-5">
          <p className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-primary font-semibold">{t(`categories.${guide.category}`)}</span>
            <span aria-hidden="true">·</span>
            <span>{t("readMinutes", { count: guide.readMinutes })}</span>
            <span aria-hidden="true">·</span>
            <span>{t("reviewed", { date: formatDate(guide.reviewed, locale, { style: "long" }) })}</span>
          </p>
          <h1 className="text-display">{guide.title}</h1>
        </header>

        <div className="mt-10 grid gap-12 lg:grid-cols-12">
          <nav aria-label={t("contents")} className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <p className="text-muted mb-3 text-sm font-semibold">{t("contents")}</p>
              <ol className="border-border m-0 flex list-none flex-col gap-2 border-s p-0 ps-4 text-sm">
                {guide.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="text-muted hover:text-fg">
                      {section.heading}
                    </a>
                  </li>
                ))}
                {guide.faq.length > 0 ? (
                  <li>
                    <a href="#faq" className="text-muted hover:text-fg">
                      {t("faq")}
                    </a>
                  </li>
                ) : null}
              </ol>
            </div>
          </nav>

          <div className="flex max-w-3xl flex-col gap-12 lg:col-span-8">
            <section aria-labelledby="answer" className="border-fg border-y-2 py-6">
              <h2 id="answer" className="text-muted mb-2 text-sm font-semibold">
                {t("answer")}
              </h2>
              <p className="text-xl leading-relaxed font-medium">{guide.answer}</p>
            </section>

            {guide.general ? <p className="text-muted text-sm">{t("general")}</p> : null}
            {hasAffiliateLinks(article) ? <p className="text-muted text-sm">{t("affiliate.disclosure")}</p> : null}

            {guide.sections.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-h`} className="scroll-mt-24">
                <h2 id={`${section.id}-h`} className="mb-5 text-3xl">
                  {section.heading}
                </h2>
                <GuideBlocks blocks={section.blocks} noteLabels={noteLabels} affiliateLabels={affiliateLabels} />
              </section>
            ))}

            {guide.faq.length > 0 ? (
              <section id="faq" aria-labelledby="faq-h" className="scroll-mt-24">
                <h2 id="faq-h" className="mb-4 text-3xl">
                  {t("faq")}
                </h2>
                <div className="border-border border-t">
                  {guide.faq.map((item) => (
                    <details key={item.q} className="group border-border border-b">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <Icon icon={IconChevronDown} className="shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="text-muted pb-5 leading-relaxed">{item.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            {guide.sources.length > 0 ? (
              <section aria-labelledby="sources-h">
                <h2 id="sources-h" className="text-muted mb-3 text-sm font-semibold">
                  {t("sources")}
                </h2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                  {guide.sources.map((source) => (
                    <li key={source.url + source.label}>
                      <a
                        href={source.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="hover:text-primary inline-flex items-center gap-1 underline underline-offset-4"
                      >
                        {source.label}
                        <Icon icon={IconExternal} />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="bg-fg text-fg-inverse rounded-photo flex flex-col gap-4 p-8 md:p-10">
              <h2 className="text-3xl">{t(`cta.${cta}.title`)}</h2>
              <p className="max-w-xl text-lg opacity-85">{t(`cta.${cta}.body`)}</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href={ownerHref("/login", locale)}>{t(`cta.${cta}.button`)}</a>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href={href(cta === "landlord" ? "/landlords" : "/")}>{t("cta.more")}</a>
                </Button>
              </div>
            </section>
          </div>
        </div>

        {related.length > 0 ? (
          <section aria-labelledby="related-h" className="mt-20">
            <h2 id="related-h" className="border-fg border-t-2 pt-6 text-2xl">
              {t("related")}
            </h2>
            <ul className="m-0 mt-6 grid list-none gap-8 p-0 md:grid-cols-3">
              {related.map((item) => (
                <li key={item.slug}>
                  <a href={href(`/guides/${item.slug}`)} className="group flex flex-col gap-2">
                    <span className="text-primary text-sm font-semibold">{t(`categories.${item.category}`)}</span>
                    <span className="group-hover:text-primary text-xl leading-snug font-semibold">{item.title}</span>
                    <span className="text-muted text-sm">{item.summary}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </>
  );
}
