import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReviewsView } from "@/features/owner/reviews/ReviewsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.insight.reviews");
  return { title: t("title") };
}

/** Verified reviews of my buildings: reply and report, never hide (G9, D-301). */
export default async function Reviews({
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
