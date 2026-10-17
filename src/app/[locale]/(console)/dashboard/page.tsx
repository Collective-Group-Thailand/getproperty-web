import { getTranslations, setRequestLocale } from "next-intl/server";

import { DashboardView } from "@/features/owner/dashboard/DashboardView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("dashboard") };
}

/** The morning dashboard (F2 2.1): the Today queue, the month's figures, the cycle and the compliance score. */
export default async function Dashboard({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DashboardView context={await ownerContext()} />;
}
