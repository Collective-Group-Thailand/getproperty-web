import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContactForm } from "@/features/owner/marketing/contact/ContactForm";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageHead, WRAP } from "@/features/owner/marketing/Layout";
import { lineOaHref, marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, webPageSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { IconChat } from "@/ui/icons/glyphs/chat";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.contact.meta");
  return marketingMetadata("/contact", locale, { title: t("title"), description: t("description") });
}

/**
 * Contact (trust pages, D-271; G1 redesign 2026-11-03): the message form is the page's task, on a white panel; LINE —
 * the channel the team answers fastest — and the company facts sit beside it (under it on a phone).
 */
export default async function Contact({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.contact");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  const line = lineOaHref();
  return (
    <>
      <JsonLdScript
        graphs={[
          {
            ...webPageSchema("ContactPage", {
              url: `${origin}${href("/contact")}`,
              name: t("title"),
              description: t("lead"),
              inLanguage: locale,
            }),
            mainEntity: {
              "@type": "Organization",
              name: "getproperty",
              url: origin,
              ...(line
                ? {
                    contactPoint: [
                      {
                        "@type": "ContactPoint",
                        contactType: "customer service",
                        url: line,
                        hoursAvailable: t("hours"),
                      },
                    ],
                  }
                : {}),
            },
          },
          breadcrumbSchema([{ name: nav("home"), url: `${origin}${href("/")}` }, { name: t("eyebrow") }]),
        ]}
      />
      <PageHead eyebrow={t("eyebrow")} title={t("title")} lede={t("lead")} />
      <div className={`${WRAP} grid gap-10 pb-16 md:pb-24 lg:grid-cols-12 lg:gap-8`}>
        <section
          aria-labelledby="form-h"
          className="bg-surface border-border rounded-panel shadow-card border p-6 md:p-8 lg:order-2 lg:col-span-8"
        >
          <h2 id="form-h" className="m-0 mb-6 text-2xl">
            {t("formTitle")}
          </h2>
          <ContactForm privacyHref={href("/legal/privacy")} />
        </section>
        <aside className="flex flex-col gap-8 lg:order-1 lg:col-span-4 lg:pe-8">
          {line ? (
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" variant="secondary" iconStart={IconChat} className="self-start">
                <a href={line} target="_blank" rel="noopener noreferrer">
                  {t("line")}
                </a>
              </Button>
              <p className="text-muted m-0 text-sm">{t("lineNote")}</p>
            </div>
          ) : null}
          <dl className="border-border m-0 flex flex-col border-t text-sm">
            <div className="border-border flex flex-col gap-1 border-b py-4">
              <dt className="text-muted">{t("companyLabel")}</dt>
              <dd className="m-0 font-semibold">{t("company")}</dd>
            </div>
            <div className="border-border flex flex-col gap-1 border-b py-4">
              <dt className="text-muted">{t("hoursLabel")}</dt>
              <dd className="m-0">{t("hours")}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
