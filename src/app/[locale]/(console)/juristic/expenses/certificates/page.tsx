import { getTranslations, setRequestLocale } from "next-intl/server";

import { CertificatesView } from "@/features/owner/juristic/accounting/ExpensesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.certificates");
  return { title: t("title") };
}

/** 50 ทวิ certificates (JW2a). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CertificatesView context={await ownerContext()} searchParams={await searchParams} />;
}
