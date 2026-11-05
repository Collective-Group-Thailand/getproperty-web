import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReportsView } from "@/features/owner/juristic/collections/ReportsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.reports");
  return { title: t("title") };
}

/** Aging and the collection-rate KPI (JW1b, J1.2b §4). */
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
