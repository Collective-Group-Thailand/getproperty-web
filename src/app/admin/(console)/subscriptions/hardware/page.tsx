import { getTranslations } from "next-intl/server";

import { BillingFrame } from "@/features/admin/billing/SubscriptionsView";
import { HardwareTable } from "@/features/admin/billing/HardwareView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.billing.tab");
  return { title: t("hardware") };
}

/** Subscriptions — hardware (F5 5.1). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query, t] = await Promise.all([adminContext(), searchParams, getTranslations("admin.billing")]);
  return (
    <BillingFrame current="hardware" title={t("tab.hardware")} description={t("description.hardware")}>
      <HardwareTable context={context} searchParams={query} path="/subscriptions/hardware" />
    </BillingFrame>
  );
}
