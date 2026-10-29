import { getTranslations, setRequestLocale } from "next-intl/server";

import { BroadcastsView } from "@/features/owner/growth/BroadcastsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.broadcast");
  return { title: t("title") };
}

/** Sponsored LINE broadcasts: availability, who receives them, my campaigns (G6, D-300). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BroadcastsView context={await ownerContext()} searchParams={await searchParams} />;
}
