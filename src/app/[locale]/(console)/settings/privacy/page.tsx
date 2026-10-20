import { getTranslations, setRequestLocale } from "next-intl/server";

import { PrivacyView } from "@/features/owner/settings/PrivacyView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("privacy") };
}

/** Consents and the DSR inbox (F2 2.6). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PrivacyView context={await ownerContext()} searchParams={await searchParams} />;
}
