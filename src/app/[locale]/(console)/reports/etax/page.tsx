import { getTranslations, setRequestLocale } from "next-intl/server";

import { EtaxView } from "@/features/owner/etax/EtaxView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.etax");
  return { title: t("title") };
}

/** e-Tax submissions and the month's summary (B6.2, D-215). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EtaxView context={await ownerContext()} searchParams={await searchParams} />;
}
