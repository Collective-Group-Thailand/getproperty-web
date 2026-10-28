import { getTranslations, setRequestLocale } from "next-intl/server";

import { FacebookPageView } from "@/features/owner/growth/FacebookPageView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.growth.facebook");
  return { title: t("title") };
}

/** The operator's own Facebook Page for automatic listing posts (G4, D-288). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FacebookPageView context={await ownerContext()} />;
}
