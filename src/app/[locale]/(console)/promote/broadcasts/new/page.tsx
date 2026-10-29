import { getTranslations, setRequestLocale } from "next-intl/server";

import { CampaignNewView } from "@/features/owner/growth/CampaignNewView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.broadcast.builder");
  return { title: t("title") };
}

/** New sponsored campaign: listings, segment, estimate and cost preview, saved as a draft (G6, D-300). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CampaignNewView context={await ownerContext()} searchParams={await searchParams} />;
}
