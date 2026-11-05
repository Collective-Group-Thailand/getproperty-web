import { getTranslations, setRequestLocale } from "next-intl/server";

import { ExpenseNewView } from "@/features/owner/juristic/accounting/ExpensesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.expense");
  return { title: t("edit") };
}

/** Editing a draft expense request (JW2a). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; expenseId: string }> }) {
  const { locale, expenseId } = await params;
  setRequestLocale(locale);
  return <ExpenseNewView context={await ownerContext()} draftId={expenseId} />;
}
