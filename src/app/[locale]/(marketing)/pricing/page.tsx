import { getTranslations, setRequestLocale } from "next-intl/server";

import { publicPlans, type PublicPlan } from "@/features/owner/marketing/publicApi";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { FaqList, PageHead, Section, SectionHead } from "@/features/owner/marketing/Layout";
import { lineOaHref, marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, faqSchema, softwareSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
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
 * G1 redesign (2026-11-03): one reading column of facts — what is free, what the payment fee covers, the two ways to
 * send bills in LINE, the add-ons the API publishes, and the questions. Nothing explains why it is free, and a module
 * that does not ship yet (the juristic-person package) is left out rather than announced.
 *
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
  const faq = FAQ_KEYS.map((key) => ({ q: t(`faq.items.${key}.q`), a: t(`faq.items.${key}.a`) }));
  return (
    <>
      <JsonLdScript
        graphs={[
          breadcrumbSchema([
            { name: nav("home"), url: `${origin}${getPathname({ href: "/", locale })}` },
            { name: nav("pricing") },
          ]),
          softwareSchema(origin, t("body"), `${origin}${getPathname({ href: "/pricing", locale })}`),
          faqSchema(faq.map((item) => ({ question: item.q, answer: item.a }))),
        ]}
      />
      <PageHead eyebrow={t("eyebrow")} title={t("title")} lede={t("lede")} />

      <Section labelledBy="model-h" innerClassName="pt-0 md:pt-0">
        <h2 id="model-h" className="sr-only">
          {t("modelTitle")}
        </h2>
        <div className="grid gap-6 lg:grid-cols-12" data-testid="pricing-model">
          <Card padding="none" className="flex flex-col p-6 md:p-8 lg:col-span-7">
            <h3 className="text-muted m-0 text-sm font-semibold">{t("free.title")}</h3>
            <p className="text-display m-0 mt-2">{t("free.price")}</p>
            <p className="text-muted m-0 mt-2 text-lg">{t("free.summary")}</p>
            <ul className="border-border m-0 mt-6 flex flex-1 list-none flex-col border-t p-0">
              {FREE_ITEMS.map((key) => (
                <li key={key} className="border-border flex items-start gap-3 border-b py-3">
                  <Icon icon={IconCheck} className="text-primary mt-1 shrink-0" />
                  {t(`free.items.${key}`)}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-6 self-start" iconStart={line ? IconChat : undefined}>
              <a href={start} {...external}>
                {t("free.cta")}
              </a>
            </Button>
          </Card>
          <Card padding="none" className="flex flex-col p-6 md:p-8 lg:col-span-5">
            <h3 className="m-0 text-xl">{t("fee.title")}</h3>
            <p className="text-muted m-0 mt-2">{t("fee.body")}</p>
            <ul className="border-border m-0 mt-6 flex list-none flex-col border-t p-0">
              {FEE_ITEMS.map((key) => (
                <li key={key} className="border-border flex items-start gap-3 border-b py-3">
                  <Icon icon={IconCheck} className="text-muted mt-1 shrink-0" />
                  {t(`fee.items.${key}`)}
                </li>
              ))}
            </ul>
            <p className="text-muted m-0 mt-6 text-sm">{t("fee.rateUnavailable")}</p>
          </Card>
        </div>
        <ul
          className="text-muted m-0 mt-8 flex list-none flex-wrap gap-x-8 gap-y-2 p-0"
          aria-label={t("included.title")}
        >
          {INCLUDED.map((key) => (
            <li key={key} className="flex items-center gap-2">
              <Icon icon={IconCheck} className="text-primary shrink-0" />
              {t(`included.items.${key}`)}
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="subtle" labelledBy="line-h">
        <SectionHead id="line-h" title={t("line.title")} />
        <ul className="m-0 mt-10 grid list-none gap-6 p-0 md:grid-cols-2" data-testid="pricing-line">
          {(["own", "shared"] as const).map((key) => (
            <li key={key} className="border-border flex flex-col gap-2 border-t pt-5">
              <h3 className="m-0 text-xl">{t(`line.${key}.title`)}</h3>
              <p className="text-muted m-0">{t(`line.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </Section>

      {addons.length > 0 ? (
        <Section labelledBy="addons-h">
          <SectionHead id="addons-h" title={t("addons.title")} lede={t("addons.body")} />
          <ul className="m-0 mt-10 grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3" data-testid="pricing-plans">
            {addons.map((plan) => (
              <li key={plan.key}>
                <Card padding="none" className="flex h-full flex-col gap-3 p-6">
                  <h3 className="m-0 text-xl">{plan.name}</h3>
                  <p className="text-muted m-0 text-sm">{plan.summary}</p>
                  <p className="m-0 text-lg font-semibold tabular-nums">{priceLabel(plan, locale, t)}</p>
                  {plan.status === "proposed" ? <p className="text-muted m-0 text-sm">{t("indicative")}</p> : null}
                  <ul className="border-border m-0 flex flex-1 list-none flex-col gap-2 border-t p-0 pt-3 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Icon icon={IconCheck} className="text-primary mt-0.5 shrink-0" />
                        {t(MODULE_KEY[feature])}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="secondary" className="self-start">
                    <a href={start} {...external}>
                      {t("choose")}
                    </a>
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
          {vatExcluded ? <p className="text-muted m-0 mt-4 text-sm">{t("vat")}</p> : null}
        </Section>
      ) : null}

      <Section labelledBy="faq-h" innerClassName={addons.length > 0 ? "pt-0 md:pt-0" : undefined}>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <h2 id="faq-h" className="m-0 text-3xl lg:col-span-4">
            {t("faq.title")}
          </h2>
          <FaqList className="lg:col-span-8" items={faq} openFirst />
        </div>
      </Section>
    </>
  );
}
