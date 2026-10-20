import { getTranslations, setRequestLocale } from "next-intl/server";

import { AnnouncementDetail } from "@/features/owner/community/AnnouncementDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.community.announcement");
  return { title: t("crumb") };
}

/** One announcement with its read receipts (F2 2.7). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; announcementId: string }> }) {
  const { locale, announcementId } = await params;
  setRequestLocale(locale);
  return <AnnouncementDetail context={await ownerContext()} announcementId={announcementId} />;
}
