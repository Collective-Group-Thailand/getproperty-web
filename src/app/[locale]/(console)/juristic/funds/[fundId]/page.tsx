import { getTranslations, setRequestLocale } from "next-intl/server";

import { FundView } from "@/features/owner/juristic/accounting/FundsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.funds");
  return { title: t("ledger") };
}

/** One fund: ledger, bank account, transfer request (JW2a). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; fundId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, fundId } = await params;
  setRequestLocale(locale);
  return <FundView context={await ownerContext()} fundId={fundId} searchParams={await searchParams} />;
}
