import { getTranslations } from "next-intl/server";

import { SubscriptionsView } from "@/features/admin/billing/SubscriptionsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("subscriptions") };
}

/** Subscriptions (F5 5.1). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SubscriptionsView context={await adminContext()} searchParams={await searchParams} />;
}
