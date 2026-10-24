import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageIntro } from "@/features/owner/marketing/PageIntro";
import { lineOaHref, marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, faqSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconBook } from "@/ui/icons/glyphs/book";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCalculator } from "@/ui/icons/glyphs/calculator";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";
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
  ["faq.items", "money"],
  ["faq.items", "meters"],
  ["faq.items", "import"],
  ["pricing.faq.items", "who"],
  ["pricing.faq.items", "line"],
  ["landlords.faq.items", "one"],
  ["faq.items", "data"],
] as const;

/** Help centre (trust pages, D-271; getpack's help centre pattern): topics, top questions, resources, a person. */
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
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <ul className="m-0 mx-auto grid max-w-7xl list-none gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map(([key, glyph, path]) => (
          <li key={key}>
            <a
              href={href(path)}
              className="bg-surface border-border rounded-card hover:border-fg flex h-full items-start gap-4 border p-5 transition-colors"
            >
              <Icon icon={glyph} className="text-primary mt-0.5 shrink-0 text-2xl" />
              <span className="flex flex-col gap-1">
                <span className="font-semibold">{t(`topics.${key}.title`)}</span>
                <span className="text-muted text-sm">{t(`topics.${key}.body`)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-12">
        <section aria-labelledby="top-faq" className="lg:col-span-8">
          <h2 id="top-faq" className="mb-4 text-3xl">
            {t("faqTitle")}
          </h2>
          <div className="border-border border-t">
            {faq.map((item) => (
              <details key={item.question} className="group border-border border-b">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <Icon icon={IconChevronDown} className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="text-muted pb-5 leading-relaxed">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <aside aria-labelledby="resources" className="flex flex-col gap-4 lg:col-span-4">
          <h2 id="resources" className="text-muted text-sm font-semibold">
            {t("resources")}
          </h2>
          {(
            [
              ["/guides", IconBook, "guides"],
              ["/tools", IconCalculator, "tools"],
            ] as const
          ).map(([path, glyph, key]) => (
            <a key={path} href={href(path)} className="border-fg group flex items-start gap-4 border-t-2 pt-4">
              <Icon icon={glyph} className="text-primary mt-1 text-2xl" />
              <span className="flex flex-col">
                <span className="text-xl font-semibold group-hover:underline">{t(key)}</span>
                <span className="text-muted text-sm">{t(`${key}Body`)}</span>
              </span>
            </a>
          ))}
        </aside>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-24">
        <div className="bg-fg text-fg-inverse rounded-photo flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="flex max-w-xl flex-col gap-2">
            <h2 className="text-3xl">{t("person")}</h2>
            <p className="text-lg opacity-85">{t("personBody")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {line ? (
              <Button asChild size="lg" iconStart={IconChat}>
                <a href={line} target="_blank" rel="noopener noreferrer">
                  {m("contact.line")}
                </a>
              </Button>
            ) : null}
            <Button asChild size="lg" variant="secondary">
              <a href={href("/contact")}>{t("contact")}</a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
