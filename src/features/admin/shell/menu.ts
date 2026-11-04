import type { MenuDefinition, MenuRegistry } from "@/features/shared/shell/menu";
import type { AdminMe, Schemas } from "@/lib/api/types";
import { IconBook } from "@/ui/icons/glyphs/book";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconChart } from "@/ui/icons/glyphs/chart";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconCpu } from "@/ui/icons/glyphs/cpu";
import { IconDashboard } from "@/ui/icons/glyphs/dashboard";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconInbox } from "@/ui/icons/glyphs/inbox";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconSettings } from "@/ui/icons/glyphs/settings";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconSyncFailed } from "@/ui/icons/glyphs/sync-failed";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { can, type AdminPermission } from "../shared/permissions";

/** Platform admin routes per menu key (F5 builds the pages). */
export const ADMIN_MENU: MenuRegistry<Schemas["AdminMenuKey"]> = {
  tenants: { href: "/tenants", icon: IconBuilding, group: "customers" },
  subscriptions: {
    href: "/subscriptions",
    icon: IconWallet,
    group: "customers",
    children: (["invoices", "hardware", "field-work", "plans", "storage", "messaging", "fees"] as const).map((key) => ({
      key,
      href: `/subscriptions/${key}`,
      label: `admin.billing.tab.${key}`,
      testId: `billing-tab-${key}`,
    })),
  },
  listings: {
    href: "/listings",
    icon: IconHome,
    group: "customers",
    children: (["reviews", "media", "broadcasts", "handoffs"] as const).map((key) => ({
      key: `listings-${key}`,
      href: `/listings/${key}`,
      label: `admin.listings.tab.${key}`,
      testId: `listings-tab-${key}`,
    })),
  },
  support_grants: { href: "/support", icon: IconChat, group: "customers" },
  data_subject_requests: { href: "/privacy", icon: IconShield, group: "customers" },
  utility_tariffs: { href: "/tariffs", icon: IconElectric, group: "platform" },
  devices: { href: "/devices", icon: IconGateway, group: "platform" },
  ota_releases: { href: "/ota", icon: IconCpu, group: "platform" },
  guides: { href: "/guides", icon: IconBook, group: "platform" },
  notification_templates: { href: "/notification-templates", icon: IconMail, group: "platform" },
  feature_flags: { href: "/feature-flags", icon: IconFlag, group: "platform" },
  settings: { href: "/settings", icon: IconSettings, group: "platform" },
  outbox: { href: "/outbox", icon: IconInbox, group: "operations" },
  integration_events: { href: "/integration-events", icon: IconLink, group: "operations" },
  ingest_dead_letters: { href: "/ingest-dead-letters", icon: IconSyncFailed, group: "operations" },
  audit_log: { href: "/audit", icon: IconHistory, group: "operations" },
  ai_usage: { href: "/ai-usage", icon: IconChart, group: "operations" },
  platform_users: { href: "/platform-users", icon: IconResidents, group: "operations" },
};

export const ADMIN_MENU_GROUPS = ["customers", "platform", "operations"] as const;

/** The overview (the queues): always first in the column, for every platform user. */
export const ADMIN_HOME: MenuDefinition = { href: "/", icon: IconDashboard, group: "customers" };

/** Section pages a role may not open stay out of the column (docs/rbac.md); the API refuses them anyway. */
const CHILD_PERMISSIONS: Record<string, AdminPermission[]> = {
  "listings-reviews": ["admin.listing.moderate"],
  "listings-media": ["admin.listing.verify"],
  "listings-broadcasts": ["admin.tenant.read"],
  "listings-handoffs": ["admin.tenant.read"],
};

export function childAllowed(me: AdminMe, key: string): boolean {
  const needed = CHILD_PERMISSIONS[key];
  return !needed || needed.some((permission) => can(me, permission));
}
