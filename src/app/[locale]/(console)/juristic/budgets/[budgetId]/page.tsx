import { getTranslations, setRequestLocale } from "next-intl/server";

import { BudgetView } from "@/features/owner/juristic/BudgetsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.juristic.budget");
  return { title: t("title") };
}

/** One budget (JW1a): lines, approval with a resolution, and the rate built from it with its live preview. */
export default async function Page({ params }: { params: Promise<{ locale: Locale; budgetId: string }> }) {
  const { locale, budgetId } = await params;
  setRequestLocale(locale);
  return <BudgetView context={await ownerContext()} budgetId={budgetId} />;
}
