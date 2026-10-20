import { getTranslations } from "next-intl/server";

import { IntegrationEventsView } from "@/features/admin/operations/IntegrationEventsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("integration_events") };
}

/** Integration events of the bridge (B5, D-205): state, attempts, last error; filters in the URL. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <IntegrationEventsView context={await adminContext()} searchParams={await searchParams} />;
}
