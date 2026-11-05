import { getTranslations, setRequestLocale } from "next-intl/server";

import { BankQueueView } from "@/features/owner/juristic/accounting/BankStatementsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.bank");
  return { title: t("title") };
}

/** The two-pane matching queue of one statement (JW2a). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; statementId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, statementId } = await params;
  setRequestLocale(locale);
  return <BankQueueView context={await ownerContext()} statementId={statementId} searchParams={await searchParams} />;
}
