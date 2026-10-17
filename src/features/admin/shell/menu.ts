import type { MenuDefinition } from "@/features/shared/shell/menu";

/** Platform admin routes per menu key (F5 builds the pages). */
export const ADMIN_MENU: Readonly<Record<string, MenuDefinition>> = {
  tenants: { href: "/tenants", icon: "building", group: "customers" },
  subscriptions: { href: "/subscriptions", icon: "wallet", group: "customers" },
  support_grants: { href: "/support", icon: "chat", group: "customers" },
  data_subject_requests: { href: "/privacy", icon: "shield", group: "customers" },
  utility_tariffs: { href: "/tariffs", icon: "electric", group: "platform" },
  devices: { href: "/devices", icon: "gateway", group: "platform" },
  notification_templates: { href: "/notification-templates", icon: "mail", group: "platform" },
  feature_flags: { href: "/feature-flags", icon: "flag", group: "platform" },
  settings: { href: "/settings", icon: "settings", group: "platform" },
  platform_users: { href: "/platform-users", icon: "residents", group: "operations" },
  outbox: { href: "/outbox", icon: "inbox", group: "operations" },
  integration_events: { href: "/integration-events", icon: "link", group: "operations" },
  audit_log: { href: "/audit", icon: "history", group: "operations" },
  ai_usage: { href: "/ai-usage", icon: "cpu", group: "operations" },
};

export const ADMIN_MENU_GROUPS = ["customers", "platform", "operations"] as const;
