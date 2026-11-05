import { getTranslations, setRequestLocale } from "next-intl/server";

import { TransferView } from "@/features/owner/juristic/accounting/FundsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.transferRecord");
  return { title: t("paper") };
}

/** A fund transfer with second-user approval (JW2a). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; transferId: string }> }) {
  const { locale, transferId } = await params;
  setRequestLocale(locale);
  return <TransferView context={await ownerContext()} transferId={transferId} />;
}
