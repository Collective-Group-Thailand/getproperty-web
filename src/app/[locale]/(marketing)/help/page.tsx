import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { CtaPanel, FaqList, PageHead, WRAP } from "@/features/owner/marketing/Layout";
import { lineOaHref, marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, faqSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconBook } from "@/ui/icons/glyphs/book";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCalculator } from "@/ui/icons/glyphs/calculator";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.help.meta");
  return marketingMetadata("/help", locale, { title: t("title"), description: t("description") });
}

/** Help topics → where the answer lives today (a FAQ anchor, a page, a guide). */
const TOPICS: [key: string, glyph: IconGlyph, path: string][] = [
  ["start", IconBuilding, "/#faq"],
  ["billing", IconBill, "/pricing"],
  ["meters", IconMeter, "/tools/utility-bill"],
  ["residents", IconResidents, "/#features"],
  ["listings", IconHome, "/landlords"],
  ["pricing", IconWallet, "/pricing"],
];

/** The questions people ask most, drawn from the FAQs the public pages already answer (one source of copy). */
const TOP_FAQ = [
  ["faq.items", "what"],
  ["faq.items", "meters"],
  ["faq.items", "import"],
  ["pricing.faq.items", "who"],
  ["pricing.faq.items", "line"],
  ["landlords.faq.items", "one"],
  ["faq.items", "data"],
] as const;

/**
 * Help centre (trust pages, D-271; G1 redesign 2026-11-03): the task first — pick a topic — then the top questions with
 * the resources beside them, and a person to talk to on a light panel.
 */
export default async function Help({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.help");
  const m = await getTranslations("owner.marketing");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) =>
    getPathname({ href: path.split("#")[0]!, locale }) + (path.includes("#") ? `#${path.split("#")[1]}` : "");
  const faq = TOP_FAQ.map(([group, key]) => ({ question: m(`${group}.${key}.q`), answer: m(`${group}.${key}.a`) }));
  const line = lineOaHref();
  return (
    <>
      <JsonLdScript
        graphs={[
          webPageSchema("WebPage", {
            url: `${origin}${href("/help")}`,
            name: t("title"),
            description: t("lead"),
            inLanguage: locale,
          }),
          breadcrumbSchema([{ name: nav("home"), url: `${origin}${href("/")}` }, { name: t("eyebrow") }]),
          faqSchema(faq),
        ]}
      />
      <PageHead eyebrow={t("eyebrow")} title={t("title")} lede={t("lead")} />
      <nav aria-label={t("topicsLabel")} className={WRAP}>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map(([key, glyph, path]) => (
            <li key={key}>
              <a
                href={href(path)}
                className="group bg-surface border-border rounded-card shadow-card hover:border-border-strong flex h-full items-start gap-4 border p-5 transition-colors"
              >
                <Icon icon={glyph} className="text-primary mt-0.5 shrink-0 text-xl" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold">{t(`topics.${key}.title`)}</span>
                  <span className="text-muted text-sm">{t(`topics.${key}.body`)}</span>
                </span>
                <Icon icon={IconChevronRight} className="text-muted group-hover:text-primary mt-0.5 shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className={`${WRAP} grid gap-12 py-16 md:py-24 lg:grid-cols-12 lg:gap-8`}>
        <section aria-labelledby="top-faq" className="lg:col-span-8">
          <h2 id="top-faq" className="m-0 mb-6 text-3xl">
            {t("faqTitle")}
          </h2>
          <FaqList items={faq.map((item) => ({ q: item.question, a: item.answer }))} />
        </section>
        <aside aria-labelledby="resources" className="flex flex-col gap-4 lg:col-span-4 lg:ps-8">
          <h2 id="resources" className="text-muted m-0 text-sm font-semibold">
            {t("resources")}
          </h2>
          <ul className="border-border m-0 list-none border-t p-0">
            {(
              [
                ["/guides", IconBook, "guides"],
                ["/tools", IconCalculator, "tools"],
              ] as const
            ).map(([path, glyph, key]) => (
              <li key={path} className="border-border border-b">
                <a href={href(path)} className="group flex items-start gap-4 py-5">
                  <Icon icon={glyph} className="text-primary mt-1 shrink-0 text-xl" />
                  <span className="flex flex-col gap-1">
                    <span className="group-hover:text-primary text-lg font-semibold">{t(key)}</span>
                    <span className="text-muted text-sm">{t(`${key}Body`)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <CtaPanel
        id="person-h"
        className="pt-0 md:pt-0"
        title={t("person")}
        body={t("personBody")}
        primary={
          line
            ? { href: line, label: m("contact.line"), external: true, icon: IconChat }
            : { href: href("/contact"), label: t("contact") }
        }
        secondary={line ? { href: href("/contact"), label: t("contact") } : undefined}
      />
    </>
  );
}
