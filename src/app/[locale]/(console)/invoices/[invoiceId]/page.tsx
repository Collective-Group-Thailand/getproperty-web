import { getTranslations, setRequestLocale } from "next-intl/server";

import { InvoiceDetail } from "@/features/owner/invoices/InvoiceDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("invoices") };
}

/** One invoice (F2 2.3). */
export default async function Invoice({ params }: { params: Promise<{ locale: Locale; invoiceId: string }> }) {
  const { locale, invoiceId } = await params;
  setRequestLocale(locale);
  return <InvoiceDetail context={await ownerContext()} invoiceId={invoiceId} />;
}
