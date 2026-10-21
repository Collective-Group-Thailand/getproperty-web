import { getTranslations } from "next-intl/server";

import { LinkTabs } from "@/ui/components/LinkTabs";

import { ownerPath } from "../shared/links";
import type { OwnerContext } from "../shared/server";

type Current = "/reports" | "/reports/insights" | "/reports/etax";

/**
 * The Reports section's sub-pages: exports · insights (B6.3, D-217) · e-Tax (B6.2, D-215 — VAT-registered
 * tenants only, the API only submits their documents). The menu has one `reports` key (contract
 * `OwnerMenuKey`), so these are tabs of it.
 */
export async function ReportsNav({
  context,
  current,
  vatRegistered,
  counts = {},
}: {
  context: OwnerContext;
  current: Current;
  vatRegistered: boolean;
  counts?: Partial<Record<Current, number>>;
}) {
  const t = await getTranslations("owner.reports.nav");
  const tabs: { path: Current; key: string }[] = [
    { path: "/reports", key: "exports" },
    { path: "/reports/insights", key: "insights" },
    ...(vatRegistered ? [{ path: "/reports/etax" as const, key: "etax" }] : []),
  ];
  return (
    <LinkTabs
      label={t("label")}
      current={ownerPath(context.locale, current)}
      tabs={tabs.map((tab) => ({
        href: ownerPath(context.locale, tab.path),
        label: t(tab.key),
        count: counts[tab.path],
        testId: `reports-tab-${tab.key}`,
      }))}
    />
  );
}
