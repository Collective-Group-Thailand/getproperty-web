import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountsView } from "@/features/owner/juristic/accounting/AccountsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.accounts");
  return { title: t("title") };
}

/** The chart of accounts editor (JW2a, J2.1 §1). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountsView context={await ownerContext()} />;
}
