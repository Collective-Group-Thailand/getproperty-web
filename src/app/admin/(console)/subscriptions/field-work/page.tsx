import { getTranslations } from "next-intl/server";

import { BillingFrame } from "@/features/admin/billing/SubscriptionsView";
import { FieldWork } from "@/features/admin/billing/FieldWorkView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.billing.tab");
  return { title: t("field-work") };
}

/** Subscriptions — field-work (F5 5.1). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query, t] = await Promise.all([adminContext(), searchParams, getTranslations("admin.billing")]);
  return (
    <BillingFrame current="field-work" title={t("tab.field-work")} description={t("description.field-work")}>
      <FieldWork context={context} searchParams={query} path="/subscriptions/field-work" />
    </BillingFrame>
  );
}
