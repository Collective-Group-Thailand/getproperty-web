import { getTranslations, setRequestLocale } from "next-intl/server";

import { PettyCashListView } from "@/features/owner/juristic/accounting/PettyCashView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.petty");
  return { title: t("title") };
}

/** Petty cash floats (JW2a). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PettyCashListView context={await ownerContext()} />;
}
