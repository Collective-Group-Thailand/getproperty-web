import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";

import { LossTeaser } from "@/features/owner/marketing/LossTeaser";
import { formatDate } from "@/i18n/format";
import { publicElectricityTariffs } from "@/features/owner/marketing/publicApi";
import { marketingMetadata, organizationJsonLd } from "@/features/owner/marketing/seo";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Icon, type IconName } from "@/ui/icons";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.meta");
  return marketingMetadata("/", locale, { title: t("title"), description: t("description") });
}

const FEATURES: { key: "readings" | "billing" | "line" | "receipts"; icon: IconName }[] = [
  { key: "readings", icon: "meter" },
  { key: "billing", icon: "shield" },
  { key: "line", icon: "chat" },
  { key: "receipts", icon: "bill" },
];

/** The landing page: the zero-touch billing promise (D-011), the lawful-rate teaser, sign-in. */
export default async function Landing({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing");
  const [tariffs, nonce] = await Promise.all([
    publicElectricityTariffs(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);
  const signIn = getPathname({ href: "/login", locale });
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: organizationJsonLd(t("meta.description")) }}
      />
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
        <div className="flex flex-col gap-5" data-testid="marketing-hero">
          <p className="text-primary text-sm font-semibold">{t("hero.eyebrow")}</p>
          <h1 className="font-display text-4xl leading-tight font-semibold md:text-5xl">{t("hero.title")}</h1>
          <p className="text-muted text-lg">{t("hero.body")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={signIn}>{t("hero.primary")}</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href={getPathname({ href: "/pricing", locale })}>{t("hero.secondary")}</a>
            </Button>
          </div>
        </div>
        <LossTeaser
          tariffs={tariffs}
          signInHref={signIn}
          copy={{
            title: t("loss.title"),
            body: t("loss.body"),
            provider: t("loss.provider"),
            providers: { mea: t("loss.mea"), pea: t("loss.pea") },
            ceiling: t("loss.ceiling"),
            perUnit: t("loss.perUnit"),
            tariffLines: Object.fromEntries(
              Object.entries(tariffs).map(([provider, tariff]) => [
                provider,
                t("loss.tariff", { name: tariff.nameTh, date: formatDate(tariff.effectiveFrom, locale) }),
              ]),
            ),
            source: t("loss.source"),
            cta: t("loss.cta"),
            unavailable: t("loss.unavailable"),
          }}
        />
      </section>
      <section className="bg-surface border-border border-y">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-8 text-2xl font-semibold">{t("features.title")}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <li key={feature.key}>
                <Card padding="lg" className="h-full">
                  <Icon name={feature.icon} className="text-primary mb-3 text-2xl" />
                  <h3 className="font-semibold">{t(`features.items.${feature.key}.title`)}</h3>
                  <p className="text-muted mt-1 text-sm">{t(`features.items.${feature.key}.body`)}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
