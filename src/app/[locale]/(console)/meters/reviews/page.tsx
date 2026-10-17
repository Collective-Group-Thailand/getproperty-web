import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReviewsView } from "@/features/owner/metering/ReviewsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.meters.reviews");
  return { title: t("title") };
}

/** The reading review queue (F2 2.5). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReviewsView context={await ownerContext()} searchParams={await searchParams} />;
}
