import { getTranslations } from "next-intl/server";

import { BillingFrame } from "@/features/admin/billing/SubscriptionsView";
import { InvoicesTable } from "@/features/admin/billing/InvoicesView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.billing.tab");
  return { title: t("invoices") };
}

/** Subscriptions — invoices (F5 5.1). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query, t] = await Promise.all([adminContext(), searchParams, getTranslations("admin.billing")]);
  return (
    <BillingFrame current="invoices" title={t("tab.invoices")} description={t("description.invoices")}>
      <InvoicesTable context={context} searchParams={query} path="/subscriptions/invoices" />
    </BillingFrame>
  );
}
