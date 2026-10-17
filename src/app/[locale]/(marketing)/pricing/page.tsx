import { getTranslations, setRequestLocale } from "next-intl/server";

import { publicPlans } from "@/features/owner/marketing/publicApi";
import { marketingMetadata } from "@/features/owner/marketing/seo";
import type { PublicPlan } from "@/lib/api/pending";
import { formatTHB } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.meta");
  return marketingMetadata("/pricing", locale, {
    title: `${t("pricingTitle")} · getproperty`,
    description: t("pricingDescription"),
  });
}

const UNIT_KEY: Record<PublicPlan["priceUnit"], string> = {
  unit_month: "perUnitMonth",
  building_month: "perBuildingMonth",
  building_year: "perBuildingYear",
  month: "perMonth",
};

/**
 * Pricing (D-156): the plans and their prices are platform settings, so they come from the API
 * (`GET /v1/public/plans`, a contract request) — never typed into this page.
 */
export default async function Pricing({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.pricing");
  const plans = await publicPlans();
  const signIn = getPathname({ href: "/login", locale });
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      <p className="text-muted mt-2 max-w-2xl text-lg">{t("body")}</p>
      {plans && plans.length > 0 ? (
        <>
          <ul className="mt-10 grid gap-4 md:grid-cols-3" data-testid="pricing-plans">
            {plans.map((plan) => (
              <li key={plan.key}>
                <Card padding="lg" className="flex h-full flex-col gap-3">
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  <p className="text-muted text-sm">{plan.summary}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {plan.pricePerUnit
                      ? t(UNIT_KEY[plan.priceUnit], { price: formatTHB(plan.pricePerUnit, locale) })
                      : t("contact")}
                  </p>
                  {plan.minimumUnits ? (
                    <p className="text-muted text-sm">{t("minimum", { count: plan.minimumUnits })}</p>
                  ) : null}
                  <ul className="flex flex-1 flex-col gap-1 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Icon name="check" className="text-primary mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="secondary">
                    <a href={signIn}>{t("choose")}</a>
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-6 text-sm">{t("vat")}</p>
        </>
      ) : (
        <Callout tone="info" className="mt-10">
          {t("unavailable")}
        </Callout>
      )}
    </section>
  );
}
