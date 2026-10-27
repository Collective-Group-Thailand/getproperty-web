import { getTranslations, setRequestLocale } from "next-intl/server";

import { CoBrokeView } from "@/features/owner/agency/WorkspaceViews";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("co_broke") };
}

/** Co-broke agreements between agencies (G2, D-293). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CoBrokeView context={await ownerContext()} />;
}
