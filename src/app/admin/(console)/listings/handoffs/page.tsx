import { getTranslations } from "next-intl/server";

import { RentalHandoffsView } from "@/features/admin/insight/RentalHandoffsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.listings.tab");
  return { title: t("handoffs") };
}

/** Listings — getbuild rental handoffs and their delivery (G8, D-299). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RentalHandoffsView context={await adminContext()} searchParams={await searchParams} />;
}
