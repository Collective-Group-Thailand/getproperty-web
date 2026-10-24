import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContactForm } from "@/features/owner/marketing/contact/ContactForm";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageIntro } from "@/features/owner/marketing/PageIntro";
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

/** Contact (trust pages, D-271): LINE first — the channel the team answers fastest — and a message form. */
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
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-24 lg:grid-cols-12">
        <aside className="flex flex-col gap-8 lg:col-span-4">
          {line ? (
            <div className="border-fg flex flex-col gap-3 border-t-2 pt-5">
              <Button asChild size="lg" iconStart={IconChat} className="self-start">
                <a href={line} target="_blank" rel="noopener noreferrer">
                  {t("line")}
                </a>
              </Button>
              <p className="text-muted text-sm">{t("lineNote")}</p>
            </div>
          ) : null}
          <dl className="border-border m-0 flex flex-col gap-4 border-t pt-5 text-sm">
            <div>
              <dt className="text-muted">{t("eyebrow")}</dt>
              <dd className="m-0 font-semibold">{t("company")}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("hoursLabel")}</dt>
              <dd className="m-0">{t("hours")}</dd>
            </div>
          </dl>
        </aside>
        <section aria-labelledby="form-h" className="lg:col-span-8">
          <h2 id="form-h" className="mb-6 text-3xl">
            {t("formTitle")}
          </h2>
          <ContactForm privacyHref={href("/legal/privacy")} />
        </section>
      </div>
    </>
  );
}
