import { getTranslations, setRequestLocale } from "next-intl/server";

import { ImportsView } from "@/features/owner/juristic/imports/ImportsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.imports.list");
  return { title: t("title") };
}

/** Import jobs from a legacy system, one per building, and the full export (JW3a, D-332). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ImportsView context={await ownerContext()} searchParams={await searchParams} />;
}
