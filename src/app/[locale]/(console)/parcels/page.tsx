import { getTranslations, setRequestLocale } from "next-intl/server";

import { ParcelsView } from "@/features/owner/community/ParcelsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.community.parcels");
  return { title: t("title") };
}

/** The parcels log (F2 2.7). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ParcelsView context={await ownerContext()} searchParams={await searchParams} />;
}
