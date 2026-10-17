import type { MenuDefinition } from "@/features/shared/shell/menu";
import { IconBank } from "@/ui/icons/glyphs/bank";
import { IconBell } from "@/ui/icons/glyphs/bell";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconChart } from "@/ui/icons/glyphs/chart";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconDashboard } from "@/ui/icons/glyphs/dashboard";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconLoss } from "@/ui/icons/glyphs/loss";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconPayment } from "@/ui/icons/glyphs/payment";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconRoom } from "@/ui/icons/glyphs/room";
import { IconSettings } from "@/ui/icons/glyphs/settings";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconStaff } from "@/ui/icons/glyphs/staff";
import { IconTag } from "@/ui/icons/glyphs/tag";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

/** Owner console routes per menu key (F2 builds the pages; groups follow the morning-dashboard flow). */
export const OWNER_MENU: Readonly<Record<string, MenuDefinition>> = {
  dashboard: { href: "/dashboard", icon: IconDashboard, group: "operations" },
  buildings: { href: "/buildings", icon: IconBuilding, group: "operations" },
  units: { href: "/units", icon: IconRoom, group: "operations" },
  parties: { href: "/parties", icon: IconResidents, group: "operations" },
  leases: { href: "/leases", icon: IconLease, group: "operations" },
  deposits: { href: "/deposits", icon: IconWallet, group: "operations" },
  readings: { href: "/meters", icon: IconMeter, group: "operations" },
  utility_loss: { href: "/loss", icon: IconLoss, group: "operations" },
  service_requests: { href: "/service-requests", icon: IconStaff, group: "operations" },
  parcels: { href: "/parcels", icon: IconParcel, group: "operations" },
  announcements: { href: "/announcements", icon: IconMegaphone, group: "operations" },
  rate_plans: { href: "/billing/rate-plans", icon: IconTag, group: "money" },
  invoices: { href: "/invoices", icon: IconBill, group: "money" },
  payments: { href: "/payments", icon: IconPayment, group: "money" },
  reports: { href: "/reports", icon: IconChart, group: "money" },
  members: { href: "/settings/members", icon: IconResidents, group: "settings" },
  bank_accounts: { href: "/settings/bank-accounts", icon: IconBank, group: "settings" },
  settings: { href: "/settings", icon: IconSettings, group: "settings" },
  notifications: { href: "/settings/notifications", icon: IconBell, group: "settings" },
  privacy: { href: "/settings/privacy", icon: IconShield, group: "settings" },
  access_grants: { href: "/settings/access-grants", icon: IconKey, group: "settings" },
  support_access: { href: "/settings/support-access", icon: IconChat, group: "settings" },
  audit_log: { href: "/settings/audit-log", icon: IconHistory, group: "settings" },
  subscription: { href: "/subscription", icon: IconWallet, group: "settings" },
};

export const OWNER_MENU_GROUPS = ["operations", "money", "settings"] as const;

/** The phone bottom nav (F1 1.3): Today, Units, Invoices, Money, More — each shown only when entitled. */
export const OWNER_BOTTOM_NAV = [
  { key: "dashboard", labelKey: "today" },
  { key: "units", labelKey: "units" },
  { key: "invoices", labelKey: "invoices" },
  { key: "payments", labelKey: "money" },
] as const;
