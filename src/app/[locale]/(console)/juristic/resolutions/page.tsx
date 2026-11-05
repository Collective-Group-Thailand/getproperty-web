import { getTranslations, setRequestLocale } from "next-intl/server";

import { ResolutionsView } from "@/features/owner/juristic/ResolutionsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.juristic.resolution");
  return { title: t("title") };
}

/** Meeting resolutions (JW1a, D-304). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ResolutionsView context={await ownerContext()} searchParams={await searchParams} />;
}
