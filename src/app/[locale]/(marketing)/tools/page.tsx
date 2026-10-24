import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, itemListSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { TOOL_KEYS, TOOL_PATH } from "@/features/owner/marketing/tools/ToolFrame";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { IconCalculator } from "@/ui/icons/glyphs/calculator";
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
      <header className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-14 pb-12 md:pt-20">
        <p className="text-primary text-sm font-semibold">{t("eyebrow")}</p>
        <h1 className="max-w-3xl text-5xl">{t("title")}</h1>
        <p className="text-muted max-w-2xl text-lg">{t("intro")}</p>
      </header>
      <ul className="m-0 mx-auto grid max-w-7xl list-none gap-6 px-4 pb-24 md:grid-cols-3">
        {TOOL_KEYS.map((key, index) => (
          <li key={key}>
            <a
              href={href(TOOL_PATH[key])}
              className="bg-surface border-border rounded-photo hover:border-fg group flex h-full flex-col gap-6 border p-7 transition-colors"
            >
              <span className="flex items-center justify-between">
                <span className="bg-primary-subtle text-primary rounded-control inline-flex size-12 items-center justify-center">
                  <Icon icon={ICONS[key]} className="text-2xl" />
                </span>
                <span className="text-muted font-mono text-sm">{String(index + 1).padStart(2, "0")}</span>
              </span>
              <span className="flex flex-col gap-2">
                <span className="text-2xl font-semibold group-hover:underline group-hover:underline-offset-4">
                  {t(`${key}.title`)}
                </span>
                <span className="text-muted">{t(`${key}.card`)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
