import { getTranslations, setRequestLocale } from "next-intl/server";

import { publicPlans, type PublicPlan } from "@/features/owner/marketing/publicApi";
import { marketingMetadata, ownerHref } from "@/features/owner/marketing/seo";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { IconCheck } from "@/ui/icons/glyphs/check";

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

/** Every module key of the contract has a label: a key the API adds fails the build until it is named here. */
const MODULE_KEY: Record<Schemas["PlanModuleKey"], string> = {
  A1: "module.A1",
  A2: "module.A2",
  A3: "module.A3",
  A4: "module.A4",
  B1: "module.B1",
  B2: "module.B2",
  B3: "module.B3",
  C1: "module.C1",
  C2: "module.C2",
  C3: "module.C3",
  D1: "module.D1",
  D2: "module.D2",
  resident_liff: "module.resident_liff",
  promptpay: "module.promptpay",
};

const UNIT_KEY: Record<PublicPlan["priceUnit"], string> = {
  unit_month: "perUnitMonth",
  building_month: "perBuildingMonth",
  building_year: "perBuildingYear",
  month: "perMonth",
  report: "perReport",
  meter_point_month: "perMeterPointMonth",
};

/** The price line exactly as the API publishes it: one price, a quoted range, or "ask us". */
function priceLabel(plan: PublicPlan, locale: Locale, t: (key: string, values?: Record<string, string>) => string) {
  if (plan.pricePerUnit) return t(UNIT_KEY[plan.priceUnit], { price: formatTHB(plan.pricePerUnit, locale) });
  if (plan.priceFrom && plan.priceTo) {
    const price = t("range", { from: formatTHB(plan.priceFrom, locale), to: formatTHB(plan.priceTo, locale) });
    return t(UNIT_KEY[plan.priceUnit], { price });
  }
  if (plan.priceFrom)
    return t(UNIT_KEY[plan.priceUnit], { price: t("from", { price: formatTHB(plan.priceFrom, locale) }) });
  return t("contact");
}

/**
 * Pricing (D-156): the plans and their prices are platform settings, so they come from the API
 * (`GET /v1/public/plans`, D-180) — never typed into this page. While D-156 is Proposed every plan says
 * `status: proposed` and is shown as indicative; every module key (`PlanModuleKey`) is listed with its label.
 */
export default async function Pricing({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.pricing");
  const plans = await publicPlans();
  const vatExcluded = plans?.every((plan) => !plan.vatIncluded) ?? true;
  const signIn = ownerHref("/login", locale);
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{plan.name}</h2>
                    {plan.kind === "addon" ? <Badge size="sm">{t("addon")}</Badge> : null}
                    {plan.status === "proposed" ? (
                      <Badge size="sm" tone="info">
                        {t("indicative")}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted text-sm">{plan.summary}</p>
                  <p className="text-2xl font-semibold tabular-nums">{priceLabel(plan, locale, t)}</p>
                  {plan.minimumUnits ? (
                    <p className="text-muted text-sm">{t("minimum", { count: plan.minimumUnits })}</p>
                  ) : null}
                  <ul className="flex flex-1 flex-col gap-1 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Icon icon={IconCheck} className="text-primary mt-0.5" />
                        {t(MODULE_KEY[feature])}
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
          {vatExcluded ? <p className="text-muted mt-6 text-sm">{t("vat")}</p> : null}
        </>
      ) : (
        <Callout tone="info" className="mt-10">
          {t("unavailable")}
        </Callout>
      )}
    </section>
  );
}
