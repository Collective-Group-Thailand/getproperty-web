import { getTranslations, setRequestLocale } from "next-intl/server";

import { SettingsView } from "@/features/owner/settings/SettingsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("settings") };
}

/** Settings: company data, tenant and building settings (F2 2.6). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsView context={await ownerContext()} searchParams={await searchParams} />;
}
