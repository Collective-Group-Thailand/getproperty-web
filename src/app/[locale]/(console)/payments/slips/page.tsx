import { getTranslations, setRequestLocale } from "next-intl/server";

import { SlipQueue } from "@/features/owner/payments/SlipQueue";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.payments.slips");
  return { title: t("title") };
}

/** The slip review queue (F2 2.4). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SlipQueue context={await ownerContext()} searchParams={await searchParams} />;
}
