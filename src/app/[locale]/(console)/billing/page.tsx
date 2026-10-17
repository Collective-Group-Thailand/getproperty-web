import { getTranslations, setRequestLocale } from "next-intl/server";

import { BillingWorkspace } from "@/features/owner/billing/BillingWorkspace";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.billing");
  return { title: t("title") };
}

/** The billing-cycle workspace (F2 2.3). */
export default async function Billing({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BillingWorkspace context={await ownerContext()} searchParams={await searchParams} />;
}
