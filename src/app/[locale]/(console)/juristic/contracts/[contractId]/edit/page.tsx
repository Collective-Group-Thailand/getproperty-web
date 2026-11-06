import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContractFormView } from "@/features/owner/juristic/vendors/ContractsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.editor");
  return { title: t("editPage") };
}

/** The contract editor for a draft (JW2b). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; contractId: string }> }) {
  const { locale, contractId } = await params;
  setRequestLocale(locale);
  return <ContractFormView context={await ownerContext()} contractId={contractId} />;
}
