import { getTranslations, setRequestLocale } from "next-intl/server";

import { ownerContext } from "@/features/owner/shared/server";
import { SubscriptionInvoice } from "@/features/owner/subscription/SubscriptionView";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("subscription") };
}

/** One invoice from getproperty with its Thai QR and PDF (F2 2.6). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; invoiceId: string }> }) {
  const { locale, invoiceId } = await params;
  setRequestLocale(locale);
  return <SubscriptionInvoice context={await ownerContext()} invoiceId={invoiceId} />;
}
