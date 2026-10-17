import { getTranslations, setRequestLocale } from "next-intl/server";

import { ArrearsParty } from "@/features/owner/payments/ArrearsParty";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.arrears");
  return { title: t("title") };
}

/** One party's arrears (F2 2.4). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; partyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, partyId } = await params;
  setRequestLocale(locale);
  return <ArrearsParty context={await ownerContext()} partyId={partyId} searchParams={await searchParams} />;
}
