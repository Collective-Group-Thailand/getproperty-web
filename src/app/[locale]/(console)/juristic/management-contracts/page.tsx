import { getTranslations, setRequestLocale } from "next-intl/server";

import { ManagementContractsView } from "@/features/owner/juristic/management/ManagementContractsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.pm.juristic");
  return { title: t("title") };
}

/** Management contracts with PM companies (JW3b, D-334). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ManagementContractsView context={await ownerContext()} searchParams={await searchParams} />;
}
