import { getTranslations, setRequestLocale } from "next-intl/server";

import { QuotationsView } from "@/features/owner/juristic/vendors/QuotationsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.rounds");
  return { title: t("title") };
}

/** Quotation rounds with the awaiting-me tab (JW2b, D-310). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <QuotationsView context={await ownerContext()} searchParams={await searchParams} />;
}
