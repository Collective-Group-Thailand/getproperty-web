import { getTranslations } from "next-intl/server";

import { ReviewsModerationView } from "@/features/admin/insight/ReviewsModerationView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.listings.tab");
  return { title: t("reviews") };
}

/** Listings — verified building reviews to moderate (G9, D-301). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReviewsModerationView context={await adminContext()} searchParams={await searchParams} />;
}
