import { getTranslations, setRequestLocale } from "next-intl/server";

import { HeldPaymentsView } from "@/features/owner/payments/HeldPaymentsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.payments.held");
  return { title: t("title") };
}

/** Held payments to check (D-220). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HeldPaymentsView context={await ownerContext()} />;
}
