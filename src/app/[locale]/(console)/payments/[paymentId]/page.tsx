import { getTranslations, setRequestLocale } from "next-intl/server";

import { PaymentDetail } from "@/features/owner/payments/PaymentDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("payments") };
}

/** One payment (F2 2.4). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; paymentId: string }> }) {
  const { locale, paymentId } = await params;
  setRequestLocale(locale);
  return <PaymentDetail context={await ownerContext()} paymentId={paymentId} />;
}
