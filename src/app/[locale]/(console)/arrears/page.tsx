import { getTranslations, setRequestLocale } from "next-intl/server";

import { ArrearsView } from "@/features/owner/payments/ArrearsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.arrears");
  return { title: t("title") };
}

/** Arrears (F2 2.4). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ArrearsView context={await ownerContext()} searchParams={await searchParams} />;
}
