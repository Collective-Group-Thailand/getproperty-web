import { getTranslations, setRequestLocale } from "next-intl/server";

import { QuotationRoundView } from "@/features/owner/juristic/vendors/QuotationsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.round");
  return { title: t("kind") };
}

/** One quotation round: comparison, award, approvals (JW2b, D-310). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; roundId: string }> }) {
  const { locale, roundId } = await params;
  setRequestLocale(locale);
  return <QuotationRoundView context={await ownerContext()} roundId={roundId} />;
}
