import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContractView } from "@/features/owner/juristic/vendors/ContractsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.contract");
  return { title: t("kind") };
}

/** One service contract (JW2b, D-331). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; contractId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, contractId } = await params;
  setRequestLocale(locale);
  return <ContractView context={await ownerContext()} contractId={contractId} searchParams={await searchParams} />;
}
