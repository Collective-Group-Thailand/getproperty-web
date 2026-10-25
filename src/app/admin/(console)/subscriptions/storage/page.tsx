import { getTranslations } from "next-intl/server";

import { StorageView } from "@/features/admin/billing/StorageView";
import { BillingFrame } from "@/features/admin/billing/SubscriptionsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.billing.tab");
  return { title: t("storage") };
}

/** Subscriptions — storage allowance, overage price, packs and every tenant's usage (D-276, D-279). */
export default async function Page() {
  const [context, t] = await Promise.all([adminContext(), getTranslations("admin.billing")]);
  return (
    <BillingFrame current="storage" title={t("tab.storage")} description={t("description.storage")}>
      <StorageView context={context} />
    </BillingFrame>
  );
}
