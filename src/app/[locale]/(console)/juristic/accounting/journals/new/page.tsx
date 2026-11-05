import { getTranslations, setRequestLocale } from "next-intl/server";

import { JournalNewView } from "@/features/owner/juristic/accounting/JournalsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.journalForm");
  return { title: t("title") };
}

/** A manual journal with a live balance check (JW2a). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <JournalNewView context={await ownerContext()} />;
}
