import { getTranslations, setRequestLocale } from "next-intl/server";

import { InvoicesView } from "@/features/owner/invoices/InvoicesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("invoices") };
}

/** Invoices (F2 2.3). */
export default async function Invoices({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InvoicesView context={await ownerContext()} searchParams={await searchParams} />;
}
