import { getTranslations, setRequestLocale } from "next-intl/server";

import { TransferView } from "@/features/owner/juristic/TransferView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.juristic.transfer");
  return { title: t("metaTitle") };
}

/** Whole-unit transfer (JW1a, J1.1b): date → buyers and shares → review; the API prorates what was billed. */
export default async function JuristicTransfer({ params }: { params: Promise<{ locale: Locale; unitId: string }> }) {
  const { locale, unitId } = await params;
  setRequestLocale(locale);
  return <TransferView context={await ownerContext()} unitId={unitId} />;
}
