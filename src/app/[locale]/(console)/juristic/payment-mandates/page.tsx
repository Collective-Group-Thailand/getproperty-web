import { getTranslations, setRequestLocale } from "next-intl/server";

import { MandatesView } from "@/features/owner/juristic/collections/MandatesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.mandates");
  return { title: t("title") };
}

/** Auto-pay mandates (JW1b, D-308). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MandatesView context={await ownerContext()} searchParams={await searchParams} />;
}
