import { getTranslations, setRequestLocale } from "next-intl/server";

import { InsightsView } from "@/features/owner/insights/InsightsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.insights");
  return { title: t("title") };
}

/** Insights and opt-in benchmarks (B6.3, D-217). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InsightsView context={await ownerContext()} searchParams={await searchParams} />;
}
