import { getTranslations, setRequestLocale } from "next-intl/server";

import { DealsView } from "@/features/owner/agency/WorkspaceViews";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("deals") };
}

/** Closed deals with the recorded commission (G2, D-293). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DealsView context={await ownerContext()} />;
}
