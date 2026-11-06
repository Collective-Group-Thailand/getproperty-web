import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContractFormView } from "@/features/owner/juristic/vendors/ContractsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.editor");
  return { title: t("title") };
}

/** The contract editor for a new draft (JW2b). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContractFormView context={await ownerContext()} searchParams={await searchParams} />;
}
