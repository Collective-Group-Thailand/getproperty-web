import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import {
  CtaPanel,
  FaqList,
  FeatureList,
  Fold,
  Section,
  SectionHead,
  Steps,
  TextLink,
  WRAP,
} from "@/features/owner/marketing/Layout";
import { Photo } from "@/features/owner/marketing/Photo";
import { PHOTOS } from "@/features/owner/marketing/photos";
import { lineOaHref, marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import {
  faqSchema,
  organizationSchema,
  softwareSchema,
  websiteSchema,
} from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.meta");
  return marketingMetadata("/", locale, { title: t("title"), description: t("description") });
}

const TRUST = ["line", "qr", "bank", "etax", "tm30", "pdpa"] as const;
const STEP_KEYS = ["read", "check", "send", "close"] as const;
const LIST_KEYS = ["1", "2", "3", "4", "5"] as const;
/** The three differentiators get a row each with a photo; the rest are a quiet list. */
const LEAD_FEATURES = [
  { key: "service", photo: PHOTOS.kitchen },
  { key: "meters", photo: PHOTOS.tower },
  { key: "line", photo: PHOTOS.livingGreen },
] as const;
const MORE_FEATURES = ["bank", "lease", "tm30", "portfolio", "rateGuard"] as const;
const TABLE_ROWS = ["cost", "read", "pay", "app", "docs", "grow"] as const;
const FAQ_KEYS = ["what", "meters", "residents", "import", "data"] as const;
const SERVICE_STEPS = ["1", "2", "3", "4"] as const;

/**
 * The landing page for apartments and dormitories (G1 redesign 2026-11-03). One job: start using getproperty. The
 * hero says what it does and offers the one action beside a calm photograph — no sample dashboard with made-up
 * figures. Then, in order: the month end before and after, the four steps, what sets it apart, repairs, homes for
 * rent, the questions, and the comparison table folded for the reader who wants it. Light surfaces only; prices and
 * rates are never typed here (CLAUDE.md).
 */
