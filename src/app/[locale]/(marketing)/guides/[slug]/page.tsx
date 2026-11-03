import { articleGraphs, hasAffiliateLinks } from "@collective/content";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { GuideBlocks } from "@/features/owner/marketing/guides/GuideBlocks";
import { guideBySlug, guidesFor } from "@/features/owner/marketing/guides";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { BackLink, FaqList, WRAP } from "@/features/owner/marketing/Layout";
import { marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { formatDate } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconExternal } from "@/ui/icons/glyphs/external";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/*
 * Rendered on request, like every other public page. The page used to be statically generated (`generateStaticParams`
 * with `revalidate = 300`), but the frame and the JSON-LD script read the request's CSP nonce (`headers()`), which a
 * static or ISR render cannot do: whenever the API was reachable at build time the route became SSG and every guide
 * answered 500. The API read itself stays cached for five minutes (`next: { revalidate: 300 }` in `guides/index.ts`),
 * so a guide edited in admin still shows within five minutes.
 */

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
      <article className={`${WRAP} pt-8 pb-16 md:pt-12 md:pb-24`}>
        <BackLink href={href("/guides")} label={t("back")} />

        <header className="mt-6 flex max-w-3xl flex-col gap-5 md:mt-8">
          <p className="text-muted m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-primary font-semibold">{t(`categories.${guide.category}`)}</span>
            <span aria-hidden="true">·</span>
            <span>{t("readMinutes", { count: guide.readMinutes })}</span>
            <span aria-hidden="true">·</span>
            <span>{t("reviewed", { date: formatDate(guide.reviewed, locale, { style: "long" }) })}</span>
          </p>
          <h1 className="text-display m-0 text-balance">{guide.title}</h1>
        </header>

        <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-12 lg:gap-8">
          <nav aria-label={t("contents")} className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <p className="text-muted m-0 mb-3 text-sm font-semibold">{t("contents")}</p>
              <ol className="border-border m-0 flex list-none flex-col border-t p-0 text-sm">
                {guide.sections.map((section) => (
                  <li key={section.id} className="border-border border-b">
                    <a href={`#${section.id}`} className="text-muted hover:text-fg flex min-h-11 items-center py-2">
                      {section.heading}
                    </a>
                  </li>
                ))}
                {guide.faq.length > 0 ? (
                  <li className="border-border border-b">
                    <a href="#faq" className="text-muted hover:text-fg flex min-h-11 items-center py-2">
                      {t("faq")}
                    </a>
                  </li>
                ) : null}
              </ol>
            </div>
          </nav>

          <div className="flex min-w-0 flex-col gap-12 lg:col-span-8 lg:col-start-5">
            <section
              aria-labelledby="answer"
              className="bg-surface border-border rounded-card shadow-card flex flex-col gap-2 border p-6 md:p-8"
            >
              <h2 id="answer" className="text-primary m-0 text-sm font-semibold">
                {t("answer")}
              </h2>
              <p className="m-0 text-xl text-pretty">{guide.answer}</p>
            </section>

            {guide.general ? <p className="text-muted m-0 text-sm">{t("general")}</p> : null}
            {hasAffiliateLinks(article) ? <p className="text-muted m-0 text-sm">{t("affiliate.disclosure")}</p> : null}

            {guide.sections.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-h`} className="scroll-mt-24">
                <h2 id={`${section.id}-h`} className="m-0 mb-5 text-3xl text-balance">
                  {section.heading}
                </h2>
                <GuideBlocks blocks={section.blocks} noteLabels={noteLabels} affiliateLabels={affiliateLabels} />
              </section>
            ))}

            {guide.faq.length > 0 ? (
              <section id="faq" aria-labelledby="faq-h" className="scroll-mt-24">
                <h2 id="faq-h" className="m-0 mb-4 text-3xl">
                  {t("faq")}
                </h2>
                <FaqList items={guide.faq.map((item) => ({ q: item.q, a: item.a }))} />
              </section>
            ) : null}

            {guide.sources.length > 0 ? (
              <section aria-labelledby="sources-h">
                <h2 id="sources-h" className="text-muted m-0 mb-3 text-sm font-semibold">
                  {t("sources")}
                </h2>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                  {guide.sources.map((source) => (
                    <li key={source.url + source.label}>
                      <a
                        href={source.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="hover:text-primary inline-flex min-h-8 items-center gap-1 underline underline-offset-4"
                      >
                        {source.label}
                        <Icon icon={IconExternal} />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section
              aria-labelledby="cta-h"
              className="bg-primary-subtle border-primary/20 rounded-panel flex flex-col gap-4 border p-6 md:p-8 print:hidden"
            >
              <h2 id="cta-h" className="m-0 text-2xl">
                {t(`cta.${cta}.title`)}
              </h2>
              <p className="text-muted m-0 max-w-xl">{t(`cta.${cta}.body`)}</p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button asChild size="lg">
                  <a href={ownerHref(cta === "landlord" ? "/signup" : "/login", locale)}>{t(`cta.${cta}.button`)}</a>
                </Button>
                <a
                  href={href(cta === "landlord" ? "/landlords" : "/")}
                  className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-[6px]"
                >
                  {t("cta.more")}
                </a>
              </div>
            </section>
          </div>
        </div>

        {related.length > 0 ? (
          <section aria-labelledby="related-h" className="border-border mt-16 border-t pt-10 md:mt-24">
            <h2 id="related-h" className="m-0 text-2xl">
              {t("related")}
            </h2>
            <ul className="m-0 mt-8 grid list-none gap-8 p-0 md:grid-cols-3">
              {related.map((item) => (
                <li key={item.slug}>
                  <a href={href(`/guides/${item.slug}`)} className="group flex flex-col gap-2">
                    <span className="text-primary text-sm font-semibold">{t(`categories.${item.category}`)}</span>
                    <span className="group-hover:text-primary text-xl font-semibold text-balance">{item.title}</span>
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
