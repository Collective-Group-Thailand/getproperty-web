import { getTranslations, setRequestLocale } from "next-intl/server";

import { WorkOrderDetail } from "@/features/owner/service/WorkOrderDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.service.workOrder");
  return { title: t("metaTitle") };
}

/** One work order (F2 2.7). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; workOrderId: string }> }) {
  const { locale, workOrderId } = await params;
  setRequestLocale(locale);
  return <WorkOrderDetail context={await ownerContext()} workOrderId={workOrderId} />;
}
