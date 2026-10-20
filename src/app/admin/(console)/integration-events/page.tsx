import { getTranslations } from "next-intl/server";

import { IntegrationEventsView } from "@/features/admin/operations/IntegrationEventsView";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("integration_events") };
}

/** Integration events (B5 bridge) — awaiting its list endpoint. */
export default async function Page() {
  return <IntegrationEventsView />;
}
