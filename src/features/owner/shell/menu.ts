import type { MenuRegistry } from "@/features/shared/shell/menu";
import type { Schemas } from "@/lib/api/types";
import { IconBank } from "@/ui/icons/glyphs/bank";
import { IconBell } from "@/ui/icons/glyphs/bell";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconBook } from "@/ui/icons/glyphs/book";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCalculator } from "@/ui/icons/glyphs/calculator";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconChart } from "@/ui/icons/glyphs/chart";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconChecklist } from "@/ui/icons/glyphs/checklist";
import { IconDashboard } from "@/ui/icons/glyphs/dashboard";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconInbox } from "@/ui/icons/glyphs/inbox";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconLetter } from "@/ui/icons/glyphs/letter";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconLoss } from "@/ui/icons/glyphs/loss";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconPercent } from "@/ui/icons/glyphs/percent";
import { IconPayment } from "@/ui/icons/glyphs/payment";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";
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
  // Reports (G6): exports, the operating insights and e-Tax — one section instead of a row of tabs.
  reports: {
    href: "/reports",
    icon: IconChart,
    group: "money",
    children: [
      { key: "exports", href: "/reports", label: "owner.reports.nav.exports", testId: "reports-tab-exports" },
      {
        key: "insights",
        href: "/reports/insights",
        label: "owner.reports.nav.insights",
        testId: "reports-tab-insights",
      },
      { key: "etax", href: "/reports/etax", label: "owner.reports.nav.etax", testId: "reports-tab-etax" },
    ],
  },
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
  // Pack J (JW1a): the juristic console — the co-owner register, the billing cycles of every frequency, budgets with
  // the resolutions that adopt them (one section, J-DESIGN §5 "งบประมาณและมติ").
  // The register, and (D-270) the units landlords of stub condos linked to this office — one section.
  juristic_register: {
    href: "/juristic/register",
    icon: IconBook,
    group: "operations",
    children: [
      {
        key: "register",
        href: "/juristic/register",
        label: "owner.juristic.nav.register",
        testId: "juristic-nav-register",
      },
      {
        key: "workspace",
        href: "/juristic/workspace",
        label: "owner.collections.nav.workspace",
        testId: "juristic-nav-workspace",
      },
    ],
  },
  juristic_cycles: { href: "/juristic/cycles", icon: IconCalendar, group: "money" },
  juristic_budgets: {
    href: "/juristic/budgets",
    icon: IconCalculator,
    group: "settings",
    children: [
      {
        key: "budgets",
        href: "/juristic/budgets",
        label: "owner.juristic.nav.budgets",
        testId: "juristic-nav-budgets",
      },
      {
        key: "resolutions",
        href: "/juristic/resolutions",
        label: "owner.juristic.nav.resolutions",
        testId: "juristic-nav-resolutions",
      },
    ],
  },
  // JW1b (J1.2a / J1.2b): money collection. Reports and auto-pay mandates have no menu key of their own (contract
  // request) and live under the receivables section; letters under statements; payment settings under the ladder.
  juristic_receivables: {
    href: "/juristic/receivables",
    icon: IconWallet,
    group: "operations",
    children: [
      {
        key: "receivables",
        href: "/juristic/receivables",
        label: "owner.collections.nav.receivables",
        testId: "juristic-nav-receivables",
      },
      {
        key: "reports",
        href: "/juristic/reports",
        label: "owner.collections.nav.reports",
        testId: "juristic-nav-reports",
      },
      {
        key: "mandates",
        href: "/juristic/payment-mandates",
        label: "owner.collections.nav.mandates",
        testId: "juristic-nav-mandates",
      },
    ],
  },
  juristic_payment_plans: { href: "/juristic/plans", icon: IconRepeat, group: "money" },
  juristic_debt_clearances: { href: "/juristic/debt-clearance", icon: IconReceipt, group: "money" },
  juristic_statements: {
    href: "/juristic/statements",
    icon: IconLetter,
    group: "money",
    children: [
      {
        key: "statements",
        href: "/juristic/statements",
        label: "owner.collections.nav.statements",
        testId: "juristic-nav-statements",
      },
      {
        key: "letters",
        href: "/juristic/statements/letters",
        label: "owner.collections.nav.letters",
        testId: "juristic-nav-letters",
      },
    ],
  },
  juristic_collection_ladder: {
    href: "/juristic/collections/settings",
    icon: IconChecklist,
    group: "settings",
    children: [
      {
        key: "ladder",
        href: "/juristic/collections/settings",
        label: "owner.collections.nav.ladder",
        testId: "juristic-nav-ladder",
      },
      {
        key: "payments",
        href: "/juristic/collections/payments",
        label: "owner.collections.nav.paymentSettings",
        testId: "juristic-nav-payment-settings",
      },
    ],
  },
  // D-270: a landlord invites its condo's juristic office for its units in a stub building.
  juristic_workspace_invitations: { href: "/juristic-office", icon: IconMail, group: "operations" },
  // JW4 (J4.1 / J4.2): the gate admin — gates and tablets, guards, house policies, blacklist, logs. `gate` is the same
  // page for apartment / PM tenants behind the API's `module.gate` flag.
  juristic_gate: { href: "/juristic/gate", icon: IconShield, group: "operations" },
  gate: { href: "/juristic/gate", icon: IconShield, group: "operations" },
};

