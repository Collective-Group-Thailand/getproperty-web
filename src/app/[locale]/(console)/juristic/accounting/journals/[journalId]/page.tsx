import { getTranslations, setRequestLocale } from "next-intl/server";

import { JournalView } from "@/features/owner/juristic/accounting/JournalsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.journals");
  return { title: t("paperKind") };
}

/** One journal entry as paper, with reverse (JW2a). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; journalId: string }> }) {
  const { locale, journalId } = await params;
  setRequestLocale(locale);
  return <JournalView context={await ownerContext()} journalId={journalId} />;
}
