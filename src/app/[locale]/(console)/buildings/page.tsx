import { getTranslations, setRequestLocale } from "next-intl/server";

import { BuildingsView } from "@/features/owner/buildings/BuildingsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("buildings") };
}

/** Properties and buildings (F2 2.1). */
export default async function Buildings({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BuildingsView context={await ownerContext()} />;
}
