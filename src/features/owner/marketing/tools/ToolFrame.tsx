import { getTranslations } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { BackLink, CtaPanel, FaqList, Fold, WRAP } from "@/features/owner/marketing/Layout";
import { marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, faqSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export const TOOL_KEYS = ["utility", "receipt", "yield"] as const;
export type ToolKey = (typeof TOOL_KEYS)[number];
export const TOOL_PATH: Record<ToolKey, "/tools/utility-bill" | "/tools/rent-receipt" | "/tools/rental-yield"> = {
  utility: "/tools/utility-bill",
  receipt: "/tools/rent-receipt",
  yield: "/tools/rental-yield",
};
const FAQ_COUNT = 2;

/**
 * The frame of one free tool (D-271; G1 redesign 2026-11-03): a back link, the h1 and one line, then the tool itself at
 * once. The two short answers are folded under it (they are there for search engines and the curious), and the product
 * it points to closes the page on a light panel. JSON-LD: a free WebApplication, breadcrumb and FAQ.
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
      <div className={`${WRAP} pt-8 pb-16 md:pt-12 md:pb-24`}>
        <BackLink href={href("/tools")} label={shared("back")} />
        <header className="mt-6 mb-10 flex max-w-3xl flex-col gap-4 md:mb-12 print:hidden">
          <p className="text-muted m-0 text-sm font-medium">{shared("eyebrow")}</p>
          <h1 className="m-0 text-4xl text-balance">{t("title")}</h1>
          <p className="text-muted m-0 text-lg text-pretty">{t("intro")}</p>
        </header>

        {children}
      </div>

      <div className={`${WRAP} print:hidden`}>
        <Fold id="tool-faq" title={shared("faqTitle")} hint={shared("faqHint")}>
          <FaqList items={faq.map((item) => ({ q: item.question, a: item.answer }))} />
        </Fold>
      </div>

      <CtaPanel
        id="tool-cta"
        variant="band"
        title={t("cta.title")}
        body={t("cta.body")}
        primary={{ href: ownerHref(tool === "yield" ? "/signup" : "/login", locale), label: shared("start") }}
      />
    </>
  );
}
