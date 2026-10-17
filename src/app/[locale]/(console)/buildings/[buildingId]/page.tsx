import { getTranslations, setRequestLocale } from "next-intl/server";

import { BuildingDetail } from "@/features/owner/buildings/BuildingDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("buildings") };
}

/** One building (F2 2.1): address, floors, utility accounts, billing settings, unit types. */
export default async function Building({ params }: { params: Promise<{ locale: Locale; buildingId: string }> }) {
  const { locale, buildingId } = await params;
  setRequestLocale(locale);
  return <BuildingDetail context={await ownerContext()} buildingId={buildingId} />;
}
