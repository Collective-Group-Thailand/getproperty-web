import { getTranslations, setRequestLocale } from "next-intl/server";

import { LineOaView } from "@/features/owner/settings/LineOaView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.settings.lineOa");
  return { title: t("title") };
}

/** The operator's own LINE Official Account (D-254). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LineOaView context={await ownerContext()} />;
}
