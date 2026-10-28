import { getTranslations, setRequestLocale } from "next-intl/server";

import { PromotionView } from "@/features/owner/growth/PromotionView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.growth");
  return { title: t("page.title") };
}

/** Boosts of listings and buildings, photo services and their invoices (G5, D-297). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PromotionView context={await ownerContext()} searchParams={await searchParams} />;
}
