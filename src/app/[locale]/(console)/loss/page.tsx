import { getTranslations, setRequestLocale } from "next-intl/server";

import { LossView } from "@/features/owner/metering/LossView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("utility_loss") };
}

/** The loss workspace (F2 2.5). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LossView context={await ownerContext()} searchParams={await searchParams} />;
}
