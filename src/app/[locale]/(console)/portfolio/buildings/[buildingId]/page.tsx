import { getTranslations, setRequestLocale } from "next-intl/server";

import { PmBuildingView } from "@/features/owner/pm/PmViews";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.pm.building");
  return { title: t("metaTitle") };
}

/** One building a PM company manages today (JW3b, D-334). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; buildingId: string }> }) {
  const { locale, buildingId } = await params;
  setRequestLocale(locale);
  return <PmBuildingView context={await ownerContext()} buildingId={buildingId} />;
}
