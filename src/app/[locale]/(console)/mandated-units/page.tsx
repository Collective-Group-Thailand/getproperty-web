import { getTranslations, setRequestLocale } from "next-intl/server";

import { MandatedUnitsView } from "@/features/owner/agency/WorkspaceViews";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("mandated_units") };
}

/** An agency's mandated units (G2, D-293). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MandatedUnitsView context={await ownerContext()} searchParams={await searchParams} />;
}
