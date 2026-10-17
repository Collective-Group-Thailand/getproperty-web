import type { MenuRegistry } from "@/features/shared/shell/menu";
import type { Schemas } from "@/lib/api/types";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconCpu } from "@/ui/icons/glyphs/cpu";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconInbox } from "@/ui/icons/glyphs/inbox";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconSettings } from "@/ui/icons/glyphs/settings";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

/** Platform admin routes per menu key (F5 builds the pages). */
export const ADMIN_MENU: MenuRegistry<Schemas["AdminMenuKey"]> = {
  tenants: { href: "/tenants", icon: IconBuilding, group: "customers" },
  subscriptions: { href: "/subscriptions", icon: IconWallet, group: "customers" },
  support_grants: { href: "/support", icon: IconChat, group: "customers" },
  data_subject_requests: { href: "/privacy", icon: IconShield, group: "customers" },
  utility_tariffs: { href: "/tariffs", icon: IconElectric, group: "platform" },
  devices: { href: "/devices", icon: IconGateway, group: "platform" },
  ota_releases: { href: "/ota", icon: IconCpu, group: "platform" },
  notification_templates: { href: "/notification-templates", icon: IconMail, group: "platform" },
  feature_flags: { href: "/feature-flags", icon: IconFlag, group: "platform" },
  settings: { href: "/settings", icon: IconSettings, group: "platform" },
  platform_users: { href: "/platform-users", icon: IconResidents, group: "operations" },
  outbox: { href: "/outbox", icon: IconInbox, group: "operations" },
  ingest_dead_letters: { href: "/ingest-dead-letters", icon: IconInbox, group: "operations" },
  integration_events: { href: "/integration-events", icon: IconLink, group: "operations" },
  audit_log: { href: "/audit", icon: IconHistory, group: "operations" },
  ai_usage: { href: "/ai-usage", icon: IconCpu, group: "operations" },
};

export const ADMIN_MENU_GROUPS = ["customers", "platform", "operations"] as const;
