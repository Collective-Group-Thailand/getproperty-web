import { getTranslations, setRequestLocale } from "next-intl/server";

import { publicPlans, type PublicPlan } from "@/features/owner/marketing/publicApi";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { lineOaHref, marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, faqSchema, softwareSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";

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

const INCLUDED = ["monthly", "units", "setup", "export"] as const;
const FREE_ITEMS = ["billing", "line", "lease", "staff", "buildings"] as const;
const FEE_ITEMS = ["split", "slip", "who", "invoice"] as const;
const FAQ_KEYS = ["when", "who", "settle", "line", "meter", "invoice"] as const;

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
 * Pricing (D-250, Accepted 2026-10-24: free for operators, a fee per payment collected through the platform; supersedes the
 * per-unit plans of D-156/D-204). The fee rate is a platform setting the API does not publish yet
 * (docs/contract-requests.md), so no number is shown until it does. Hardware add-ons still come from
 * `GET /v1/public/plans` (`kind: addon`).
 *
 * Earlier: Pricing (D-156): the plans and their prices are platform settings, so they come from the API
 * (`GET /v1/public/plans`, D-180) — never typed into this page. While D-156 is Proposed every plan says
 * `status: proposed` and is shown as indicative; every module key (`PlanModuleKey`) is listed with its label.
 */
export default async function Pricing({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.pricing");
  const plans = await publicPlans();
  const addons = plans?.filter((plan) => plan.kind === "addon") ?? [];
  const vatExcluded = addons.every((plan) => !plan.vatIncluded);
  const signIn = ownerHref("/login", locale);
  const line = lineOaHref();
  const start = line ?? signIn;
  const external = line ? { rel: "noopener noreferrer", target: "_blank" } : {};
  const origin = marketingOrigin();
  const nav = await getTranslations("owner.marketing.nav");
  return (
    <>
      <JsonLdScript
        graphs={[
          breadcrumbSchema([
            { name: nav("home"), url: `${origin}${getPathname({ href: "/", locale })}` },
            { name: nav("pricing") },
          ]),
          softwareSchema(origin, t("body"), `${origin}${getPathname({ href: "/pricing", locale })}`),
          faqSchema(FAQ_KEYS.map((key) => ({ question: t(`faq.items.${key}.q`), answer: t(`faq.items.${key}.a`) }))),
        ]}
      />
      <section className="bg-surface-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 pt-14 pb-10 text-center md:pt-20">
          <p className="text-primary text-sm font-semibold">{t("eyebrow")}</p>
          <h1 className="max-w-3xl text-4xl">{t("title")}</h1>
          <p className="text-muted max-w-2xl text-lg">{t("body")}</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-5 lg:grid-cols-2" data-testid="pricing-model">
          <Card padding="lg" className="border-primary/40 flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{t("free.title")}</h2>
            <p className="text-display">{t("free.price")}</p>
            <p className="text-muted">{t("free.summary")}</p>
            <ul className="border-border flex flex-1 flex-col gap-2 border-t pt-4">
              {FREE_ITEMS.map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <Icon icon={IconCheck} className="text-primary mt-1 shrink-0" />
                  {t(`free.items.${key}`)}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" iconStart={line ? IconChat : undefined}>
              <a href={start} {...external}>
                {t("free.cta")}
              </a>
            </Button>
          </Card>
          <Card padding="lg" className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{t("fee.title")}</h2>
            <p className="text-muted">{t("fee.body")}</p>
            <p className="bg-surface-subtle rounded-control p-4 font-semibold">{t("fee.rateUnavailable")}</p>
            <ul className="border-border flex flex-1 flex-col gap-2 border-t pt-4">
              {FEE_ITEMS.map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <Icon icon={IconCheck} className="text-primary mt-1 shrink-0" />
                  {t(`fee.items.${key}`)}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-14 flex flex-col gap-5" data-testid="pricing-line">
          <h2 className="text-2xl">{t("line.title")}</h2>
          <ul className="grid gap-5 md:grid-cols-2">
            {(["own", "shared"] as const).map((key) => (
              <li key={key}>
                <Card padding="lg" className="flex h-full flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary-subtle text-primary-subtle-fg rounded-control grid size-10 place-items-center">
                      <Icon icon={IconChat} className="text-xl" />
                    </span>
                    <h3 className="text-lg font-semibold">{t(`line.${key}.title`)}</h3>
                  </div>
                  <p className="text-muted leading-relaxed">{t(`line.${key}.body`)}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>

        {addons.length > 0 ? (
          <div className="mt-14 flex flex-col gap-5">
            <div>
              <h2 className="text-2xl">{t("addons.title")}</h2>
              <p className="text-muted mt-1">{t("addons.body")}</p>
            </div>
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="pricing-plans">
              {addons.map((plan) => (
                <li key={plan.key}>
                  <Card padding="lg" className="flex h-full flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      {plan.status === "proposed" ? (
                        <Badge size="sm" tone="info">
                          {t("indicative")}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted text-sm">{plan.summary}</p>
                    <p className="text-xl font-semibold tabular-nums">{priceLabel(plan, locale, t)}</p>
                    <ul className="flex flex-1 flex-col gap-1 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Icon icon={IconCheck} className="text-primary mt-0.5 shrink-0" />
                          {t(MODULE_KEY[feature])}
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant="secondary">
                      <a href={start} {...external}>
                        {t("choose")}
                      </a>
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
            {vatExcluded ? <p className="text-muted text-sm">{t("vat")}</p> : null}
          </div>
        ) : null}

        <Card
          padding="lg"
          className="bg-surface-subtle mt-10 flex flex-col gap-4 border-transparent shadow-none md:flex-row md:items-center md:justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold">{t("enterprise.title")}</h2>
            <p className="text-muted mt-1">{t("enterprise.body")}</p>
          </div>
          {line ? (
            <Button asChild variant="secondary" iconStart={IconChat}>
              <a href={line} {...external}>
                {t("enterprise.cta")}
              </a>
            </Button>
          ) : null}
        </Card>

        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">{t("included.title")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {INCLUDED.map((key) => (
              <li key={key} className="flex items-start gap-2">
                <Icon icon={IconCheck} className="text-primary mt-1 shrink-0" />
                {t(`included.items.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="bg-surface-subtle">
        <div className="mx-auto max-w-3xl px-4 py-16 md:py-20">
          <h2 className="mb-4 text-3xl">{t("faq.title")}</h2>
          <div className="border-border border-t">
            {FAQ_KEYS.map((key, index) => (
              <details key={key} className="group border-border border-b py-5" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {t(`faq.items.${key}.q`)}
                  <Icon
                    icon={IconChevronDown}
                    className="text-primary mt-1 shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="text-muted mt-3 leading-relaxed">{t(`faq.items.${key}.a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
