import { getTranslations, setRequestLocale } from "next-intl/server";

import { Photo } from "@/features/owner/marketing/Photo";
import { PHOTOS } from "@/features/owner/marketing/photos";
import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import {
  CtaPanel,
  FaqList,
  Fold,
  PageHead,
  Section,
  SectionHead,
  Steps,
  TextLink,
} from "@/features/owner/marketing/Layout";
import { lineOaHref, marketingMetadata, marketingOrigin, ownerHref } from "@/features/owner/marketing/seo";
import { breadcrumbSchema, faqSchema } from "@/features/owner/marketing/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconCheck } from "@/ui/icons/glyphs/check";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.landlords.meta");
  return marketingMetadata("/landlords", locale, { title: t("title"), description: t("description") });
}

const PAINS = ["chase", "slip", "contract", "deposit", "tax", "foreign"] as const;
/** The tenancy from listing to tax — only what ships (an unfinished step is left out, never badged). */
const JOURNEY = ["list", "lease", "rent", "receipt", "repair", "moveout", "tax"] as const;
const TABLE_ROWS = ["cost", "rent", "proof", "contract", "control"] as const;
const FOREIGN = ["contract", "tm30", "language"] as const;
const FAQ_KEYS = ["person", "one", "tenant", "agent", "existing"] as const;

/**
 * The landlords' page (D-150 `landlord`, D-251–D-253; G1 redesign 2026-11-03): owners of houses and condos who rent
 * them out themselves. One job — sign up free: the hero with the action beside a photograph (no sample portfolio with
 * made-up rents), the problems, the tenancy in seven steps, foreign tenants, the price in one line, the questions, and
 * the comparison folded. No price or fee number is typed here.
 */
export default async function Landlords({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.landlords");
  const shared = await getTranslations("owner.marketing");
  // Owners sign themselves up now (B7.1, D-251); the LINE OA stays the place to ask a question.
  const line = lineOaHref();
  const start = ownerHref("/signup", locale);
  const pricing = getPathname({ href: "/pricing", locale });

  const origin = marketingOrigin();
  const faq = FAQ_KEYS.map((key) => ({ q: t(`faq.items.${key}.q`), a: t(`faq.items.${key}.a`) }));
  return (
    <>
      <JsonLdScript
        graphs={[
          breadcrumbSchema([
            { name: shared("nav.home"), url: `${origin}${getPathname({ href: "/", locale })}` },
            { name: shared("nav.owners") },
          ]),
          faqSchema(faq.map((item) => ({ question: item.q, answer: item.a }))),
        ]}
      />
      <PageHead
        testId="landlords-hero"
        eyebrow={t("hero.kicker")}
        title={t.rich("hero.title", { hl: (chunks) => <span className="text-primary block">{chunks}</span> })}
        lede={t("hero.lede")}
        actions={
          <>
            <Button asChild size="lg">
              <a href={start} data-testid="landlords-signup">
                {t("hero.signUp")}
              </a>
            </Button>
            <TextLink href={pricing}>{t("hero.secondary")}</TextLink>
          </>
        }
        aside={
          <Photo
            photo={PHOTOS.bedroom}
            priority
            className="rounded-panel aspect-[4/3] lg:aspect-[5/6]"
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
        }
      >
        <ul className="text-muted m-0 mt-2 flex list-none flex-col gap-2 p-0 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
          {(["free", "anywhere", "foreign"] as const).map((key) => (
            <li key={key} className="flex items-center gap-2">
              <Icon icon={IconCheck} className="text-primary shrink-0" />
              {t(`hero.points.${key}`)}
            </li>
          ))}
        </ul>
      </PageHead>

      <Section labelledBy="pains-h" innerClassName="pt-8 md:pt-12">
        <SectionHead id="pains-h" eyebrow={t("pains.eyebrow")} title={t("pains.title")} />
        <ol className="border-border m-0 mt-10 grid list-none border-t p-0 md:grid-cols-2 md:gap-x-16">
          {PAINS.map((key, index) => (
            <li key={key} className="border-border flex gap-5 border-b py-5">
              <span className="text-muted w-6 shrink-0 font-mono text-sm tabular-nums">{index + 1}</span>
              <span className="text-lg">{t(`pains.items.${key}`)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="subtle" labelledBy="journey-h">
        <SectionHead id="journey-h" eyebrow={t("journey.eyebrow")} title={t("journey.title")} />
        <Steps
          className="mt-12"
          items={JOURNEY.map((key) => ({
            key,
            title: t(`journey.items.${key}.title`),
            body: t(`journey.items.${key}.body`),
          }))}
        />
      </Section>

      <Section labelledBy="foreign-h">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
          <Photo
            photo={PHOTOS.skyline}
            className="rounded-panel aspect-[4/3] lg:col-span-6"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div className="flex flex-col gap-6 lg:col-span-6 lg:ps-8">
            <SectionHead id="foreign-h" eyebrow={t("foreign.eyebrow")} title={t("foreign.title")} />
            <ul className="border-border m-0 list-none border-t p-0">
              {FOREIGN.map((key) => (
                <li key={key} className="border-border flex flex-col gap-1 border-b py-5">
                  <span className="text-lg font-semibold">{t(`foreign.items.${key}.title`)}</span>
                  <span className="text-muted">{t(`foreign.items.${key}.body`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section labelledBy="price-h" innerClassName="pt-0 md:pt-0">
        <div className="bg-surface border-border rounded-card shadow-card flex flex-col gap-4 border p-6 md:flex-row md:items-center md:justify-between md:gap-10 md:p-8">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 id="price-h" className="m-0 text-2xl">
              {t("price.title")}
            </h2>
            <p className="text-muted m-0">{t("price.body")}</p>
          </div>
          <TextLink href={pricing} className="shrink-0">
            {t("price.cta")}
          </TextLink>
        </div>
      </Section>

      <Section labelledBy="faq-h" innerClassName="pt-0 md:pt-0">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <p className="text-muted m-0 text-sm font-medium">{t("faq.eyebrow")}</p>
            <h2 id="faq-h" className="m-0 text-3xl">
              {t("faq.title")}
            </h2>
          </div>
          <FaqList className="lg:col-span-8" items={faq} openFirst />
        </div>
        <Fold
          id="table-h"
          className="mt-16"
          title={t("table.title")}
          hint={t("table.eyebrow")}
          action={<TextLink href={pricing}>{t("price.cta")}</TextLink>}
        >
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-start">
              <caption className="sr-only">{t("table.caption")}</caption>
              <thead>
                <tr className="border-border-strong border-b text-sm">
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
        </Fold>
      </Section>

      <CtaPanel
        id="cta-h"
        className="pt-0 md:pt-0"
        title={t("cta.title")}
        body={t("cta.body")}
        primary={{ href: start, label: t("hero.signUp") }}
        secondary={line ? { href: line, label: t("cta.ask"), external: true } : undefined}
      />
    </>
  );
}
