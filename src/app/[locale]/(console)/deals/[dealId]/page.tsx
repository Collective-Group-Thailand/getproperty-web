import { getTranslations, setRequestLocale } from "next-intl/server";

import { DealDetailView } from "@/features/owner/agency/WorkspaceViews";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("deals") };
}

/** One closed deal: commission recorded, fees owed (G2, D-293). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; dealId: string }> }) {
  const { locale, dealId } = await params;
  setRequestLocale(locale);
  return <DealDetailView context={await ownerContext()} dealId={dealId} />;
}
