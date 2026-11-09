import { getTranslations, setRequestLocale } from "next-intl/server";

import { ManagementContractView } from "@/features/owner/juristic/management/ManagementContractsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.pm.juristic");
  return { title: t("metaRecord") };
}

/** One management contract from the juristic office's side (JW3b, D-334). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; contractId: string }> }) {
  const { locale, contractId } = await params;
  setRequestLocale(locale);
  return <ManagementContractView context={await ownerContext()} contractId={contractId} />;
}
