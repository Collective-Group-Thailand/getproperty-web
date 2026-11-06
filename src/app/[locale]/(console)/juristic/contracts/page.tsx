import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContractsView } from "@/features/owner/juristic/vendors/ContractsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.contracts");
  return { title: t("title") };
}

/** Service contracts with the renewal queue (JW2b, D-331). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContractsView context={await ownerContext()} searchParams={await searchParams} />;
}
