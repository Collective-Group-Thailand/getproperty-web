import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { LinkTabs } from "@/ui/components/LinkTabs";

import { ownerPath } from "../shared/links";

const TABS = [
  { path: "/announcements", key: "announcements" },
  { path: "/parcels", key: "parcels" },
  { path: "/community/facilities", key: "facilities" },
  { path: "/community/rules", key: "rules" },
  { path: "/community/contacts", key: "contacts" },
] as const;

export type CommunityTab = (typeof TABS)[number]["path"];

/** The building's community pages (F2 2.7, D-073): announcements · parcels · facilities · rules · contacts. */
export async function CommunityNav({
  current,
  locale,
  counts = {},
}: {
  current: CommunityTab;
  locale: Locale;
  counts?: Partial<Record<CommunityTab, number>>;
}) {
  const t = await getTranslations("owner.community.nav");
  return (
    <LinkTabs
      label={t("label")}
      current={ownerPath(locale, current)}
      tabs={TABS.map((tab) => ({
        href: ownerPath(locale, tab.path),
        label: t(tab.key),
        count: counts[tab.path],
        testId: `community-tab-${tab.key}`,
      }))}
    />
  );
}
