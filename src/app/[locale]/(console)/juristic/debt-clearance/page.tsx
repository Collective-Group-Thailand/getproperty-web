import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClearancesView } from "@/features/owner/juristic/collections/ClearanceView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.clearance");
  return { title: t("title") };
}

/** Debt clearance requests and certificates (JW1b, D-306). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ClearancesView context={await ownerContext()} searchParams={await searchParams} />;
}
