import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReportsView } from "@/features/owner/reports/ReportsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("reports") };
}

/** Reports, exports and insights (F2 2.6). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReportsView context={await ownerContext()} searchParams={await searchParams} />;
}
