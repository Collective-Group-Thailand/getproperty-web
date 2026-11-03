import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { CtaPanel, PageHead, Section, SectionHead, WRAP } from "@/features/owner/marketing/Layout";
import { Photo } from "@/features/owner/marketing/Photo";
import { PHOTOS } from "@/features/owner/marketing/photos";
import { marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, organizationSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.about.meta");
  return marketingMetadata("/about", locale, { title: t("title"), description: t("description") });
}

const PRINCIPLES = ["honest", "money", "data"] as const;

/**
 * About (trust pages, D-271; G1 redesign 2026-11-03): why getproperty exists, what it stands for, who operates it, and
 * one way on. No business-model explanation: the principles are about how renters, owners and their money are treated.
 */
export default async function About({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.about");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  return (
    <>
      <JsonLdScript
        graphs={[
          webPageSchema("AboutPage", {
            url: `${origin}${href("/about")}`,
            name: t("title"),
            description: t("lead"),
            inLanguage: locale,
          }),
          organizationSchema(origin, t("company")),
          breadcrumbSchema([{ name: nav("home"), url: `${origin}${href("/")}` }, { name: t("eyebrow") }]),
        ]}
      />
      <PageHead eyebrow={t("eyebrow")} title={t("title")} lede={t("lead")} />
      <div className={WRAP}>
        <Photo
          photo={PHOTOS.livingGreen}
          decorative
          priority
          sizes="(min-width: 1280px) 1216px, 100vw"
          className="rounded-panel aspect-[16/9] md:aspect-[21/9]"
        />
      </div>
      <Section labelledBy="principles">
        <SectionHead id="principles" title={t("principlesTitle")} />
        <ol className="m-0 mt-10 grid list-none gap-x-8 gap-y-10 p-0 md:grid-cols-3">
          {PRINCIPLES.map((key, index) => (
            <li key={key} className="border-border flex flex-col gap-2 border-t pt-5">
              <span className="text-primary font-mono text-sm tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="m-0 text-xl">{t(`principles.${key}.title`)}</h3>
              <p className="text-muted m-0 text-pretty">{t(`principles.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </Section>
      <CtaPanel
        id="company-h"
        className="pt-0 md:pt-0"
        title={t("companyTitle")}
        body={t("company")}
        primary={{ href: ownerHref("/login", locale), label: t("cta") }}
        secondary={{ href: href("/contact"), label: t("contact") }}
      />
    </>
  );
}
