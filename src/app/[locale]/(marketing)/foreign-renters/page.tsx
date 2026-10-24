import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { Photo } from "@/features/owner/marketing/Photo";
import { PHOTOS } from "@/features/owner/marketing/photos";
import { marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.foreign.meta");
  return marketingMetadata("/foreign-renters", locale, { title: t("title"), description: t("description") });
}

const STEPS = ["find", "lease", "tm30", "pay", "move"] as const;
const TIPS = ["deposit", "scam", "utilities", "tm30"] as const;

/** Foreign residents (D-260): the rental path in English, from finding a place to moving out. */
export default async function ForeignRenters({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.foreign");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  return (
    <>
      <JsonLdScript
        graphs={[
          webPageSchema("WebPage", {
            url: `${origin}${href("/foreign-renters")}`,
            name: t("title"),
            description: t("lead"),
            inLanguage: locale,
          }),
          breadcrumbSchema([{ name: nav("home"), url: `${origin}${href("/")}` }, { name: t("eyebrow") }]),
        ]}
      />
      <section className="mx-auto grid max-w-7xl gap-10 px-4 pt-14 pb-16 md:pt-20 lg:grid-cols-12 lg:items-end">
        <div className="flex flex-col gap-5 lg:col-span-6">
          <p className="text-primary text-sm font-semibold">{t("eyebrow")}</p>
          <h1 className="text-display leading-tight">{t("title")}</h1>
          <p className="text-muted text-xl leading-relaxed">{t("lead")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={href("/rent")}>{t("browse")}</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href={href("/guides/tm30")}>{t("guide")}</a>
            </Button>
          </div>
        </div>
        <Photo photo={PHOTOS.skyline} priority className="rounded-photo aspect-[4/3] lg:col-span-6" />
      </section>
      <ol className="m-0 mx-auto grid max-w-7xl list-none gap-x-8 gap-y-10 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((key, index) => (
          <li key={key} className="border-fg flex flex-col gap-3 border-t-2 pt-5">
            <span className="text-muted font-mono text-sm">{String(index + 1).padStart(2, "0")}</span>
            <h2 className="text-xl">{t(`steps.${key}.title`)}</h2>
            <p className="text-muted text-sm leading-relaxed">{t(`steps.${key}.body`)}</p>
          </li>
        ))}
      </ol>
      <section className="bg-surface-subtle">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-12">
          <h2 className="text-3xl md:col-span-4">{t("tipsTitle")}</h2>
          <ul className="m-0 flex list-none flex-col p-0 md:col-span-8">
            {TIPS.map((key) => (
              <li key={key} className="border-border border-b py-4 text-lg first:border-t">
                {t(`tips.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
