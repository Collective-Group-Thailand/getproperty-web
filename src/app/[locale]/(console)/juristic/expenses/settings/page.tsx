import { getTranslations, setRequestLocale } from "next-intl/server";

import { ExpenseSettingsView } from "@/features/owner/juristic/accounting/ExpenseSettingsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.expenseSettings");
  return { title: t("title") };
}

/** Approval bands and WHT rates editors (JW2a, D-311, O-041). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ExpenseSettingsView context={await ownerContext()} />;
}
