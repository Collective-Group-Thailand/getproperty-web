import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { marketingMetadata } from "@/features/owner/marketing/seo";
import { formatDate } from "@/i18n/format";
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
    <article className="mx-auto max-w-3xl px-4 py-14" data-testid="legal-page">
      <h1 className="font-display text-3xl font-semibold">{t(`docs.${doc}.title`)}</h1>
      <p className="text-muted mt-2 text-sm">{t("updated", { date: formatDate(UPDATED, locale) })}</p>
      {sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-xl font-semibold">{section.heading}</h2>
          <p className="mt-2 leading-relaxed">{section.body}</p>
        </section>
      ))}
    </article>
  );
}
