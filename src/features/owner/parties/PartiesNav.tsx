import { getTranslations } from "next-intl/server";

import { ViewTabs } from "@/ui/components/ListToolbar";

import { ownerPath } from "../shared/links";
import { ownerCan, type OwnerContext } from "../shared/server";

type Current = "/parties" | "/parties/link-requests" | "/tm30";

/**
 * The People section's views (F2 2.2 + release fixes; view tabs since G3): parties · phone sign-ins waiting for the Owner
 * (D-226) · TM30 notifications (D-052, `tm30.manage` only). Counts come from the page that renders them.
 */
export async function PartiesNav({
  context,
  current,
  counts = {},
}: {
  context: OwnerContext;
  current: Current;
  counts?: Partial<Record<Current, number>>;
}) {
  const t = await getTranslations("owner.parties.nav");
  const { locale, me } = context;
  const tabs: { path: Current; key: string }[] = [
    { path: "/parties", key: "parties" },
    { path: "/parties/link-requests", key: "linkRequests" },
    ...(ownerCan(me, "tm30.manage") ? [{ path: "/tm30" as const, key: "tm30" }] : []),
  ];
  return (
    <ViewTabs
      label={t("label")}
      current={current}
      tabs={tabs.map((tab) => ({
        key: tab.path,
        href: ownerPath(locale, tab.path),
        label: t(tab.key),
        count: counts[tab.path],
        testId: `parties-tab-${tab.key}`,
      }))}
    />
  );
}
