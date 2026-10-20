import { getTranslations } from "next-intl/server";

import { AiUsageView } from "@/features/admin/operations/AiUsageView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("ai_usage") };
}

/** AI usage per tenant (F5 5.1). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AiUsageView context={await adminContext()} searchParams={await searchParams} />;
}
