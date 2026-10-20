import { getTranslations } from "next-intl/server";

import { FleetView } from "@/features/admin/fleet/FleetView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("devices") };
}

/** Device fleet (F5 5.3). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <FleetView context={await adminContext()} searchParams={await searchParams} />;
}
