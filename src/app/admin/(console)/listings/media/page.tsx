import { getTranslations } from "next-intl/server";

import { MediaOrdersView } from "@/features/admin/growth/MediaOrdersView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.listings.tab");
  return { title: t("media") };
}

/** Listings — verified photo / 360° orders of every tenant (G5, D-297). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MediaOrdersView context={await adminContext()} searchParams={await searchParams} />;
}
