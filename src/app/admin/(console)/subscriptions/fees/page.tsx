import { getTranslations } from "next-intl/server";

import { FeeAccrualsView } from "@/features/admin/growth/FeeAccrualsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.billing.tab");
  return { title: t("fees") };
}

/** Subscriptions — agencies' success / co-broke fees, their invoices and disputes (G5, D-297). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <FeeAccrualsView context={await adminContext()} searchParams={await searchParams} />;
}
