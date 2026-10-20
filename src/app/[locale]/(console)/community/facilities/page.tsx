import { getTranslations, setRequestLocale } from "next-intl/server";

import { FacilitiesView } from "@/features/owner/community/FacilitiesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.community.facilities");
  return { title: t("title") };
}

/** Facilities and bookings (F2 2.7). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FacilitiesView context={await ownerContext()} searchParams={await searchParams} />;
}
