import { getTranslations, setRequestLocale } from "next-intl/server";

import { PlansView } from "@/features/owner/juristic/collections/PlansView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.plans");
  return { title: t("title") };
}

/** Payment plans of the juristic office (JW1b, D-308). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlansView context={await ownerContext()} searchParams={await searchParams} />;
}
