import { getTranslations, setRequestLocale } from "next-intl/server";

import { PmContractView } from "@/features/owner/pm/PmViews";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.pm.contract");
  return { title: t("metaTitle") };
}

/** One management contract from the PM company's side (JW3b, D-334). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; contractId: string }> }) {
  const { locale, contractId } = await params;
  setRequestLocale(locale);
  return <PmContractView context={await ownerContext()} contractId={contractId} />;
}
