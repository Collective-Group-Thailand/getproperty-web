import { getTranslations } from "next-intl/server";

import { BroadcastCampaignsView } from "@/features/admin/growth/BroadcastCampaignsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.listings.tab");
  return { title: t("broadcasts") };
}

/** Listings — every account's sponsored LINE campaigns, totals only (G6, D-300). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BroadcastCampaignsView context={await adminContext()} searchParams={await searchParams} />;
}
