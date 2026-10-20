import { getTranslations } from "next-intl/server";

import { OutboxView } from "@/features/admin/operations/OutboxView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("outbox") };
}

/** Event outbox and failed deliveries with replay (F5 5.2). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OutboxView context={await adminContext()} searchParams={await searchParams} />;
}
