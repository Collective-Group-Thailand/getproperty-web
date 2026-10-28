import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContractDetailView } from "@/features/owner/contracts/ContractDetailView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.contracts");
  return { title: t("detail.metaTitle") };
}

/** One signable contract: signers, values, send / sign / cancel (G3, D-294, D-062). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; contractId: string }> }) {
  const { locale, contractId } = await params;
  setRequestLocale(locale);
  return <ContractDetailView context={await ownerContext()} contractId={contractId} />;
}
