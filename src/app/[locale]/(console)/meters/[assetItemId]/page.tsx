import { getTranslations, setRequestLocale } from "next-intl/server";

import { MeterDetail } from "@/features/owner/metering/MeterDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("readings") };
}

/** One meter (F2 2.5). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; assetItemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, assetItemId } = await params;
  setRequestLocale(locale);
  return <MeterDetail context={await ownerContext()} assetItemId={assetItemId} searchParams={await searchParams} />;
}
