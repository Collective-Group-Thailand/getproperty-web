import { getTranslations, setRequestLocale } from "next-intl/server";

import { RequestsView } from "@/features/owner/service/RequestsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.service.list");
  return { title: t("title") };
}

/** The service requests inbox (F2 2.7). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RequestsView context={await ownerContext()} searchParams={await searchParams} />;
}
