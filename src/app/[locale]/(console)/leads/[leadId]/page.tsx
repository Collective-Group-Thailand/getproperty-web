import { getTranslations, setRequestLocale } from "next-intl/server";

import { LeadDetailView } from "@/features/owner/leads/LeadDetailView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("leads") };
}

/** One enquiry: the conversation, what the prospect asked, viewings, notes, outcome (F6.2 part 2, D-252). */
export default async function Lead({ params }: { params: Promise<{ locale: Locale; leadId: string }> }) {
  const { locale, leadId } = await params;
  setRequestLocale(locale);
  return <LeadDetailView context={await ownerContext()} leadId={leadId} />;
}
