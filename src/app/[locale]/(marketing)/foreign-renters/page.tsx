import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageHead, Section, SectionHead, Steps, TextLink } from "@/features/owner/marketing/Layout";
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
      <PageHead
        eyebrow={t("eyebrow")}
        title={t("title")}
        lede={t("lead")}
        actions={
          <>
            <Button asChild size="lg">
              <a href={href("/rent")}>{t("browse")}</a>
            </Button>
            <TextLink href={href("/guides/tm30")}>{t("guide")}</TextLink>
          </>
        }
        aside={
          <Photo
            photo={PHOTOS.skyline}
            priority
            className="rounded-panel aspect-[4/3]"
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
        }
      />
      <Section labelledBy="steps-h" innerClassName="pt-4 md:pt-8">
        <SectionHead id="steps-h" title={t("stepsTitle")} />
        <Steps
          className="mt-10"
          columns={5}
          items={STEPS.map((key) => ({ key, title: t(`steps.${key}.title`), body: t(`steps.${key}.body`) }))}
        />
      </Section>
      <Section tone="subtle" labelledBy="tips-h">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-8">
          <h2 id="tips-h" className="m-0 text-3xl lg:col-span-4">
            {t("tipsTitle")}
          </h2>
          <ul className="border-border m-0 flex list-none flex-col border-t p-0 lg:col-span-8">
            {TIPS.map((key) => (
              <li key={key} className="border-border border-b py-4 text-lg">
                {t(`tips.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </>
  );
}
