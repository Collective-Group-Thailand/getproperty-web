import { getTranslations, setRequestLocale } from "next-intl/server";

import { LocksView } from "@/features/owner/access/LocksView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.access");
  return { title: t("title") };
}

/** Doors and locks of the focused building (F2 2.7). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LocksView context={await ownerContext()} />;
}
