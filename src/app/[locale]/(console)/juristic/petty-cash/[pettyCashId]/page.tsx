import { getTranslations, setRequestLocale } from "next-intl/server";

import { PettyCashView } from "@/features/owner/juristic/accounting/PettyCashView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.petty");
  return { title: t("title") };
}

/** One petty cash float: spends, counts, top-up (JW2a). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; pettyCashId: string }> }) {
  const { locale, pettyCashId } = await params;
  setRequestLocale(locale);
  return <PettyCashView context={await ownerContext()} pettyCashId={pettyCashId} />;
}
