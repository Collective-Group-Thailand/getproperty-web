import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageIntro } from "@/features/owner/marketing/PageIntro";
import { marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.security.meta");
  return marketingMetadata("/security", locale, { title: t("title"), description: t("description") });
}

const ITEMS = [
  ["encryption", IconLock],
  ["isolation", IconKey],
  ["access", IconResidents],
  ["money", IconWallet],
  ["backup", IconHistory],
  ["pdpa", IconShield],
] as const;
const DOCS = ["privacy", "pdpa", "dpa", "terms"] as const;

/** Security and PDPA (trust pages, D-271): only what the platform actually does (asset-core envelope, RLS, audit). */
export default async function Security({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.security");
  const legal = await getTranslations("owner.marketing.legal");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  return (
    <>
      <JsonLdScript
        graphs={[
          webPageSchema("WebPage", {
            url: `${origin}${href("/security")}`,
            name: t("title"),
            description: t("lead"),
            inLanguage: locale,
          }),
          breadcrumbSchema([{ name: nav("home"), url: `${origin}${href("/")}` }, { name: t("eyebrow") }]),
        ]}
      />
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <ul className="m-0 mx-auto grid max-w-7xl list-none gap-x-10 gap-y-12 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(([key, glyph]) => (
          <li key={key} className="border-fg flex flex-col gap-3 border-t-2 pt-5">
            <Icon icon={glyph} className="text-primary text-2xl" />
            <h2 className="text-2xl">{t(`items.${key}.title`)}</h2>
            <p className="text-muted leading-relaxed">{t(`items.${key}.body`)}</p>
          </li>
        ))}
      </ul>
      <section className="border-border mx-auto grid max-w-7xl gap-6 border-t px-4 py-12 md:grid-cols-12">
        <h2 className="text-muted text-sm font-semibold md:col-span-3">{t("docs")}</h2>
        <ul className="m-0 flex list-none flex-wrap gap-x-8 gap-y-3 p-0 md:col-span-9">
          {DOCS.map((doc) => (
            <li key={doc}>
              <a href={href(`/legal/${doc}`)} className="hover:text-primary underline underline-offset-4">
                {legal(`docs.${doc}.title`)}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-muted md:col-span-9 md:col-start-4">{t("report")}</p>
      </section>
    </>
  );
}
