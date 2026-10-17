import { getTranslations, setRequestLocale } from "next-intl/server";

import { DepositDetail } from "@/features/owner/deposits/DepositDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("deposits") };
}

/** One deposit and its settlement (F2 2.2). */
export default async function Deposit({ params }: { params: Promise<{ locale: Locale; depositId: string }> }) {
  const { locale, depositId } = await params;
  setRequestLocale(locale);
  return <DepositDetail context={await ownerContext()} depositId={depositId} />;
}
