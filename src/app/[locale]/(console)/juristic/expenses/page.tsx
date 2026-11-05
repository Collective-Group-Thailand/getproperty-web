import { getTranslations, setRequestLocale } from "next-intl/server";

import { ExpensesView } from "@/features/owner/juristic/accounting/ExpensesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.expenses");
  return { title: t("title") };
}

/** Expense requests with the awaiting-me tab (JW2a, D-311). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ExpensesView context={await ownerContext()} searchParams={await searchParams} />;
}
