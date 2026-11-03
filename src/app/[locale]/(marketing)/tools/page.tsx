import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageHead, WRAP } from "@/features/owner/marketing/Layout";
import { marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, itemListSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { TOOL_KEYS, TOOL_PATH } from "@/features/owner/marketing/tools/ToolFrame";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { IconCalculator } from "@/ui/icons/glyphs/calculator";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconPercent } from "@/ui/icons/glyphs/percent";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.tools");
  return marketingMetadata("/tools", locale, { title: t("metaTitle"), description: t("intro") });
}

const ICONS = { utility: IconCalculator, receipt: IconReceipt, yield: IconPercent } as const;

/** Free tools (D-271): three things owners do by hand every month, done in the browser. */
export default async function Tools({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.tools");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  return (
    <>
      <JsonLdScript
        graphs={[
          webPageSchema("CollectionPage", {
            url: `${origin}${href("/tools")}`,
            name: t("title"),
            description: t("intro"),
            inLanguage: locale,
          }),
          breadcrumbSchema([{ name: nav("home"), url: `${origin}${href("/")}` }, { name: t("title") }]),
          itemListSchema(TOOL_KEYS.map((key) => `${origin}${href(TOOL_PATH[key])}`)),
        ]}
      />
      <PageHead eyebrow={t("eyebrow")} title={t("title")} lede={t("intro")} />
      <ul className={`${WRAP} m-0 grid list-none gap-6 pb-16 md:grid-cols-3 md:pb-24`}>
        {TOOL_KEYS.map((key) => (
          <li key={key}>
            <a
              href={href(TOOL_PATH[key])}
              className="group bg-surface border-border rounded-card shadow-card hover:border-border-strong flex h-full flex-col gap-4 border p-6 transition-colors md:p-8"
            >
              <Icon icon={ICONS[key]} className="text-primary text-2xl" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="text-xl font-semibold">{t(`${key}.title`)}</span>
                <span className="text-muted text-pretty">{t(`${key}.card`)}</span>
              </span>
              <span className="text-primary inline-flex items-center gap-1 font-semibold">
                {t("open")}
                <Icon
                  icon={IconChevronRight}
                  className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
