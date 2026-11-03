import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { marketingMetadata } from "@/features/owner/marketing/seo";
import { WRAP } from "@/features/owner/marketing/Layout";
import { formatDate } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const DOCS = ["terms", "privacy", "pdpa", "dpa"] as const;
type Doc = (typeof DOCS)[number];
/** Version date of the legal copy in src/i18n (changes with the copy). */
const UPDATED = "2026-10-17";

type Params = { params: Promise<{ locale: Locale; doc: string }> };

function isDoc(value: string): value is Doc {
  return (DOCS as readonly string[]).includes(value);
}

export async function generateMetadata({ params }: Params) {
  const { locale, doc } = await params;
  if (!isDoc(doc)) return {};
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing");
  return marketingMetadata(`/legal/${doc}`, locale, {
    title: `${t(`legal.docs.${doc}.title`)} · getproperty`,
    description: t(`legal.docs.${doc}.sections.0.body` as never),
  });
}

/** Terms, privacy policy, PDPA notice and DPA — copy from src/i18n (owner/marketing.json). */
export default async function LegalPage({ params }: Params) {
  const { locale, doc } = await params;
  if (!isDoc(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.legal");
  // Messages are precompiled at build time (D-179), so the sections are read one by one through `t`
  // rather than as raw strings; the catalog keeps them as an array.
  const sections: { heading: string; body: string }[] = [];
  for (let index = 0; t.has(`docs.${doc}.sections.${index}.heading` as never); index += 1) {
    sections.push({
      heading: t(`docs.${doc}.sections.${index}.heading` as never),
      body: t(`docs.${doc}.sections.${index}.body` as never),
    });
  }
  return (
    <article className={`${WRAP} pt-10 pb-16 md:pt-14 md:pb-24`} data-testid="legal-page">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <nav aria-label={t("others")} className="order-2 lg:order-1 lg:col-span-3">
          <div className="lg:sticky lg:top-24">
            <p className="text-muted m-0 mb-3 text-sm font-semibold">{t("others")}</p>
            <ul className="border-border m-0 flex list-none flex-col border-t p-0 text-sm">
              {DOCS.map((other) => (
                <li key={other} className="border-border border-b">
                  <a
                    href={getPathname({ href: `/legal/${other}`, locale })}
                    aria-current={other === doc ? "page" : undefined}
                    className="text-muted hover:text-fg aria-[current=page]:text-primary flex min-h-11 items-center py-2 aria-[current=page]:font-semibold"
                  >
                    {t(`docs.${other}.title`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <div className="order-1 flex max-w-3xl flex-col lg:order-2 lg:col-span-8 lg:col-start-5">
          <h1 className="m-0 text-4xl text-balance">{t(`docs.${doc}.title`)}</h1>
          <p className="text-muted m-0 mt-3 text-sm">{t("updated", { date: formatDate(UPDATED, locale) })}</p>
          <ol className="m-0 mt-10 flex list-none flex-col gap-8 p-0">
            {sections.map((section, index) => (
              <li key={section.heading}>
                <section aria-labelledby={`s${index}`}>
                  <h2 id={`s${index}`} className="m-0 text-xl">
                    <span className="text-muted me-3 font-mono text-sm tabular-nums">{index + 1}</span>
                    {section.heading}
                  </h2>
                  <p className="m-0 mt-2 max-w-prose text-pretty">{section.body}</p>
                </section>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
}
