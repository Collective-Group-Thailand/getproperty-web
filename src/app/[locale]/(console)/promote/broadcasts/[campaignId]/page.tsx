import { getTranslations, setRequestLocale } from "next-intl/server";

import { CampaignDetailView } from "@/features/owner/growth/CampaignDetailView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.broadcast");
  return { title: t("tabs.broadcasts") };
}

/** A sponsored campaign: state, schedule / cancel, report in totals only (G6, D-300). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; campaignId: string }> }) {
  const { locale, campaignId } = await params;
  setRequestLocale(locale);
  return <CampaignDetailView context={await ownerContext()} campaignId={campaignId} />;
}
