import { getTranslations, setRequestLocale } from "next-intl/server";

import { BankStatementsView } from "@/features/owner/juristic/accounting/BankStatementsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.bank");
  return { title: t("title") };
}

/** Imported bank statements (JW2a, J2.1 §7). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BankStatementsView context={await ownerContext()} searchParams={await searchParams} />;
}
