import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import type { OwnerMe, Schemas } from "@/lib/api/types";
import { LinkTabs } from "@/ui/components/LinkTabs";

import { ownerPath } from "../shared/links";

/** The settings pages in menu order, each shown when `/v1/owner/me.menu` entitles it. */
const PAGES: { key: Schemas["OwnerMenuKey"] | "sign_in"; path: string }[] = [
  { key: "settings", path: "/settings" },
  { key: "bank_accounts", path: "/settings/bank-accounts" },
  { key: "members", path: "/settings/members" },
  { key: "notifications", path: "/settings/notifications" },
  { key: "privacy", path: "/settings/privacy" },
  { key: "support_access", path: "/settings/support-access" },
  { key: "access_grants", path: "/settings/access-grants" },
  { key: "audit_log", path: "/settings/audit-log" },
  // Personal (D-255): every member manages their own ways to sign in.
  { key: "sign_in", path: "/settings/sign-in" },
];

export type SettingsPage = (typeof PAGES)[number]["path"];

/**
 * The settings section's sub-pages as link tabs (F2 2.6): general · bank accounts · members ·
 * notifications · privacy · support access · access grants · audit log — the ones the member's role
 * opens (the API's menu), so a manager never sees the bank account tab.
 */
export async function SettingsNav({ me, current, locale }: { me: OwnerMe; current: SettingsPage; locale: Locale }) {
  const t = await getTranslations("owner.settings.nav");
  const allowed = new Set(me.menu);
  return (
    <LinkTabs
      label={t("label")}
      current={ownerPath(locale, current)}
      tabs={PAGES.filter((page) => page.key === "sign_in" || allowed.has(page.key)).map((page) => ({
        href: ownerPath(locale, page.path),
        label: t(page.key),
        testId: `settings-tab-${page.key}`,
      }))}
    />
  );
}
