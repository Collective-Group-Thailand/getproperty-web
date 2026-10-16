import { getTranslations } from "next-intl/server";

import type { Zone } from "@/lib/zones";
import { Wordmark } from "@/ui/brand";
import { AppShell, BottomNav, SidebarNav, TopBar, type NavItem } from "@/ui/components/AppShell";
import { Callout } from "@/ui/components/Callout";
import { Icon, type IconName } from "@/ui/icons";

import { ZoneThemeToggle } from "./ZoneThemeToggle";

/** The F0 placeholder navigation per zone: labels from `src/i18n`, links to routes F1–F5 create. */
const NAV: Record<Zone, { key: string; href: string; icon: IconName }[]> = {
  owner: [
    { key: "dashboard", href: "/", icon: "dashboard" },
    { key: "properties", href: "/properties", icon: "building" },
    { key: "leases", href: "/leases", icon: "lease" },
    { key: "billing", href: "/billing", icon: "bill" },
    { key: "payments", href: "/payments", icon: "payment" },
    { key: "meters", href: "/meters", icon: "meter" },
    { key: "settings", href: "/settings", icon: "settings" },
  ],
  staff: [
    { key: "today", href: "/", icon: "ticket" },
    { key: "readings", href: "/readings", icon: "meter" },
    { key: "inspections", href: "/inspections", icon: "camera" },
    { key: "devices", href: "/devices", icon: "gateway" },
    { key: "tickets", href: "/tickets", icon: "staff" },
  ],
  admin: [
    { key: "tenants", href: "/tenants", icon: "building" },
    { key: "subscriptions", href: "/subscriptions", icon: "wallet" },
    { key: "tariffs", href: "/tariffs", icon: "electric" },
    { key: "devices", href: "/devices", icon: "gateway" },
    { key: "support", href: "/support", icon: "chat" },
    { key: "audit", href: "/audit", icon: "shield" },
  ],
};

/**
 * The placeholder page of each zone (F0 0.1, rebuilt on `src/ui` AppShell in 0.2): the zone's name,
 * the wordmark, the zone's future navigation. Owner and admin get a sidebar; staff gets a phone
 * column with a bottom nav. F1 replaces this with the real shells.
 */
export async function PlaceholderShell({ zone }: { zone: Zone }) {
  const t = await getTranslations("shell");
  const nav = await getTranslations(`${zone}.nav`);
  const items: NavItem[] = NAV[zone].map((item, index) => ({
    href: item.href,
    label: nav(item.key),
    icon: <Icon name={item.icon} />,
    active: index === 0,
  }));
  const console_ = zone === "owner" || zone === "admin";
  const zoneName = t(`placeholder.zone.${zone}`);

  return (
    <AppShell
      skipLabel={t("skipToContent")}
      sidebarLabel={t("mainNav")}
      variant={console_ ? "console" : "mobile"}
      header={
        <TopBar>
          <Wordmark size="sm" />
          <span className="text-muted text-sm">{zoneName}</span>
          <span className="ms-auto">
            <ZoneThemeToggle />
          </span>
        </TopBar>
      }
      sidebar={console_ ? <SidebarNav items={items} /> : undefined}
      bottomNav={console_ ? undefined : <BottomNav items={items} label={t("bottomNav")} />}
    >
      <div
        className="max-w-form mx-auto flex flex-col gap-6 px-4 py-10"
        data-testid="zone-placeholder"
        data-zone={zone}
      >
        <Wordmark size="lg" />
        <h1 className="text-3xl">{t("placeholder.title", { zone: zoneName })}</h1>
        <Callout tone="neutral">{t("placeholder.body")}</Callout>
      </div>
    </AppShell>
  );
}
