import { getTranslations } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, faqSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";

export const TOOL_KEYS = ["utility", "receipt", "yield"] as const;
export type ToolKey = (typeof TOOL_KEYS)[number];
export const TOOL_PATH: Record<ToolKey, "/tools/utility-bill" | "/tools/rent-receipt" | "/tools/rental-yield"> = {
  utility: "/tools/utility-bill",
  receipt: "/tools/rent-receipt",
  yield: "/tools/rental-yield",
};
const FAQ_COUNT = 2;

/**
 * The frame of one free tool (D-271): heading, the tool itself, two short answers about it, and the product it
 * points to. JSON-LD: a free WebApplication, breadcrumb and FAQ.
 */
export async function ToolFrame({
  tool,
  locale,
  children,
}: {
  tool: ToolKey;
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = await getTranslations(`owner.marketing.tools.${tool}`);
  const shared = await getTranslations("owner.marketing.tools");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  const url = `${origin}${href(TOOL_PATH[tool])}`;
  const faq = Array.from({ length: FAQ_COUNT }, (_, i) => ({ question: t(`faq.${i}.q`), answer: t(`faq.${i}.a`) }));

  return (
    <>
      <JsonLdScript
        graphs={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: t("title"),
            description: t("intro"),
            url,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Any",
            inLanguage: locale,
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "THB" },
          },
          breadcrumbSchema([
            { name: nav("home"), url: `${origin}${href("/")}` },
            { name: shared("title"), url: `${origin}${href("/tools")}` },
            { name: t("title") },
          ]),
          faqSchema(faq),
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-20">
        <a
          href={href("/tools")}
          className="text-muted hover:text-fg inline-flex items-center gap-1 text-sm print:hidden"
        >
          <Icon icon={IconChevronLeft} />
          {shared("back")}
        </a>
        <header className="mt-8 mb-12 flex max-w-3xl flex-col gap-4 print:hidden">
          <p className="text-primary text-sm font-semibold">{shared("eyebrow")}</p>
          <h1 className="text-4xl md:text-5xl">{t("title")}</h1>
          <p className="text-muted text-lg">{t("intro")}</p>
        </header>

        {children}

        <section className="mt-20 grid gap-10 md:grid-cols-12 print:hidden">
          <h2 className="text-3xl md:col-span-4">{shared("faqTitle")}</h2>
          <div className="border-border border-t md:col-span-8">
            {faq.map((item) => (
              <div key={item.question} className="border-border border-b py-5">
                <h3 className="text-lg font-semibold">{item.question}</h3>
                <p className="text-muted mt-2 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-fg mt-16 flex flex-col gap-6 border-y-2 py-10 md:flex-row md:items-center md:justify-between print:hidden">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-3xl">{t("cta.title")}</h2>
            <p className="text-muted text-lg">{t("cta.body")}</p>
          </div>
          <Button asChild size="lg">
            <a href={ownerHref("/login", locale)}>{shared("start")}</a>
          </Button>
        </section>
      </div>
    </>
  );
}