export default async function Landing({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing");
  const origin = marketingOrigin();
  const signIn = ownerHref("/login", locale);
  const line = lineOaHref();
  const pricing = getPathname({ href: "/pricing", locale });
  const landlords = getPathname({ href: "/landlords", locale });
  const start = line ?? signIn;
  const external = Boolean(line);
  const faq = FAQ_KEYS.map((key) => ({ q: t(`faq.items.${key}.q`), a: t(`faq.items.${key}.a`) }));

  return (
    <>
      <JsonLdScript
        graphs={[
          organizationSchema(origin, t("meta.description")),
          websiteSchema(origin, getPathname({ href: "/rent", locale }), locale === "th" ? "th-TH" : "en"),
          softwareSchema(origin, t("meta.description"), `${origin}${getPathname({ href: "/", locale })}`),
          faqSchema(faq.map((item) => ({ question: item.q, answer: item.a }))),
        ]}
      />

      {/* Hero: what it does and the one action, beside a photograph of a real room */}
      <section className={`${WRAP} grid gap-10 pt-10 pb-16 md:pt-14 lg:grid-cols-12 lg:gap-8 lg:pb-20`}>
        <div className="flex flex-col gap-6 lg:col-span-6 lg:self-center lg:pe-6" data-testid="marketing-hero">
          <p className="text-muted m-0 text-sm font-medium">{t("hero.kicker")}</p>
          <h1 className="text-display m-0 text-balance">
            {t.rich("hero.title", { hl: (chunks) => <span className="text-primary block">{chunks}</span> })}
          </h1>
          <p className="text-muted m-0 max-w-xl text-lg text-pretty">{t("hero.lede")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild size="lg" iconStart={line ? IconChat : undefined}>
              <a href={start} {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
                {line ? t("hero.primary") : t("hero.signIn")}
              </a>
            </Button>
            <TextLink href={pricing}>{t("hero.secondary")}</TextLink>
          </div>
          <ul className="text-muted m-0 mt-2 flex list-none flex-col gap-2 p-0 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
            {(["free", "noApp", "checked"] as const).map((key) => (
              <li key={key} className="flex items-center gap-2">
                <Icon icon={IconCheck} className="text-primary shrink-0" />
                {t(`hero.points.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-6">
          <Photo
            photo={PHOTOS.living}
            priority
            className="rounded-panel aspect-[4/3] lg:aspect-[5/6]"
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
        </div>
      </section>

      {/* Two doors: the dormitory operator stays, the house or condo owner goes to their page */}
      <nav aria-label={t("audience.label")} className={WRAP}>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {(
            [
              ["apartment", "#how", PHOTOS.tower],
              ["landlord", landlords, PHOTOS.townhouse],
            ] as const
          ).map(([key, href, photo]) => (
            <li key={key}>
              <a
                href={href}
                className="group bg-surface border-border rounded-card shadow-card hover:border-border-strong flex items-center gap-5 border p-4 transition-colors"
              >
                <Photo photo={photo} decorative className="rounded-thumb size-16 shrink-0" sizes="64px" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lg font-semibold">{t(`audience.${key}.title`)}</span>
                  <span className="text-muted">{t(`audience.${key}.body`)}</span>
                </span>
                <Icon
                  icon={IconChevronRight}
                  className="text-muted group-hover:text-primary shrink-0 text-xl transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </a>
            </li>
          ))}
        </ul>
        <ul
          className="text-muted m-0 flex list-none flex-wrap gap-x-8 gap-y-2 p-0 pt-6 text-sm"
          aria-label={t("trust.label")}
        >
          {TRUST.map((key) => (
            <li key={key}>{t(`trust.items.${key}`)}</li>
          ))}
        </ul>
      </nav>

      {/* The month end, before and after */}
      <Section labelledBy="compare-h">
        <SectionHead id="compare-h" eyebrow={t("compare.eyebrow")} title={t("compare.title")} />
        <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <h3 className="text-muted border-border m-0 border-b pb-3 text-sm font-semibold">{t("compare.before")}</h3>
            <ol className="m-0 list-none p-0">
              {LIST_KEYS.map((key) => (
                <li key={key} className="border-border text-muted flex gap-4 border-b py-4">
                  <span className="font-mono text-sm tabular-nums">{key}</span>
                  <span>{t(`compare.beforeItems.${key}`)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-primary border-primary m-0 border-b pb-3 text-sm font-semibold">
              {t("compare.after")}
            </h3>
            <ol className="m-0 list-none p-0">
              {LIST_KEYS.map((key) => (
                <li key={key} className="border-border flex gap-4 border-b py-4">
                  <span className="text-primary font-mono text-sm tabular-nums">{key}</span>
                  <span className="font-medium">{t(`compare.afterItems.${key}`)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* How it works: four steps on a quiet band */}
      <Section id="how" tone="subtle" labelledBy="how-h">
        <SectionHead id="how-h" eyebrow={t("steps.eyebrow")} title={t("steps.title")} />
        <Steps
          className="mt-12"
          items={STEP_KEYS.map((key) => ({
            key,
            title: t(`steps.items.${key}.title`),
            body: t(`steps.items.${key}.body`),
          }))}
        />
      </Section>

      {/* What sets it apart: three rows with photographs, then a quiet list */}
      <Section id="features" labelledBy="features-h">
        <SectionHead id="features-h" eyebrow={t("features.eyebrow")} title={t("features.title")} />
        <div className="mt-12 flex flex-col gap-16 md:gap-20">
          {LEAD_FEATURES.map(({ key, photo }, index) => (
            <article key={key} className="grid items-center gap-8 md:grid-cols-12 md:gap-12">
              <Photo
                photo={photo}
                className={`rounded-panel aspect-[3/2] md:col-span-7 ${index % 2 ? "md:order-2" : ""}`}
                sizes="(min-width: 768px) 55vw, 100vw"
              />
              <div className={`flex flex-col gap-3 md:col-span-5 ${index % 2 ? "md:order-1" : ""}`}>
                <span className="text-primary font-mono text-sm tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="m-0 text-xl">{t(`features.items.${key}.title`)}</h3>
                <p className="text-muted m-0 text-lg text-pretty">{t(`features.items.${key}.body`)}</p>
              </div>
            </article>
          ))}
        </div>
        <h3 className="text-muted mt-20 mb-0 text-sm font-semibold">{t("features.more")}</h3>
        <FeatureList
          className="mt-4"
          items={MORE_FEATURES.map((key) => ({
            key,
            title: t(`features.items.${key}.title`),
            body: t(`features.items.${key}.body`),
          }))}
        />
      </Section>

      {/* Repairs: the same four steps for a dormitory and for a rented home */}
      <Section id="service" tone="subtle" labelledBy="service-h">
        <SectionHead
          id="service-h"
          eyebrow={t("service.eyebrow")}
          title={t("service.title")}
          lede={t("service.body")}
        />
        <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-16">
          {(["dorm", "owner"] as const).map((audience) => (
            <div key={audience}>
              <h3 className="border-border m-0 border-b pb-3 text-xl">{t(`service.${audience}.title`)}</h3>
              <ol className="m-0 list-none p-0">
                {SERVICE_STEPS.map((step) => (
                  <li key={step} className="border-border flex gap-4 border-b py-4">
                    <span className="text-primary font-mono text-sm tabular-nums">{step}</span>
                    <span>{t(`service.${audience}.items.${step}`)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      {/* Homes for rent from the owners themselves */}
      <Section labelledBy="rent-h">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="grid grid-cols-3 grid-rows-2 gap-3 lg:col-span-7">
            <Photo
              photo={PHOTOS.bedroomWarm}
              decorative
              className="rounded-panel col-span-2 row-span-2 aspect-square"
              sizes="(min-width: 1024px) 38vw, 66vw"
            />
            <Photo photo={PHOTOS.kitchen} decorative className="rounded-panel h-full" sizes="20vw" />
            <Photo photo={PHOTOS.livingGreen} decorative className="rounded-panel h-full" sizes="20vw" />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5 lg:ps-8">
            <p className="text-muted m-0 text-sm font-medium">{t("rent.eyebrow")}</p>
            <h2 id="rent-h" className="m-0 text-3xl text-balance">
              {t("rent.title")}
            </h2>
            <p className="text-muted m-0 text-lg text-pretty">{t("rent.body")}</p>
            <Button asChild variant="secondary" size="lg" className="mt-2 self-start">
              <a href={getPathname({ href: "/rent", locale })}>{t("rent.cta")}</a>
            </Button>
          </div>
        </div>
      </Section>

      {/* Questions, then the side-by-side comparison folded for whoever wants it */}
      <Section id="faq" labelledBy="faq-h" innerClassName="pt-0 md:pt-0">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <p className="text-muted m-0 text-sm font-medium">{t("faq.eyebrow")}</p>
            <h2 id="faq-h" className="m-0 text-3xl">
              {t("faq.title")}
            </h2>
            {line ? (
              <TextLink href={line} external>
                {t("faq.more")}
              </TextLink>
            ) : null}
          </div>
          <FaqList className="lg:col-span-8" items={faq} openFirst />
        </div>
        <Fold
          id="table-h"
          className="mt-16"
          title={t("table.title")}
          hint={t("table.eyebrow")}
          action={<TextLink href={pricing}>{t("hero.secondary")}</TextLink>}
        >
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-start">
              <caption className="sr-only">{t("table.caption")}</caption>
              <thead>
                <tr className="border-border-strong border-b text-sm">
                  {(["topic", "manual", "typical", "us"] as const).map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className={`py-3 pe-4 text-start font-semibold ${col === "us" ? "text-primary" : "text-muted"}`}
                    >
                      {t(`table.cols.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row) => (
                  <tr key={row} className="border-border border-b">
                    <th scope="row" className="py-4 pe-4 text-start font-medium">
                      {t(`table.rows.${row}.topic`)}
                    </th>
                    <td className="text-muted py-4 pe-4">{t(`table.rows.${row}.manual`)}</td>
                    <td className="text-muted py-4 pe-4">{t(`table.rows.${row}.typical`)}</td>
                    <td className="py-4 font-semibold">{t(`table.rows.${row}.us`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Fold>
      </Section>

      <CtaPanel
        id="cta-h"
        className="pt-0 md:pt-0"
        title={t("cta.title")}
        body={t("cta.body")}
        primary={{
          href: start,
          label: line ? t("cta.primary") : t("hero.signIn"),
          external,
          icon: line ? IconChat : undefined,
        }}
        secondary={{ href: pricing, label: t("cta.secondary") }}
      />
    </>
  );
}
