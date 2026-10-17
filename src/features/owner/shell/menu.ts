import type { MenuDefinition } from "@/features/shared/shell/menu";

/** Owner console routes per menu key (F2 builds the pages; groups follow the morning-dashboard flow). */
export const OWNER_MENU: Readonly<Record<string, MenuDefinition>> = {
  dashboard: { href: "/dashboard", icon: "dashboard", group: "operations" },
  buildings: { href: "/buildings", icon: "building", group: "operations" },
  units: { href: "/units", icon: "room", group: "operations" },
  parties: { href: "/parties", icon: "residents", group: "operations" },
  leases: { href: "/leases", icon: "lease", group: "operations" },
  deposits: { href: "/deposits", icon: "wallet", group: "operations" },
  readings: { href: "/meters", icon: "meter", group: "operations" },
  utility_loss: { href: "/loss", icon: "loss", group: "operations" },
  service_requests: { href: "/service-requests", icon: "staff", group: "operations" },
  parcels: { href: "/parcels", icon: "parcel", group: "operations" },
  announcements: { href: "/announcements", icon: "megaphone", group: "operations" },
  rate_plans: { href: "/billing/rate-plans", icon: "tag", group: "money" },
  invoices: { href: "/invoices", icon: "bill", group: "money" },
  payments: { href: "/payments", icon: "payment", group: "money" },
  reports: { href: "/reports", icon: "chart", group: "money" },
  members: { href: "/settings/members", icon: "residents", group: "settings" },
  bank_accounts: { href: "/settings/bank-accounts", icon: "bank", group: "settings" },
  settings: { href: "/settings", icon: "settings", group: "settings" },
  notifications: { href: "/settings/notifications", icon: "bell", group: "settings" },
  privacy: { href: "/settings/privacy", icon: "shield", group: "settings" },
  access_grants: { href: "/settings/access-grants", icon: "key", group: "settings" },
  support_access: { href: "/settings/support-access", icon: "chat", group: "settings" },
  audit_log: { href: "/settings/audit-log", icon: "history", group: "settings" },
  subscription: { href: "/subscription", icon: "wallet", group: "settings" },
};

export const OWNER_MENU_GROUPS = ["operations", "money", "settings"] as const;

/** The phone bottom nav (F1 1.3): Today, Units, Invoices, Money, More — each shown only when entitled. */
export const OWNER_BOTTOM_NAV = [
  { key: "dashboard", labelKey: "today" },
  { key: "units", labelKey: "units" },
  { key: "invoices", labelKey: "invoices" },
  { key: "payments", labelKey: "money" },
] as const;
