import { getTranslations, setRequestLocale } from "next-intl/server";

import { ListingsView } from "@/features/owner/listings/ListingsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("listings") };
}

/** The owner's rental listings (F6.2, D-252). */
export default async function Listings({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ListingsView context={await ownerContext()} searchParams={await searchParams} />;
}
