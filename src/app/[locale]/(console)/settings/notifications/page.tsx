import { getTranslations, setRequestLocale } from "next-intl/server";

import { NotificationsView } from "@/features/owner/settings/NotificationsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("notifications") };
}

/** Resident notification routing (F2 2.6). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationsView context={await ownerContext()} searchParams={await searchParams} />;
}
