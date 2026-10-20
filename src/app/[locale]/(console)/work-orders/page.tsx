import { getTranslations, setRequestLocale } from "next-intl/server";

import { WorkOrdersView } from "@/features/owner/service/WorkOrdersView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.service.workOrders");
  return { title: t("title") };
}

/** Work orders (F2 2.7). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WorkOrdersView context={await ownerContext()} searchParams={await searchParams} />;
}
