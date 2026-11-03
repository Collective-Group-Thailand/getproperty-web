import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageHead, Section, SectionHead, WRAP } from "@/features/owner/marketing/Layout";
import { marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
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
      <PageHead eyebrow={t("eyebrow")} title={t("title")} lede={t("lead")} />
      <ul className={`${WRAP} m-0 grid list-none gap-x-8 gap-y-10 pb-16 sm:grid-cols-2 md:pb-24 lg:grid-cols-3`}>
        {ITEMS.map(([key, glyph]) => (
          <li key={key} className="border-border flex flex-col gap-2 border-t pt-5">
            <Icon icon={glyph} className="text-primary text-xl" />
            <h2 className="m-0 mt-1 text-xl">{t(`items.${key}.title`)}</h2>
            <p className="text-muted m-0 text-pretty">{t(`items.${key}.body`)}</p>
          </li>
        ))}
      </ul>
      <Section tone="subtle" labelledBy="docs-h">
        <SectionHead id="docs-h" title={t("docs")} lede={t("report")} />
        <ul className="m-0 mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {DOCS.map((doc) => (
            <li key={doc}>
              <a
                href={href(`/legal/${doc}`)}
                className="group bg-surface border-border rounded-card hover:border-border-strong flex h-full items-center justify-between gap-3 border p-5 font-semibold transition-colors"
              >
                {legal(`docs.${doc}.title`)}
                <Icon icon={IconChevronRight} className="text-muted group-hover:text-primary shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
