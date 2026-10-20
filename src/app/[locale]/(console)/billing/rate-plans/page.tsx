import { getTranslations, setRequestLocale } from "next-intl/server";

import { RatePlansView } from "@/features/owner/rates/RatePlansView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("rate_plans") };
}

/** Rate plans with the utility cap (F2 2.6, D-021a). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RatePlansView context={await ownerContext()} searchParams={await searchParams} />;
}
