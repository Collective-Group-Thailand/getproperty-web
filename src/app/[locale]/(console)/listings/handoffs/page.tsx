import { getTranslations, setRequestLocale } from "next-intl/server";

import { HandoffsView } from "@/features/owner/handoffs/HandoffsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.network.handoffs");
  return { title: t("title") };
}

/** Units handed over from getbuild and their listing drafts (G8, D-299). */
export default async function Handoffs({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HandoffsView context={await ownerContext()} />;
}
