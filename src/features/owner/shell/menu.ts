import type { MenuRegistry } from "@/features/shared/shell/menu";
import type { Schemas } from "@/lib/api/types";
import { IconBank } from "@/ui/icons/glyphs/bank";
import { IconBell } from "@/ui/icons/glyphs/bell";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconChart } from "@/ui/icons/glyphs/chart";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconDashboard } from "@/ui/icons/glyphs/dashboard";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconInbox } from "@/ui/icons/glyphs/inbox";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconLoss } from "@/ui/icons/glyphs/loss";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconPercent } from "@/ui/icons/glyphs/percent";
import { IconPayment } from "@/ui/icons/glyphs/payment";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconRoom } from "@/ui/icons/glyphs/room";
import { IconSettings } from "@/ui/icons/glyphs/settings";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconSign } from "@/ui/icons/glyphs/sign";
import { IconStaff } from "@/ui/icons/glyphs/staff";
import { IconSwap } from "@/ui/icons/glyphs/swap";
import { IconTag } from "@/ui/icons/glyphs/tag";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

/** Owner console routes per menu key (F2 builds the pages; groups follow the morning-dashboard flow). */
export const OWNER_MENU: MenuRegistry<Schemas["OwnerMenuKey"]> = {
  portfolio: { href: "/portfolio", icon: IconHome, group: "operations" },
  // Listings (G5): my listings, promotion (boosts, photo services), LINE broadcasts and reviews — no owner menu keys for
  // promotion or reviews in the API yet (contract request), so they live under listings instead of header buttons.
  listings: {
    href: "/listings",
    icon: IconMegaphone,
    group: "operations",
    children: [
      { key: "listings", href: "/listings", label: "owner.listings.nav.mine" },
      { key: "promote", href: "/promote", label: "owner.listings.nav.promote", testId: "listing-promotion" },
      {
        key: "broadcasts",
        href: "/promote/broadcasts",
        label: "owner.listings.nav.broadcasts",
        testId: "promote-tab-broadcasts",
      },
      { key: "reviews", href: "/reviews", label: "owner.listings.nav.reviews", testId: "listing-reviews" },
    ],
  },
  // Enquiries (G5): the inbox and the week of viewings.
  leads: {
    href: "/leads",
    icon: IconInbox,
    group: "operations",
    children: [
      { key: "inbox", href: "/leads", label: "owner.leads.nav.inbox" },
      { key: "viewings", href: "/leads/viewings", label: "owner.leads.nav.viewings", testId: "leads-calendar" },
    ],
  },
  dashboard: { href: "/dashboard", icon: IconDashboard, group: "operations" },
  buildings: { href: "/buildings", icon: IconBuilding, group: "operations" },
  units: { href: "/units", icon: IconRoom, group: "operations" },
  parties: { href: "/parties", icon: IconResidents, group: "operations" },
  leases: {
    href: "/leases",
    icon: IconLease,
    group: "operations",
    // The lease section's pages (G3): no contracts / employer menu keys in the API yet, so they live under leases.
    children: [
      { key: "leases", href: "/leases", label: "owner.contracts.nav.leases", testId: "contracts-tab-leases" },
      { key: "library", href: "/contracts", label: "owner.contracts.nav.library", testId: "contracts-tab-library" },
      {
        key: "documents",
        href: "/contracts/documents",
        label: "owner.contracts.nav.documents",
        testId: "contracts-tab-documents",
      },
      { key: "renewals", href: "/renewals", label: "owner.contracts.nav.renewals", testId: "contracts-tab-renewals" },
      {
        key: "employers",
        href: "/employers",
        label: "owner.contracts.nav.employers",
        testId: "contracts-tab-employers",
      },
    ],
  },
  deposits: { href: "/deposits", icon: IconWallet, group: "operations" },
  // Meters (G4): the meter points and the readings waiting for a check.
  readings: {
    href: "/meters",
    icon: IconMeter,
    group: "operations",
    children: [
      { key: "meters", href: "/meters", label: "owner.meters.nav.meters", testId: "meters-tab-meters" },
      { key: "reviews", href: "/meters/reviews", label: "owner.meters.nav.reviews", testId: "meters-nav-reviews" },
    ],
  },
  devices: { href: "/devices", icon: IconGateway, group: "operations" },
  utility_loss: { href: "/loss", icon: IconLoss, group: "operations" },
  // Repairs (G4): the request queue, work orders, planned maintenance and the categories' SLA — one section.
  service_requests: {
    href: "/service-requests",
    icon: IconStaff,
    group: "operations",
    children: [
      {
        key: "requests",
        href: "/service-requests",
        label: "owner.service.nav.requests",
        testId: "service-tab-requests",
      },
      {
        key: "workOrders",
        href: "/work-orders",
        label: "owner.service.nav.workOrders",
        testId: "service-tab-workOrders",
      },
      {
        key: "maintenance",
        href: "/maintenance",
        label: "owner.service.nav.maintenance",
        testId: "service-tab-maintenance",
      },
      {
        key: "categories",
        href: "/service-categories",
        label: "owner.service.nav.categories",
        testId: "service-tab-categories",
      },
    ],
  },
  access: { href: "/access", icon: IconLock, group: "operations" },
  parcels: { href: "/parcels", icon: IconParcel, group: "operations" },
  // Community (G4): announcements with the building's facilities, house rules and contacts under the same entry.
  announcements: {
    href: "/announcements",
    icon: IconMegaphone,
    group: "operations",
    children: [
      {
        key: "announcements",
        href: "/announcements",
        label: "owner.community.nav.announcements",
        testId: "community-tab-announcements",
      },
      {
        key: "facilities",
        href: "/community/facilities",
        label: "owner.community.nav.facilities",
        testId: "community-tab-facilities",
      },
      { key: "rules", href: "/community/rules", label: "owner.community.nav.rules", testId: "community-tab-rules" },
      {
        key: "contacts",
        href: "/community/contacts",
        label: "owner.community.nav.contacts",
        testId: "community-tab-contacts",
      },
    ],
  },
  rate_plans: { href: "/billing/rate-plans", icon: IconTag, group: "money" },
  // Billing (G3): the month's cycle and every invoice, one section instead of a row of tabs.
  invoices: {
    href: "/invoices",
    icon: IconBill,
    group: "money",
    children: [
      { key: "billing", href: "/billing", label: "owner.common.money.tab.billing" },
      { key: "invoices", href: "/invoices", label: "owner.common.money.tab.invoices" },
    ],
  },
  // Money in (G3): payments (with the slips and held payments as its views), arrears, credits, documents.
  payments: {
    href: "/payments",
    icon: IconPayment,
    group: "money",
    children: [
      { key: "payments", href: "/payments", label: "owner.common.money.tab.payments" },
      { key: "arrears", href: "/arrears", label: "owner.common.money.tab.arrears" },
      { key: "credits", href: "/payments/credits", label: "owner.common.money.tab.credits" },
      { key: "documents", href: "/documents", label: "owner.common.money.tab.documents" },
    ],
  },
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
  // Agency workspace (G2, D-293): an agency's mandated units and co-broke; mandates and deals for owners too.
  mandated_units: { href: "/mandated-units", icon: IconKey, group: "operations" },
  mandates: { href: "/mandates", icon: IconSign, group: "operations" },
  co_broke: { href: "/co-broke", icon: IconSwap, group: "operations" },
  deals: { href: "/deals", icon: IconPercent, group: "operations" },
};

export const OWNER_MENU_GROUPS = ["operations", "money", "settings"] as const;

/**
 * The phone bottom nav (F1 1.3): Today, Units, Invoices, Money, More — each shown only when entitled. Landlords
 * (B7.1) have no building dashboard: their first tab is the portfolio; an agency (G2) starts at its mandated units.
 */
export const OWNER_BOTTOM_NAV = [
  { key: "mandated_units", labelKey: "mandatedUnits" },
  { key: "portfolio", labelKey: "portfolio" },
  { key: "leads", labelKey: "leads" },
  { key: "dashboard", labelKey: "today" },
  { key: "units", labelKey: "units" },
  { key: "invoices", labelKey: "invoices" },
  { key: "payments", labelKey: "money" },
] as const;
