import { getTranslations } from "next-intl/server";

import { PricePlansView } from "@/features/admin/billing/PricePlansView";
import { BillingFrame } from "@/features/admin/billing/SubscriptionsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.billing.tab");
  return { title: t("plans") };
}

/** Subscriptions — price plans (F5 5.1, D-156, D-204). */
export default async function Page() {
  const [context, t] = await Promise.all([adminContext(), getTranslations("admin.billing")]);
  return (
    <BillingFrame current="plans" title={t("tab.plans")} description={t("description.plans")}>
      <PricePlansView context={context} />
    </BillingFrame>
  );
}