export const OWNER_MENU_GROUPS = ["operations", "money", "settings"] as const;

/** Tenant types that run the juristic console (`condo_juristic` is the deprecated alias, D-302). */
export function isJuristicTenant(type: string | null | undefined): boolean {
  return type === "juristic" || type === "condo_juristic";
}

/**
 * A juristic tenant's rail (J-DESIGN §5): four groups in the office's order — daily work, money, vendors, settings and
 * system. Keys the API returns are placed by this table; the order inside a group is the table's. Keys not listed keep
 * the end of the group their registry entry names (mapped below), so nothing the member may open disappears. The
 * vendors group stays hidden until its keys exist (JW2).
 */
export const JURISTIC_MENU_GROUPS = ["daily", "finance", "vendors", "system"] as const;
export type JuristicMenuGroup = (typeof JURISTIC_MENU_GROUPS)[number];

export const JURISTIC_MENU_ORDER: Readonly<Record<JuristicMenuGroup, readonly string[]>> = {
  daily: [
    "dashboard",
    "juristic_receivables",
    "juristic_register",
    "juristic_gate",
    "service_requests",
    "buildings",
    "units",
    "parties",
    "announcements",
    "parcels",
    "access",
    "readings",
    "devices",
    "utility_loss",
    "leases",
    "deposits",
  ],
  finance: [
    "juristic_cycles",
    "juristic_statements",
    "juristic_debt_clearances",
    "juristic_payment_plans",
    "invoices",
    "payments",
    "rate_plans",
    "reports",
  ],
  vendors: [],
  system: ["juristic_budgets", "juristic_collection_ladder", "settings", "subscription"],
};

/** Where an unlisted key goes in the juristic rail: the registry's own group, renamed. */
const JURISTIC_GROUP_OF_OWNER_GROUP: Readonly<Record<string, JuristicMenuGroup>> = {
  operations: "daily",
  money: "finance",
  settings: "system",
};

/**
 * Entries the API grants a juristic tenant that read in apartment words: named for the office instead (the API's
 * `parties` are co-owners, payers and companies here, not "ผู้เช่าและคู่สัญญา"). Labels only — nothing is hidden.
 */
export const JURISTIC_LABEL_KEYS: ReadonlySet<string> = new Set(["parties"]);

/** The juristic overview answers "เช้านี้" for a juristic office (J-DESIGN §1.1: money first). */
const JURISTIC_HREF: Readonly<Record<string, string>> = { dashboard: "/juristic" };

/**
 * Re-groups and re-orders entitled items for a juristic tenant (pure: unit-tested). Items keep their labels and
 * children; `dashboard` points at the juristic overview.
 */
export function juristicLayout<Item extends { key: string; href: string; group: string }>(
  items: readonly Item[],
  prefix: (href: string) => string = (href) => href,
): Item[] {
  const rank = new Map<string, [number, number]>();
  JURISTIC_MENU_GROUPS.forEach((group, g) => JURISTIC_MENU_ORDER[group].forEach((key, k) => rank.set(key, [g, k])));
  const placed = items.map((item, index) => {
    const [group, position] = rank.get(item.key) ?? [
      JURISTIC_MENU_GROUPS.indexOf(JURISTIC_GROUP_OF_OWNER_GROUP[item.group] ?? "daily"),
      1000 + index,
    ];
    const href = JURISTIC_HREF[item.key];
    return {
      item: { ...item, group: JURISTIC_MENU_GROUPS[group]!, ...(href ? { href: prefix(href) } : {}) },
      group,
      position,
    };
  });
  return placed.sort((a, b) => a.group - b.group || a.position - b.position).map(({ item }) => item);
}

/**
 * Menu keys that are sections of the settings frame (G6): its own section list carries them, so the rail shows one
 * "ตั้งค่า" entry for all of them whenever the member is entitled to `settings`.
 */
export const SETTINGS_SECTION_KEYS: ReadonlySet<string> = new Set([
  "members",
  "bank_accounts",
  "notifications",
  "privacy",
  "access_grants",
  "support_access",
  "audit_log",
]);

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

/** A juristic office's phone bottom nav: this morning, the register, bills, money in (each when entitled). */
export const JURISTIC_BOTTOM_NAV = [
  { key: "dashboard", labelKey: "today" },
  { key: "juristic_register", labelKey: "register" },
  { key: "invoices", labelKey: "invoices" },
  { key: "payments", labelKey: "money" },
] as const;
