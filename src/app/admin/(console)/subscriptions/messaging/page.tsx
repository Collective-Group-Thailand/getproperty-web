import { getTranslations } from "next-intl/server";

import { EnterMessagingRate } from "@/features/admin/billing/MessagingRateActions";
import { MessagingRatesView } from "@/features/admin/billing/MessagingRatesView";
import { BillingFrame } from "@/features/admin/billing/SubscriptionsView";
import { adminContext } from "@/features/admin/shared/server";
import { bangkokToday } from "@/features/shared/console/time";

export async function generateMetadata() {
  const t = await getTranslations("admin.billing.tab");
  return { title: t("messaging") };
}

/** Subscriptions — the shared LINE OA's message rates (D-254). */
export default async function Page() {
  const [context, t] = await Promise.all([adminContext(), getTranslations("admin.billing")]);
  const today = bangkokToday();
  return (
    <BillingFrame
      current="messaging"
      title={t("tab.messaging")}
      description={t("description.messaging")}
      actions={<EnterMessagingRate today={today} />}
    >
      <MessagingRatesView context={context} today={today} />
    </BillingFrame>
  );
}
