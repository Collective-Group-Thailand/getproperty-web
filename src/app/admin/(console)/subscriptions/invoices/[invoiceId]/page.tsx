import { getTranslations } from "next-intl/server";

import { InvoiceDetail } from "@/features/admin/billing/InvoiceDetail";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.billing.invoice");
  return { title: t("crumb") };
}

/** One platform invoice (F5 5.1). */
export default async function Page({ params }: { params: Promise<{ invoiceId: string }> }) {
  const [{ invoiceId }, context] = await Promise.all([params, adminContext()]);
  return <InvoiceDetail context={context} invoiceId={invoiceId} />;
}
