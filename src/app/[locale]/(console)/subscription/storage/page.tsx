import { getTranslations, setRequestLocale } from "next-intl/server";

import { ownerContext } from "@/features/owner/shared/server";
import { StorageView } from "@/features/owner/subscription/StorageView";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.subscription.storage.page");
  return { title: t("title") };
}

/** Storage: usage, packages and the largest files (pack G1, D-285, D-286). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StorageView context={await ownerContext()} searchParams={await searchParams} />;
}
