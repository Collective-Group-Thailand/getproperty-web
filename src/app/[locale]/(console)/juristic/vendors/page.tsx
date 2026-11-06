import { getTranslations, setRequestLocale } from "next-intl/server";

import { VendorsView } from "@/features/owner/juristic/vendors/VendorsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.list");
  return { title: t("title") };
}

/** The office's vendors (JW2b, D-331). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VendorsView context={await ownerContext()} searchParams={await searchParams} />;
}
