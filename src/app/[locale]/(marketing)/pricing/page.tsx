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
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconRoom } from "@/ui/icons/glyphs/room";
import { IconSettings } from "@/ui/icons/glyphs/settings";

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
const FEE_ROWS = ["qr", "slip"] as const;
const FEE_NOTES = ["split", "who", "invoice"] as const;
const INCLUDED_ICON = {
  monthly: IconCalendar,
  units: IconRoom,
  setup: IconSettings,
  export: IconDownload,
} as const satisfies Record<(typeof INCLUDED)[number], unknown>;
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
  const contact = getPathname({ href: "/contact", locale });
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
        <div className="grid gap-6 lg:grid-cols-2" data-testid="pricing-model">
          <Card padding="none" className="flex flex-col p-6 md:p-8">
            <h3 className="text-muted m-0 text-sm font-semibold">{t("free.title")}</h3>
            <p className="text-display text-primary m-0 mt-2">{t("free.price")}</p>
            <p className="text-muted m-0 mt-2 text-lg">{t("free.summary")}</p>
            <ul className="m-0 mt-6 flex flex-1 list-none flex-col gap-3 p-0">
              {FREE_ITEMS.map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <Icon icon={IconCheckCircle} className="text-primary mt-1 shrink-0" />
                  {t(`free.items.${key}`)}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" block className="mt-8" iconStart={line ? IconChat : undefined}>
              <a href={start} {...external}>
                {t("free.cta")}
              </a>
            </Button>
          </Card>
          <Card padding="none" className="flex flex-col p-6 md:p-8" data-testid="pricing-fee">
            <h3 className="m-0 text-xl">{t("fee.title")}</h3>
            <p className="text-muted m-0 mt-2">{t("fee.lede")}</p>
            {/* The two ways a payment is confirmed, side by side; the rate is a platform setting the API does not
                publish yet (docs/contract-requests.md), so the column says how to get it — never a number. */}
            <table className="mt-6 w-full text-base" data-testid="pricing-fee-table">
              <caption className="sr-only">{t("fee.title")}</caption>
              <thead>
                <tr className="border-border text-muted border-b text-sm">
                  <th scope="col" className="py-2 pe-4 text-start font-medium">
                    {t("fee.col.method")}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t("fee.col.rate")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEE_ROWS.map((key) => (
                  <tr key={key} className="border-border border-b">
                    <th scope="row" className="py-3 pe-4 text-start align-top font-normal">
                      <span className="block font-medium">{t(`fee.rows.${key}.method`)}</span>
                      <span className="text-muted text-sm">{t(`fee.rows.${key}.when`)}</span>
                    </th>
                    <td className="text-muted py-3 text-end align-top text-sm sm:whitespace-nowrap">
                      {t("fee.rateAsk")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="text-muted m-0 mt-5 flex flex-1 list-none flex-col gap-2 p-0 text-sm">
              {FEE_NOTES.map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <Icon icon={IconInfo} className="text-subtle mt-0.5 shrink-0" />
                  {t(`fee.items.${key}`)}
                </li>
              ))}
            </ul>
            <Button
              asChild
              size="lg"
              variant="secondary"
              block
              className="mt-8"
              iconStart={line ? IconChat : undefined}
            >
              <a href={line ?? contact} {...external}>
                {t("fee.ask")}
              </a>
            </Button>
          </Card>
        </div>
        <ul
          className="border-border bg-surface rounded-card shadow-card m-0 mt-6 grid list-none gap-x-6 gap-y-4 border p-5 sm:grid-cols-2 md:p-6 lg:grid-cols-4"
          aria-label={t("included.title")}
          data-testid="pricing-included"
        >
          {INCLUDED.map((key) => (
            <li key={key} className="flex items-center gap-3 font-medium">
              <span
                aria-hidden="true"
                className="bg-primary-subtle text-primary-subtle-fg rounded-control grid size-10 shrink-0 place-items-center"
              >
                <Icon icon={INCLUDED_ICON[key]} className="text-lg" />
              </span>
              {t(`included.items.${key}`)}
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="subtle" labelledBy="line-h">
        <SectionHead id="line-h" title={t("line.title")} />
        <ul className="m-0 mt-10 grid list-none gap-6 p-0 md:grid-cols-2" data-testid="pricing-line">
          {(["own", "shared"] as const).map((key) => (
            <li key={key}>
              <Card padding="none" className="flex h-full flex-col gap-3 p-6 md:p-8">
                <span
                  aria-hidden="true"
                  className="bg-bg-subtle text-fg rounded-control grid size-11 place-items-center"
                >
                  <Icon icon={key === "own" ? IconChat : IconMegaphone} className="text-xl" />
                </span>
                <h3 className="m-0 mt-1 text-xl">{t(`line.${key}.title`)}</h3>
                <p className="text-muted m-0">{t(`line.${key}.body`)}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {addons.length > 0 ? (
        <Section labelledBy="addons-h">
          <SectionHead id="addons-h" title={t("addons.title")} lede={t("addons.body")} />
          {/* One row per add-on with its price at the right edge: scales past three items, one call to action. */}
          <div className="border-border bg-surface rounded-card shadow-card mt-10 border" data-testid="pricing-plans">
            <table className="w-full text-base">
              <caption className="sr-only">{t("addons.title")}</caption>
              <thead className="max-sm:sr-only">
                <tr className="border-border text-muted border-b text-sm">
                  <th scope="col" className="px-5 py-3 text-start font-medium md:px-6">
                    {t("addons.col.item")}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-medium md:px-6">
                    {t("addons.col.price")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {addons.map((plan) => (
                  <tr key={plan.key} className="border-border border-b last:border-b-0" data-testid="pricing-addon">
                    <th scope="row" className="px-5 py-4 text-start align-top font-normal md:px-6">
                      <span className="block font-semibold">{plan.name}</span>
                      <span className="text-muted mt-1 block text-sm">{plan.summary}</span>
                      {plan.features.length ? (
                        <span className="text-muted mt-1 block text-sm">
                          {plan.features.map((feature) => t(MODULE_KEY[feature])).join(" · ")}
                        </span>
                      ) : null}
                    </th>
                    <td className="px-5 py-4 text-end align-top md:px-6">
                      <span className="block font-semibold tabular-nums sm:whitespace-nowrap">
                        {priceLabel(plan, locale, t)}
                      </span>
                      {plan.status === "proposed" ? (
                        <span className="text-muted block text-sm">{t("indicative")}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            {vatExcluded ? <p className="text-muted m-0 text-sm">{t("vat")}</p> : <span />}
            <Button asChild variant="secondary" iconStart={line ? IconChat : undefined}>
              <a href={line ?? contact} {...external}>
                {t("contactLine")}
              </a>
            </Button>
          </div>
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
