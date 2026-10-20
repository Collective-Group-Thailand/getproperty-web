import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { LinkTabs } from "@/ui/components/LinkTabs";

import { ownerPath } from "../shared/links";

const TABS = [
  { path: "/service-requests", key: "requests" },
  { path: "/work-orders", key: "workOrders" },
  { path: "/maintenance", key: "maintenance" },
  { path: "/service-categories", key: "categories" },
] as const;

export type ServiceTab = (typeof TABS)[number]["path"];

/** The service section's pages (F2 2.7): requests · work orders · maintenance plans · categories & SLA. */
export async function ServiceNav({
  current,
  locale,
  counts = {},
}: {
  current: ServiceTab;
  locale: Locale;
  counts?: Partial<Record<ServiceTab, number>>;
}) {
  const t = await getTranslations("owner.service.nav");
  return (
    <LinkTabs
      label={t("label")}
      current={ownerPath(locale, current)}
      tabs={TABS.map((tab) => ({
        href: ownerPath(locale, tab.path),
        label: t(tab.key),
        count: counts[tab.path],
        testId: `service-tab-${tab.key}`,
      }))}
    />
  );
}
