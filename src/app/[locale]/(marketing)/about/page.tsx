import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageIntro } from "@/features/owner/marketing/PageIntro";
import { Photo } from "@/features/owner/marketing/Photo";
import { PHOTOS } from "@/features/owner/marketing/photos";
import { marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, organizationSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.about.meta");
  return marketingMetadata("/about", locale, { title: t("title"), description: t("description") });
}

const PRINCIPLES = ["free", "honest", "money", "data"] as const;

/** About (trust pages, D-271): why getproperty exists, what it stands for, who operates it. */
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
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <div className="mx-auto max-w-7xl px-4">
        <Photo photo={PHOTOS.livingGreen} decorative sizes="100vw" className="rounded-photo aspect-[21/9]" />
      </div>
      <section aria-labelledby="principles" className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:grid-cols-12">
        <h2 id="principles" className="text-3xl md:col-span-4">
          {t("principlesTitle")}
        </h2>
        <ol className="m-0 grid list-none gap-x-10 gap-y-12 p-0 sm:grid-cols-2 md:col-span-8">
          {PRINCIPLES.map((key, index) => (
            <li key={key} className="border-fg flex flex-col gap-3 border-t-2 pt-5">
              <span className="text-muted font-mono text-sm">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="text-2xl">{t(`principles.${key}.title`)}</h3>
              <p className="text-muted leading-relaxed">{t(`principles.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="bg-fg text-fg-inverse">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-12 md:items-center">
          <div className="flex flex-col gap-3 md:col-span-8">
            <h2 className="text-sm font-semibold opacity-80">{t("companyTitle")}</h2>
            <p className="text-2xl leading-relaxed">{t("company")}</p>
          </div>
          <div className="flex flex-wrap gap-3 md:col-span-4 md:justify-end">
            <Button asChild size="lg">
              <a href={ownerHref("/login", locale)}>{t("cta")}</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href={href("/contact")}>{t("contact")}</a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
