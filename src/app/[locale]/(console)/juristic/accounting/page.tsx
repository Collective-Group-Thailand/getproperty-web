import { getTranslations, setRequestLocale } from "next-intl/server";

import { StatementsView } from "@/features/owner/juristic/accounting/StatementsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.statements");
  return { title: t("title") };
}

/** The office's financial statements (JW2a, J2.1 §6). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StatementsView context={await ownerContext()} searchParams={await searchParams} />;
}
