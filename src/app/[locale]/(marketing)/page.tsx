import { getTranslations, setRequestLocale } from "next-intl/server";

import { Photo } from "@/features/owner/marketing/Photo";
import { PHOTOS } from "@/features/owner/marketing/photos";
import { ProductPreview } from "@/features/owner/marketing/ProductPreview";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { lineOaHref, marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import {
  faqSchema,
  organizationSchema,
  softwareSchema,
  websiteSchema,
} from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";

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
/** The three differentiators get a row each with a photo; the rest are a quiet list (no icon tiles). */
const LEAD_FEATURES = [
  { key: "service", photo: PHOTOS.kitchen },
  { key: "meters", photo: PHOTOS.tower },
  { key: "line", photo: PHOTOS.livingGreen },
] as const;
const MORE_FEATURES: { key: string; soon?: boolean }[] = [
  { key: "bank" },
  { key: "lease" },
  { key: "tm30" },
  { key: "portfolio" },
  { key: "rateGuard" },
];
const TABLE_ROWS = ["cost", "read", "pay", "app", "docs", "grow"] as const;
const FAQ_KEYS = ["what", "meters", "money", "residents", "import", "data"] as const;
const SERVICE_STEPS = ["1", "2", "3", "4"] as const;

/** A section's running head: a number, a hairline and a short label, like a magazine's. */
function RunningHead({ index, label, invert }: { index: string; label: string; invert?: boolean }) {
  return (
    <p className={`flex items-center gap-4 text-sm ${invert ? "opacity-80" : "text-muted"}`}>
      <span className="font-mono">{index}</span>
      <span aria-hidden="true" className={`h-px w-10 ${invert ? "bg-current" : "bg-border-strong"}`} />
      <span className="font-medium">{label}</span>
    </p>
  );
}

/**
 * The landing page (editorial redesign 2026-10-24, after a study of rental-property sites): photography first,
 * a serif headline voice, running heads and hairlines instead of icon tiles and gradients. Prices and rates are
 * never typed here (CLAUDE.md).
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
  const external = line ? { rel: "noopener noreferrer", target: "_blank" } : {};

  return (
    <>
      <JsonLdScript
        graphs={[
          organizationSchema(origin, t("meta.description")),
          websiteSchema(origin, getPathname({ href: "/rent", locale }), locale === "th" ? "th-TH" : "en"),
          softwareSchema(origin, t("meta.description"), `${origin}${getPathname({ href: "/", locale })}`),
          faqSchema(FAQ_KEYS.map((key) => ({ question: t(`faq.items.${key}.q`), answer: t(`faq.items.${key}.a`) }))),
        ]}
      />

      {/* Hero: words on the left, a real room on the right with this morning's queue laid over it */}
      <section className="mx-auto grid max-w-7xl items-end gap-10 px-4 pt-10 pb-16 md:pt-16 lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col gap-7 lg:col-span-6 lg:pb-10" data-testid="marketing-hero">
          <p className="text-muted flex items-center gap-3 text-sm font-medium">
            <span aria-hidden="true" className="bg-primary h-px w-8" />
            {t("hero.kicker")}
          </p>
          <h1 className="text-display font-semibold tracking-tight">
            {t.rich("hero.title", { hl: (chunks) => <em className="text-primary block not-italic">{chunks}</em> })}
          </h1>
          <p className="text-muted max-w-lg text-lg leading-relaxed">{t("hero.body")}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild size="lg" iconStart={line ? IconChat : undefined}>
              <a href={start} {...external}>
                {line ? t("hero.primary") : t("hero.signIn")}
              </a>
            </Button>
            <a
              className="font-semibold underline decoration-1 underline-offset-[6px] hover:decoration-2"
              href={pricing}
            >
              {t("hero.secondary")}
            </a>
          </div>
          <ul className="text-muted flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {(["free", "noApp", "checked"] as const).map((key) => (
              <li key={key}>· {t(`hero.points.${key}`)}</li>
            ))}
          </ul>
        </div>
        <figure className="relative m-0 lg:col-span-6">
          <Photo
            photo={PHOTOS.living}
            priority
            className="rounded-photo aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5]"
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
          <div className="relative -mt-40 px-3 sm:absolute sm:start-6 sm:bottom-6 sm:mt-0 sm:w-[24rem] sm:px-0 xl:-start-20">
            <ProductPreview locale={locale} />
          </div>
          <figcaption className="text-muted mt-3 text-end text-xs">{t("hero.caption")}</figcaption>
        </figure>
      </section>

      {/* Two doors */}
      <section className="mx-auto max-w-7xl px-4" aria-label={t("audience.label")}>
        <ul className="border-border grid border-y md:grid-cols-2">
          {(
            [
              ["apartment", "#how", PHOTOS.tower],
              ["landlord", landlords, PHOTOS.townhouse],
            ] as const
          ).map(([key, href, photo], index) => (
            <li key={key} className={index === 0 ? "border-border md:border-e" : ""}>
              <a href={href} className="group flex items-center gap-5 py-6 md:px-6">
                <Photo photo={photo} decorative className="rounded-card size-20 shrink-0" sizes="80px" />
                <span className="min-w-0 flex-1">
                  <span className="font-display block text-xl font-semibold">{t(`audience.${key}.title`)}</span>
                  <span className="text-muted block">{t(`audience.${key}.body`)}</span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-primary text-2xl transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
        <ul className="text-muted flex flex-wrap gap-x-8 gap-y-2 py-5 text-sm" aria-label={t("trust.label")}>
          {TRUST.map((key) => (
            <li key={key}>{t(`trust.items.${key}`)}</li>
          ))}
        </ul>
      </section>

      {/* 01 — month end, before and after */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:py-28">
        <RunningHead index="01" label={t("compare.eyebrow")} />
        <h2 className="mt-6 max-w-3xl text-4xl">{t("compare.title")}</h2>
        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <h3 className="text-muted border-border border-b pb-3 text-sm font-semibold">{t("compare.before")}</h3>
            <ol className="m-0 list-none p-0">
              {LIST_KEYS.map((key) => (
                <li key={key} className="border-border text-muted flex gap-4 border-b py-4">
                  <span className="font-mono text-sm">{key}</span>
                  <span className="decoration-border-strong line-through decoration-1">
                    {t(`compare.beforeItems.${key}`)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-primary border-primary border-b pb-3 text-sm font-semibold">{t("compare.after")}</h3>
            <ol className="m-0 list-none p-0">
              {LIST_KEYS.map((key) => (
                <li key={key} className="border-border flex gap-4 border-b py-4">
                  <span className="text-primary font-mono text-sm">{key}</span>
                  <span className="font-medium">{t(`compare.afterItems.${key}`)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 02 — how it works, on ink */}
      <section id="how" className="bg-fg text-fg-inverse scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
          <RunningHead index="02" label={t("steps.eyebrow")} invert />
          <h2 className="mt-6 max-w-3xl text-4xl">{t("steps.title")}</h2>
          <ol className="m-0 mt-14 grid list-none gap-10 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEP_KEYS.map((key, index) => (
              <li key={key} className="flex flex-col gap-3">
                <span className="font-display text-display leading-none opacity-40">{index + 1}</span>
                <h3 className="text-xl font-semibold">{t(`steps.items.${key}.title`)}</h3>
                <p className="leading-relaxed opacity-80">{t(`steps.items.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 03 — what makes it different: alternating rows with photographs */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 md:py-28">
        <RunningHead index="03" label={t("features.eyebrow")} />
        <h2 className="mt-6 max-w-3xl text-4xl">{t("features.title")}</h2>
        <div className="mt-14 flex flex-col gap-16 md:gap-24">
          {LEAD_FEATURES.map(({ key, photo }, index) => (
            <article key={key} className="grid items-center gap-8 md:grid-cols-12 md:gap-12">
              <Photo
                photo={photo}
                className={`rounded-photo aspect-[3/2] md:col-span-7 ${index % 2 ? "md:order-2" : ""}`}
                sizes="(min-width: 768px) 55vw, 100vw"
              />
              <div className={`flex flex-col gap-4 md:col-span-5 ${index % 2 ? "md:order-1" : ""}`}>
                <span className="text-primary font-mono text-sm">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-2xl">{t(`features.items.${key}.title`)}</h3>
                <p className="text-muted text-lg leading-relaxed">{t(`features.items.${key}.body`)}</p>
              </div>
            </article>
          ))}
        </div>
        <h3 className="text-muted mt-20 text-sm font-semibold">{t("features.more")}</h3>
        <ul className="border-border m-0 mt-4 grid list-none border-t p-0 md:grid-cols-2 md:gap-x-16">
          {MORE_FEATURES.map((feature) => (
            <li key={feature.key} className="border-border flex flex-col gap-1 border-b py-5">
              <span className="flex items-center gap-2 text-lg font-semibold">
                {t(`features.items.${feature.key}.title`)}
                {feature.soon ? <Badge size="sm">{t("features.soon")}</Badge> : null}
              </span>
              <span className="text-muted leading-relaxed">{t(`features.items.${feature.key}.body`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 04 — the lawful rate: a pull quote and the live ceiling from the API */}
      <section id="service" className="bg-surface-subtle scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
          <RunningHead index="04" label={t("service.eyebrow")} />
          <h2 className="mt-6 max-w-3xl text-4xl">{t("service.title")}</h2>
          <p className="text-muted mt-4 max-w-2xl text-lg">{t("service.body")}</p>
          <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
            {(["dorm", "owner"] as const).map((audience) => (
              <div key={audience}>
                <h3 className="border-fg border-b-2 pb-3 text-xl">{t(`service.${audience}.title`)}</h3>
                <ol className="m-0 list-none p-0">
                  {SERVICE_STEPS.map((step) => (
                    <li key={step} className="border-border flex gap-4 border-b py-4">
                      <span className="text-primary font-mono text-sm">{step}</span>
                      <span>{t(`service.${audience}.items.${step}`)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 — who it is for: photo cards */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:py-28">
        <RunningHead index="05" label={t("segments.eyebrow")} />
        <h2 className="mt-6 max-w-3xl text-4xl">{t("segments.title")}</h2>
        <ul className="m-0 mt-12 grid list-none gap-8 p-0 md:grid-cols-3">
          {(
            [
              ["landlord", landlords, PHOTOS.bedroom, false],
              ["apartment", pricing, PHOTOS.skyline, false],
              ["juristic", start, PHOTOS.tower, true],
            ] as const
          ).map(([key, href, photo, soon]) => (
            <li key={key}>
              <a href={href} className="group flex h-full flex-col gap-4" {...(href === line ? external : {})}>
                <Photo
                  photo={photo}
                  decorative
                  className="rounded-photo aspect-[4/3]"
                  sizes="(min-width: 768px) 33vw, 100vw"
                />
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl font-semibold">{t(`segments.items.${key}.title`)}</span>
                  {soon ? <Badge size="sm">{t("features.soon")}</Badge> : null}
                </span>
                <span className="text-muted text-sm">{t(`segments.items.${key}.size`)}</span>
                <span className="leading-relaxed">{t(`segments.items.${key}.body`)}</span>
                <span className="text-primary mt-auto font-semibold group-hover:underline">
                  {t(`segments.items.${key}.cta`)} →
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* 06 — side by side */}
      <section className="mx-auto max-w-7xl px-4 pb-20 md:pb-28">
        <RunningHead index="06" label={t("table.eyebrow")} />
        <h2 className="mt-6 max-w-3xl text-4xl">{t("table.title")}</h2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-start">
            <caption className="sr-only">{t("table.caption")}</caption>
            <thead>
              <tr className="border-fg border-b-2 text-sm">
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
      </section>

      {/* Coming: homes from real owners */}
      <section className="bg-surface-subtle">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 md:py-24 lg:grid-cols-12">
          <div className="grid grid-cols-3 gap-3 lg:col-span-7">
            <Photo
              photo={PHOTOS.bedroomWarm}
              decorative
              className="rounded-photo col-span-2 row-span-2 aspect-square"
              sizes="40vw"
            />
            <Photo photo={PHOTOS.kitchen} decorative className="rounded-photo aspect-square" sizes="20vw" />
            <Photo photo={PHOTOS.livingGreen} decorative className="rounded-photo aspect-square" sizes="20vw" />
          </div>
          <div className="flex flex-col gap-5 lg:col-span-5">
            <Badge tone="primary" className="self-start">
              {t("rent.eyebrow")}
            </Badge>
            <h2 className="text-4xl">{t("rent.title")}</h2>
            <p className="text-muted text-lg leading-relaxed">{t("rent.body")}</p>
            <Button asChild variant="secondary" className="self-start">
              <a href={getPathname({ href: "/rent", locale })}>{t("rent.cta")}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* 07 — questions */}
      <section id="faq" className="mx-auto grid max-w-7xl scroll-mt-20 gap-10 px-4 py-20 md:py-28 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-4">
          <RunningHead index="07" label={t("faq.eyebrow")} />
          <h2 className="text-4xl">{t("faq.title")}</h2>
          {line ? (
            <a className="text-primary font-semibold underline-offset-4 hover:underline" href={line} {...external}>
              {t("faq.more")}
            </a>
          ) : null}
        </div>
        <div className="border-fg border-t-2 lg:col-span-8">
          {FAQ_KEYS.map((key, index) => (
            <details key={key} className="group border-border border-b py-6" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {t(`faq.items.${key}.q`)}
                <Icon
                  icon={IconChevronDown}
                  className="text-primary mt-1 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="text-muted mt-3 max-w-2xl leading-relaxed">{t(`faq.items.${key}.a`)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing: the handover */}
      <section className="mx-auto max-w-7xl px-4 pb-20 md:pb-28">
        <div className="rounded-photo relative isolate overflow-hidden">
          <Photo photo={PHOTOS.keys} decorative className="absolute inset-0 -z-10" sizes="100vw" />
          <div className="bg-fg/70 absolute inset-0 -z-10" aria-hidden="true" />
          <div className="text-fg-inverse flex min-h-[26rem] flex-col justify-end gap-6 p-8 md:p-14">
            <h2 className="text-display max-w-2xl">{t("cta.title")}</h2>
            <p className="max-w-xl text-lg opacity-90">{t("cta.body")}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button asChild size="lg" variant="secondary">
                <a href={start} {...external}>
                  {line ? t("cta.primary") : t("hero.signIn")}
                </a>
              </Button>
              <a className="font-semibold underline decoration-1 underline-offset-[6px]" href={pricing}>
                {t("cta.secondary")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
