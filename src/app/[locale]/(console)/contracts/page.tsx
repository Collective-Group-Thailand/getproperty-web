import { getTranslations, setRequestLocale } from "next-intl/server";

import { LibraryView } from "@/features/owner/contracts/LibraryView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.contracts");
  return { title: t("library.title") };
}

/** The contract library: platform drafts and my templates (G3, D-290, D-294). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LibraryView context={await ownerContext()} searchParams={await searchParams} />;
}
