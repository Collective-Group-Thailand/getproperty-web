import { getTranslations, setRequestLocale } from "next-intl/server";

import { RenewalsView } from "@/features/owner/contracts/RenewalsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.contracts");
  return { title: t("renewals.title") };
}

/** Renewal offers and the residents' answers (G3, D-294). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RenewalsView context={await ownerContext()} searchParams={await searchParams} />;
}
