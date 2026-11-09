import { getTranslations, setRequestLocale } from "next-intl/server";

import { PmContractsView } from "@/features/owner/pm/PmViews";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.pm.contracts");
  return { title: t("title") };
}

/** The PM company's management contracts — offers first (JW3b, D-334). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PmContractsView context={await ownerContext()} searchParams={await searchParams} />;
}
