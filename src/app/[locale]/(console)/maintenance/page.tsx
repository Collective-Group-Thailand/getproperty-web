import { getTranslations, setRequestLocale } from "next-intl/server";

import { MaintenanceView } from "@/features/owner/service/MaintenanceView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.service.maintenance");
  return { title: t("title") };
}

/** Preventive maintenance plans and the next-due list (F2 2.7). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MaintenanceView context={await ownerContext()} />;
}
