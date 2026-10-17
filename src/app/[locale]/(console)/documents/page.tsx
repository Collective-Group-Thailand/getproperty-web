import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocumentsView } from "@/features/owner/payments/DocumentsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.documents");
  return { title: t("title") };
}

/** The documents archive (F2 2.4). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DocumentsView context={await ownerContext()} searchParams={await searchParams} />;
}
