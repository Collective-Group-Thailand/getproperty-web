import { getTranslations, setRequestLocale } from "next-intl/server";

import { PaymentSettingsView } from "@/features/owner/juristic/collections/PaymentSettingsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.paymentSettings");
  return { title: t("title") };
}

/** Juristic payment rules from the API's settings (JW1b). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PaymentSettingsView context={await ownerContext()} />;
}
