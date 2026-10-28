import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { LinkTabs } from "@/ui/components/LinkTabs";

import { ownerPath } from "../shared/links";

const TABS = [
  { path: "/leases", key: "leases" },
  { path: "/contracts", key: "library" },
  { path: "/contracts/documents", key: "documents" },
  { path: "/renewals", key: "renewals" },
] as const;

export type ContractsSection = (typeof TABS)[number]["path"];

/**
 * The lease section's pages as link tabs (G3): leases · contract library · signable contracts · renewal offers. The
 * API's owner menu has no contracts key yet (contract request), so the library is reached from the leases page.
 */
export async function ContractsNav({ current, locale }: { current: ContractsSection; locale: Locale }) {
  const t = await getTranslations("owner.contracts.nav");
  return (
    <LinkTabs
      label={t("label")}
      current={ownerPath(locale, current)}
      tabs={TABS.map((tab) => ({
        href: ownerPath(locale, tab.path),
        label: t(tab.key),
        testId: `contracts-tab-${tab.key}`,
      }))}
    />
  );
}
