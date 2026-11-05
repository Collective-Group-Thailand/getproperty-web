import { getTranslations, setRequestLocale } from "next-intl/server";

import { FundsView } from "@/features/owner/juristic/accounting/FundsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.funds");
  return { title: t("title") };
}

/** The office funds and their transfers (JW2a, D-311). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FundsView context={await ownerContext()} searchParams={await searchParams} />;
}
