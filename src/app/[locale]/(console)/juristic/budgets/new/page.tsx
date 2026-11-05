import { getTranslations, setRequestLocale } from "next-intl/server";

import { NewBudgetView } from "@/features/owner/juristic/BudgetsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.juristic.budget");
  return { title: t("title") };
}

/** A new budget (JW1a). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NewBudgetView context={await ownerContext()} searchParams={await searchParams} />;
}
