import { getTranslations, setRequestLocale } from "next-intl/server";

import { PartyDetail } from "@/features/owner/parties/PartyDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("parties") };
}

/** One party (F2 2.2). */
export default async function Party({ params }: { params: Promise<{ locale: Locale; partyId: string }> }) {
  const { locale, partyId } = await params;
  setRequestLocale(locale);
  return <PartyDetail context={await ownerContext()} partyId={partyId} />;
}
