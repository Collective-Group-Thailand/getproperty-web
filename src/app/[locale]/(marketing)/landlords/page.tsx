import { getTranslations, setRequestLocale } from "next-intl/server";

import { LandlordPreview } from "@/features/owner/marketing/LandlordPreview";
import { Photo } from "@/features/owner/marketing/Photo";
import { PHOTOS } from "@/features/owner/marketing/photos";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { lineOaHref, marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, faqSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.landlords.meta");
  return marketingMetadata("/landlords", locale, { title: t("title"), description: t("description") });
}

const PAINS = ["chase", "slip", "contract", "deposit", "tax", "foreign"] as const;
/** The tenancy from listing to tax. Nothing is marked `soon`: everything shown ships (founder 2026-10-24, D-252/D-253/D-263). */
const JOURNEY: { key: string; soon?: boolean }[] = [
  { key: "list" },
  { key: "lease" },
  { key: "rent" },
  { key: "receipt" },
  { key: "repair" },
  { key: "moveout" },
  { key: "tax" },
];
const TABLE_ROWS = ["cost", "rent", "proof", "contract", "control"] as const;
const FOREIGN = ["contract", "tm30", "language"] as const;
const FAQ_KEYS = ["person", "one", "tenant", "agent", "existing"] as const;

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
 * The landlords' page (D-150 `landlord`, D-251–D-253; editorial redesign 2026-10-24): owners of houses and condos who
 * rent them out and today find tenants and collect rent by themselves. No price or fee number is typed here.
 */
export default async function Landlords({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.landlords");
  const shared = await getTranslations("owner.marketing");
  const line = lineOaHref();
  const start = line ?? ownerHref("/login", locale);
  const external = line ? { rel: "noopener noreferrer", target: "_blank" } : {};
  const pricing = getPathname({ href: "/pricing", locale });

  const origin = marketingOrigin();
  return (
    <>
      <JsonLdScript
        graphs={[
          breadcrumbSchema([
            { name: shared("nav.home"), url: `${origin}${getPathname({ href: "/", locale })}` },
            { name: shared("nav.owners") },
          ]),
          faqSchema(FAQ_KEYS.map((key) => ({ question: t(`faq.items.${key}.q`), answer: t(`faq.items.${key}.a`) }))),
        ]}
      />
      <section className="mx-auto grid max-w-7xl items-end gap-10 px-4 pt-10 pb-16 md:pt-16 lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col gap-7 lg:col-span-6 lg:pb-10" data-testid="landlords-hero">
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
            {(["free", "anywhere", "foreign"] as const).map((key) => (
              <li key={key}>· {t(`hero.points.${key}`)}</li>
            ))}
          </ul>
        </div>
        <figure className="relative m-0 lg:col-span-6">
          <Photo
            photo={PHOTOS.bedroom}
            priority
            className="rounded-photo aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5]"
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
          <div className="relative -mt-40 px-3 sm:absolute sm:start-6 sm:bottom-6 sm:mt-0 sm:w-[22rem] sm:px-0 xl:-start-20">
            <LandlordPreview locale={locale} />
          </div>
          <figcaption className="text-muted mt-3 text-end text-xs">{shared("hero.caption")}</figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:py-28">
        <RunningHead index="01" label={t("pains.eyebrow")} />
        <h2 className="mt-6 max-w-3xl text-4xl">{t("pains.title")}</h2>
        <ol className="border-border m-0 mt-12 grid list-none border-t p-0 md:grid-cols-2 md:gap-x-16">
          {PAINS.map((key, index) => (
            <li key={key} className="border-border flex gap-5 border-b py-6">
              <span className="font-display text-muted text-3xl leading-none">{index + 1}</span>
              <span className="text-lg leading-relaxed">{t(`pains.items.${key}`)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-fg text-fg-inverse">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
          <RunningHead index="02" label={t("journey.eyebrow")} invert />
          <h2 className="mt-6 max-w-3xl text-4xl">{t("journey.title")}</h2>
          <ol className="m-0 mt-14 grid list-none gap-x-10 gap-y-12 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((step, index) => (
              <li key={step.key} className="flex flex-col gap-3">
                <span className="flex items-center gap-3">
                  <span className="font-display text-4xl leading-none opacity-40">{index + 1}</span>
                  {step.soon ? (
                    <span className="rounded-full border border-current px-2 py-0.5 text-xs opacity-80">
                      {t("journey.soon")}
                    </span>
                  ) : null}
                </span>
                <h3 className="text-xl font-semibold">{t(`journey.items.${step.key}.title`)}</h3>
                <p className="leading-relaxed opacity-80">{t(`journey.items.${step.key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:py-28">
        <RunningHead index="03" label={t("table.eyebrow")} />
        <h2 className="mt-6 max-w-3xl text-4xl">{t("table.title")}</h2>
        <div className="relative mt-10 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-start">
            <caption className="sr-only">{t("table.caption")}</caption>
            <thead>
              <tr className="border-fg border-b-2 text-sm">
                {(["topic", "self", "agent", "us"] as const).map((col) => (
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
                  <td className="text-muted py-4 pe-4">{t(`table.rows.${row}.self`)}</td>
                  <td className="text-muted py-4 pe-4">{t(`table.rows.${row}.agent`)}</td>
                  <td className="py-4 font-semibold">{t(`table.rows.${row}.us`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-surface-subtle">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 md:py-28 lg:grid-cols-12">
          <figure className="m-0 lg:col-span-6">
            <Photo
              photo={PHOTOS.skyline}
              className="rounded-photo aspect-[4/3]"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <figcaption className="text-muted mt-3 text-xs">{t("foreign.photoCaption")}</figcaption>
          </figure>
          <div className="flex flex-col gap-6 lg:col-span-6">
            <RunningHead index="04" label={t("foreign.eyebrow")} />
            <h2 className="text-4xl">{t("foreign.title")}</h2>
            <ul className="border-border m-0 list-none border-t p-0">
              {FOREIGN.map((key) => (
                <li key={key} className="border-border flex flex-col gap-1 border-b py-5">
                  <span className="text-lg font-semibold">{t(`foreign.items.${key}.title`)}</span>
                  <span className="text-muted leading-relaxed">{t(`foreign.items.${key}.body`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:py-28">
        <div className="border-fg flex flex-col gap-6 border-y-2 py-12 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 className="text-4xl">{t("price.title")}</h2>
            <p className="text-muted text-lg leading-relaxed">{t("price.body")}</p>
          </div>
          <a
            className="text-primary shrink-0 font-semibold underline decoration-1 underline-offset-[6px]"
            href={pricing}
          >
            {t("price.cta")} →
          </a>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 md:pb-28 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-4">
          <RunningHead index="05" label={t("faq.eyebrow")} />
          <h2 className="text-4xl">{t("faq.title")}</h2>
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

      <section className="mx-auto max-w-7xl px-4 pb-20 md:pb-28">
        <div className="rounded-photo relative isolate overflow-hidden">
          <Photo photo={PHOTOS.keys} decorative className="absolute inset-0 -z-10" sizes="100vw" />
          <div className="bg-fg/70 absolute inset-0 -z-10" aria-hidden="true" />
          <div className="text-fg-inverse flex min-h-[24rem] flex-col justify-end gap-6 p-8 md:p-14">
            <h2 className="text-display max-w-2xl">{t("cta.title")}</h2>
            <p className="max-w-xl text-lg opacity-90">{t("cta.body")}</p>
            <Button asChild size="lg" variant="secondary" className="self-start">
              <a href={start} {...external}>
                {line ? t("cta.primary") : t("hero.signIn")}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
