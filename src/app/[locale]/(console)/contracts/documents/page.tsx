import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContractsListView } from "@/features/owner/contracts/ContractsListView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.contracts");
  return { title: t("documents.title") };
}

/** Signable contracts: reservation, addendum, brokerage mandate, co-broke (G3, D-294). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContractsListView context={await ownerContext()} searchParams={await searchParams} />;
}
