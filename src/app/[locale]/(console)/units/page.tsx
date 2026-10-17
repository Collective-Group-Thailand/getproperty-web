import { getTranslations, setRequestLocale } from "next-intl/server";

import { ownerContext } from "@/features/owner/shared/server";
import { UnitsView } from "@/features/owner/units/UnitsView";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("units") };
}

/** Unit board and unit list of a building (F2 2.1). */
export default async function Units({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <UnitsView context={await ownerContext()} searchParams={await searchParams} />;
}
