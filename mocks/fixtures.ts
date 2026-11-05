import type { components } from "../src/lib/api/schema";

type Schemas = components["schemas"];

/**
 * Mock personas for `pnpm dev:mock` and the e2e suite. Every shape is a generated contract type, so a
 * contract change breaks the mocks at compile time instead of letting them drift. Phone numbers are
 * test numbers (`+6681000000x`), never real ones. The OTP code and the authenticator code are always
 * `123456`; the password of every persona is `correct horse battery staple`.
 */

export const MOCK_OTP_CODE = "123456";
export const MOCK_TOTP_CODE = "123456";
export const MOCK_PASSWORD = "correct horse battery staple";

export interface MockTenant {
  profile: Schemas["OperatorTenantDto"];
  subscription: Schemas["SubscriptionSummaryDto"];
}

export const TENANTS = {
  sample: {
    profile: {
      id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11",
      displayName: "หอพักตัวอย่าง",
      type: "apartment",
      status: "active",
      role: "owner",
    },
    subscription: { plan: "apartment_starter", state: "active", readOnly: false },
  },
  branch: {
    profile: {
      id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c22",
      displayName: "อาคารสาขาสอง",
      type: "pm_company",
      status: "active",
      role: "manager",
    },
    subscription: { plan: "pm_portfolio", state: "active", readOnly: false },
  },
  suspended: {
    profile: {
      id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c33",
      displayName: "หอพักระงับชั่วคราว",
      type: "apartment",
      status: "read_only",
      role: "owner",
    },
    subscription: { plan: "apartment_starter", state: "suspended", readOnly: true },
  },
  /** A landlord with a few units (B7.1): the portfolio-first console. */
  landlord: {
    profile: {
      id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c44",
      displayName: "มาลี มีสุข",
      type: "landlord",
      status: "active",
      role: "owner",
    },
    subscription: { plan: null, state: "active", readOnly: false },
  },
  /** The landlord tenant `POST /v1/public/signup/landlord` creates in the mock (empty portfolio). */
  fresh: {
    profile: {
      id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c55",
      displayName: "เจ้าของใหม่",
      type: "landlord",
      status: "active",
      role: "owner",
    },
    subscription: { plan: null, state: "active", readOnly: false },
  },
  /** An estate agency (G2, D-284, D-293): works on the units owners mandated to it. */
  agency: {
    profile: {
      id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c66",
      displayName: "บ้านดี พร็อพเพอร์ตี้",
      type: "agency",
      status: "active",
      role: "owner",
    },
    subscription: { plan: null, state: "active", readOnly: false },
  },
  /** The agency tenant `POST /v1/public/signup/agency` creates in the mock. */
  freshAgency: {
    profile: {
      id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c77",
      displayName: "นายหน้าใหม่",
      type: "agency",
      status: "active",
      role: "owner",
    },
    subscription: { plan: null, state: "active", readOnly: false },
  },
  /**
   * A juristic person (pack J, D-302): a condominium run under the Condominium Act and a housing estate under the Land
   * Allocation Act in one tenant — the JW1 console (register, budgets and resolutions, rates, cycles).
   */
  juristic: {
    profile: {
      id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c88",
      displayName: "นิติบุคคล เดอะ ริเวอร์ไซด์",
      type: "juristic",
      status: "active",
      role: "owner",
    },
    subscription: { plan: null, state: "active", readOnly: false },
  },
} as const satisfies Record<string, MockTenant>;

export type TenantKey = keyof typeof TENANTS;

/** Owner-console menu keys per role (getproperty-api `src/core/rbac/menu.ts` as of contract 0.1.0). */
const OWNER_MENU_BY_ROLE: Record<Schemas["TenantRole"], string[]> = {
  owner: [
    "dashboard",
    "buildings",
    "units",
    "parties",
    "leases",
    "deposits",
    "readings",
    "rate_plans",
    "invoices",
    "payments",
    "reports",
    "utility_loss",
    "service_requests",
    "access",
    "parcels",
    "announcements",
    "members",
    "bank_accounts",
    "settings",
    "notifications",
    "privacy",
    "access_grants",
    "support_access",
    "audit_log",
    "subscription",
  ],
  manager: [
    "dashboard",
    "buildings",
    "units",
    "parties",
    "leases",
    "deposits",
    "readings",
    "invoices",
    "payments",
    "reports",
    "utility_loss",
    "service_requests",
    "access",
    "parcels",
    "announcements",
    "members",
    "settings",
  ],
  accountant: ["dashboard", "invoices", "payments", "deposits", "reports"],
  staff: ["readings", "service_requests", "parcels"],
  // D-320: juristic tenants only (their menu comes from `JURISTIC_MENU_BY_ROLE`).
  committee: [],
  auditor: [],
};

/**
 * A juristic tenant's owner-console keys per role, in the API's order (`OWNER_MENU` of `src/core/rbac/menu.ts` at
 * ed938f2, filtered by the role's permissions and the `juristic` tenant type).
 */
const JURISTIC_MENU_BY_ROLE: Record<Schemas["TenantRole"], string[]> = {
  owner: [
    "dashboard",
    "buildings",
    "units",
    "parties",
    "leases",
    "readings",
    "rate_plans",
    "invoices",
    "payments",
    "reports",
    "service_requests",
    "juristic_register",
    "juristic_cycles",
    "juristic_budgets",
    "juristic_payment_plans",
    "juristic_debt_clearances",
    "juristic_receivables",
    "juristic_statements",
    "juristic_collection_ladder",
    "juristic_gate",
    "members",
    "bank_accounts",
    "settings",
    "notifications",
    "privacy",
    "audit_log",
    "subscription",
  ],
  manager: [
    "dashboard",
    "buildings",
    "units",
    "parties",
    "invoices",
    "payments",
    "reports",
    "juristic_register",
    "juristic_cycles",
    "juristic_budgets",
    "juristic_payment_plans",
    "juristic_debt_clearances",
    "juristic_receivables",
    "juristic_statements",
    "juristic_collection_ladder",
    "juristic_gate",
    "members",
    "settings",
  ],
  accountant: [
    "dashboard",
    "invoices",
    "payments",
    "reports",
    "juristic_register",
    "juristic_cycles",
    "juristic_budgets",
  ],
  staff: ["juristic_register", "juristic_gate"],
  committee: [
    "dashboard",
    "buildings",
    "units",
    "parties",
    "rate_plans",
    "invoices",
    "payments",
    "reports",
    "juristic_register",
    "juristic_cycles",
    "juristic_budgets",
    "juristic_payment_plans",
    "juristic_debt_clearances",
    "juristic_receivables",
    "juristic_statements",
    "juristic_collection_ladder",
    "juristic_gate",
    "settings",
  ],
  auditor: [
    "dashboard",
    "buildings",
    "units",
    "parties",
    "rate_plans",
    "invoices",
    "payments",
    "reports",
    "juristic_register",
    "juristic_cycles",
    "juristic_budgets",
    "juristic_payment_plans",
    "juristic_debt_clearances",
    "juristic_receivables",
    "juristic_statements",
    "juristic_collection_ladder",
    "settings",
    "audit_log",
  ],
};
/** Staff PWA menu keys per role (`STAFF_MENU` of the API's `src/core/rbac/menu.ts`, D-180). */
const STAFF_MENU_BY_ROLE: Record<Schemas["TenantRole"], Schemas["StaffMenuKey"][]> = {
  owner: ["readings", "reading_rounds", "inspections", "installs", "service_requests", "parcels"],
  manager: ["readings", "reading_rounds", "inspections", "installs", "service_requests", "parcels"],
  accountant: [],
  staff: ["readings", "reading_rounds", "inspections", "installs", "service_requests", "parcels"],
  committee: [],
  auditor: [],
};

/** Owner menu keys only building operators get (`BUILDING_OPERATORS` in the API's menu.ts, B7.1). */
const BUILDING_OPERATOR_ONLY = new Set([
  "dashboard",
  "buildings",
  "units",
  "devices",
  "utility_loss",
  "access",
  "parcels",
  "announcements",
]);

export function menuFor(
  surface: "owner" | "staff",
  role: Schemas["TenantRole"],
  tenantType: Schemas["OperatorTenantDto"]["type"] = "apartment",
): string[] {
  if (surface === "owner" && tenantType === "juristic") return JURISTIC_MENU_BY_ROLE[role];
  const menu = (surface === "owner" ? OWNER_MENU_BY_ROLE : STAFF_MENU_BY_ROLE)[role];
  if (surface !== "owner" || (tenantType !== "landlord" && tenantType !== "agency")) return menu;
  const rest = menu.filter((key) => !BUILDING_OPERATOR_ONLY.has(key));
  // G2 (D-293): landlords see their mandates and deals; an agency works from its mandated units.
  const listingRole = role === "owner" || role === "manager";
  if (tenantType === "agency")
    return listingRole ? ["mandated_units", "listings", "leads", "mandates", "co_broke", "deals", ...rest] : rest;
  // D-270 (J1.2b): a landlord with `tenant.grant.manage` invites its condo's juristic office.
  const invite = rest.includes("access_grants") ? ["juristic_workspace_invitations"] : [];
  return ["portfolio", "listings", "leads", ...(listingRole ? ["mandates", "deals"] : []), ...invite, ...rest];
}

export interface OperatorPersona {
  key: string;
  user: Schemas["MeUserDto"];
  /** Tenants with this persona's role in each. */
  memberships: { tenant: TenantKey; role: Schemas["TenantRole"] }[];
  password?: string;
  totp?: boolean;
}

export const OPERATORS: OperatorPersona[] = [
  {
    key: "owner",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a901",
      displayName: "สมชาย ทดสอบ",
      phone: "+66810000001",
      email: "owner@example.com",
      language: "th",
      lineLinked: false,
    },
    memberships: [{ tenant: "sample", role: "owner" }],
    password: MOCK_PASSWORD,
  },
  {
    key: "multi",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a902",
      displayName: "สมหญิง หลายองค์กร",
      phone: "+66810000002",
      email: "multi@example.com",
      language: "th",
      lineLinked: false,
    },
    memberships: [
      { tenant: "sample", role: "owner" },
      { tenant: "branch", role: "manager" },
    ],
  },
  {
    key: "suspended",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a903",
      displayName: "สมปอง ระงับ",
      phone: "+66810000003",
      email: null,
      language: "th",
      lineLinked: false,
    },
    memberships: [{ tenant: "suspended", role: "owner" }],
  },
  {
    key: "staff",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a904",
      displayName: "สมศักดิ์ ช่างประจำ",
      phone: "+66810000004",
      email: null,
      language: "en",
      lineLinked: false,
    },
    memberships: [{ tenant: "sample", role: "staff" }],
  },
  {
    key: "totp",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a905",
      displayName: "สมใจ สองขั้นตอน",
      phone: "+66810000005",
      email: "totp@example.com",
      language: "th",
      lineLinked: false,
    },
    memberships: [{ tenant: "sample", role: "manager" }],
    password: MOCK_PASSWORD,
    totp: true,
  },
  {
    key: "landlord",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a906",
      displayName: "มาลี มีสุข",
      phone: "+66810000006",
      email: null,
      language: "th",
      lineLinked: false,
    },
    memberships: [{ tenant: "landlord", role: "owner" }],
  },
  {
    // Whoever signs up as a landlord in the mock becomes this persona (phone and name from the sign-up).
    key: "signup",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a907",
      displayName: "เจ้าของใหม่",
      phone: "+66810000007",
      email: null,
      language: "th",
      lineLinked: false,
    },
    memberships: [{ tenant: "fresh", role: "owner" }],
  },
  {
    key: "agency",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a908",
      displayName: "ดารา นายหน้า",
      phone: "+66810000008",
      email: null,
      language: "th",
      lineLinked: false,
    },
    memberships: [{ tenant: "agency", role: "owner" }],
  },
  {
    // Whoever signs up as an agency in the mock becomes this persona (G2).
    key: "agencySignup",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a909",
      displayName: "นายหน้าใหม่",
      phone: "+66810000009",
      email: null,
      language: "th",
      lineLinked: false,
    },
    memberships: [{ tenant: "freshAgency", role: "owner" }],
  },
  {
    // The juristic office's manager with the owner role (pack J, JW1): register, budgets, rates, cycles.
    key: "juristic",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a910",
      displayName: "วศิน ผู้จัดการนิติ",
      phone: "+66810000010",
      email: "juristic@example.com",
      language: "th",
      lineLinked: false,
    },
    memberships: [{ tenant: "juristic", role: "owner" }],
  },
  {
    // A committee member (D-320): approves budgets and adopts resolutions, never moves money.
    key: "committee",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a911",
      displayName: "ประภา กรรมการ",
      phone: "+66810000011",
      email: null,
      language: "th",
      lineLinked: false,
    },
    memberships: [{ tenant: "juristic", role: "committee" }],
  },
];

export interface PlatformPersona {
  key: string;
  user: Schemas["MeUserDto"];
  roles: Schemas["PlatformRole"][];
  password: string;
  /** Not enrolled yet: the first sign-in answers `auth.totp_enrollment_required` (D-164). */
  enrolled: boolean;
}

export const PLATFORM_USERS: PlatformPersona[] = [
  {
    key: "admin",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a9b1",
      displayName: "Admin Test",
      phone: null,
      email: "admin@example.com",
      language: "th",
      lineLinked: false,
    },
    roles: ["platform_admin"],
    password: MOCK_PASSWORD,
    enrolled: false,
  },
  {
    key: "support",
    user: {
      id: "3b241101-e2bb-4255-8caf-4136c566a9b2",
      displayName: "Support Test",
      phone: null,
      email: "support@example.com",
      language: "en",
      lineLinked: false,
    },
    roles: ["support"],
    password: MOCK_PASSWORD,
    enrolled: true,
  },
  ...(
    [
      ["ops", "3b241101-e2bb-4255-8caf-4136c566a9b3", "Ops Maker", "ops@example.com", "platform_admin"],
      ["checker", "3b241101-e2bb-4255-8caf-4136c566a9b4", "Checker Two", "checker@example.com", "platform_admin"],
      ["finance", "3b241101-e2bb-4255-8caf-4136c566a9b5", "Finance Test", "finance@example.com", "finance"],
      ["engineer", "3b241101-e2bb-4255-8caf-4136c566a9b6", "Field Engineer", "engineer@example.com", "field_engineer"],
    ] as const
  ).map(([key, id, displayName, email, role]): PlatformPersona => ({
    key,
    user: { id, displayName, phone: null, email, language: "en", lineLinked: false },
    roles: [role],
    password: MOCK_PASSWORD,
    enrolled: true,
  })),
];

/** Platform permissions per role (getproperty-api docs/rbac.md, D-090). */
export const PLATFORM_PERMISSIONS: Record<Schemas["PlatformRole"], string[]> = {
  platform_admin: [
    "admin.tenant.read",
    "admin.tenant.manage",
    "admin.user.manage",
    "admin.setting.manage",
    "admin.compliance.manage",
    "admin.utility_tariff.enter",
    "admin.utility_tariff.verify",
    "admin.support_grant.request",
    "admin.support_grant.approve_incident",
    "admin.audit.read",
    "admin.dsr.manage",
    "admin.device.manage",
    "admin.provider_credential.manage",
    "admin.subscription.manage",
    "admin.platform_invoice.issue",
    "admin.platform_credit_note.approve",
    "admin.integration_event.read",
    "admin.ai_usage.read",
    "admin.outbox.manage",
    "admin.notification_template.manage",
    "admin.feature_flag.manage",
    "admin.building.manage",
    "admin.listing.moderate",
    "admin.listing.verify",
    "admin.guide.manage",
  ],
  support: [
    "admin.tenant.read",
    "admin.support_grant.request",
    "admin.integration_event.read",
    "admin.listing.moderate",
    "admin.listing.verify",
    "admin.guide.manage",
  ],
  field_engineer: ["admin.tenant.read", "admin.device.manage"],
  finance: [
    "admin.tenant.read",
    "admin.subscription.manage",
    "admin.platform_invoice.issue",
    "admin.platform_credit_note.approve",
    "admin.ai_usage.read",
  ],
};

/** The admin menu and the permission that opens each entry (getproperty-api `src/core/rbac/menu.ts`). */
const ADMIN_MENU_RULES: [Schemas["AdminMenuKey"], string[]][] = [
  ["tenants", ["admin.tenant.read"]],
  ["listings", ["admin.listing.moderate", "admin.listing.verify"]],
  ["guides", ["admin.guide.manage"]],
  ["platform_users", ["admin.user.manage"]],
  ["utility_tariffs", ["admin.utility_tariff.enter", "admin.utility_tariff.verify"]],
  ["settings", ["admin.setting.manage", "admin.compliance.manage"]],
  ["feature_flags", ["admin.feature_flag.manage"]],
  ["devices", ["admin.device.manage"]],
  ["ota_releases", ["admin.device.manage"]],
  ["support_grants", ["admin.support_grant.request", "admin.support_grant.approve_incident"]],
  ["subscriptions", ["admin.subscription.manage"]],
  ["notification_templates", ["admin.notification_template.manage"]],
  ["outbox", ["admin.outbox.manage"]],
  ["ingest_dead_letters", ["admin.device.manage"]],
  ["data_subject_requests", ["admin.dsr.manage"]],
  ["integration_events", ["admin.integration_event.read"]],
  ["audit_log", ["admin.audit.read"]],
  ["ai_usage", ["admin.ai_usage.read"]],
];

export function platformPermissions(roles: readonly Schemas["PlatformRole"][]): string[] {
  return [...new Set(roles.flatMap((role) => PLATFORM_PERMISSIONS[role]))];
}

export function adminMenu(roles: readonly Schemas["PlatformRole"][]): Schemas["AdminMenuKey"][] {
  const permissions = new Set(platformPermissions(roles));
  return ADMIN_MENU_RULES.filter(([, anyOf]) => anyOf.some((p) => permissions.has(p))).map(([key]) => key);
}

/** Tenant permission keys (getproperty-api `src/core/rbac/catalogue.ts` at the pinned contract, D-090). */
const TENANT_KEYS = [
  "tenant.read",
  "tenant.update",
  "tenant.bank_account.manage",
  "tenant.member.read",
  "tenant.member.invite",
  "tenant.member.manage",
  "tenant.settings.read",
  "tenant.settings.update",
  "tenant.billing_settings.update",
  "tenant.subscription.read",
  "tenant.subscription.manage",
  "tenant.audit.read",
  "tenant.support_grant.approve",
  "tenant.grant.manage",
  "property.read",
  "property.manage",
  "unit.read",
  "unit.manage",
  "listing.read",
  "listing.manage",
  "party.read",
  "party.manage",
  "party.pii.decrypt",
  "party.id_document.read",
  "party.link.manage",
  "asset_item.read",
  "asset_item.manage",
  "document.read",
  "document.upload",
  "lease.read",
  "lease.manage",
  "deposit.read",
  "deposit.settle",
  "inspection.perform",
  "reading.read",
  "reading.capture",
  "reading.review",
  "device.install",
  "device.read",
  "device.command",
  "utility_invoice.manage",
  "rate_plan.read",
  "rate_plan.manage",
  "compliance.acknowledge",
  "invoice.read",
  "invoice.issue",
  "invoice.void",
  "payment.read",
  "payment.record",
  "receipt.issue",
  "export.create",
  "report.read",
  "service_request.read",
  "service_request.handle",
  "parcel.manage",
  "service_category.manage",
  "maintenance_plan.manage",
  "access.read",
  "access.manage",
  "announcement.manage",
  "community.read",
  "community.manage",
  "notification.route.manage",
  "privacy.manage",
  "tm30.manage",
  // Pack J (D-320, rbac at api ed938f2).
  "juristic.register.read",
  "juristic.register.manage",
  "juristic.budget.read",
  "juristic.budget.manage",
  "juristic.budget.approve",
  "juristic.resolution.read",
  "juristic.resolution.manage",
  "juristic.resolution.adopt",
  "juristic.collections.read",
  "juristic.collections.manage",
  "juristic.payment_plan.approve",
  "juristic.collections.approve",
  "gate.read",
  "gate.manage",
  "gate.guard.manage",
  "gate.log.read",
  "gate.invite.approve",
  "gate.incident.read",
  "gate.incident.manage",
];
const MANAGER_EXCLUDED = new Set([
  "juristic.budget.approve",
  "juristic.resolution.adopt",
  "tenant.update",
  "tenant.bank_account.manage",
  "tenant.billing_settings.update",
  "tenant.subscription.manage",
  "tenant.member.manage",
  "tenant.support_grant.approve",
  "tenant.grant.manage",
  "rate_plan.manage",
  "party.link.manage",
  "privacy.manage",
]);

/** Role → tenant permissions as the API's `ROLE_PERMISSIONS`. */
const TENANT_PERMISSIONS: Record<Schemas["TenantRole"], string[]> = {
  owner: TENANT_KEYS,
  manager: TENANT_KEYS.filter((key) => !MANAGER_EXCLUDED.has(key)),
  staff: [
    "tenant.read",
    "tenant.settings.read",
    "property.read",
    "unit.read",
    "party.read",
    "party.manage",
    "asset_item.read",
    "asset_item.manage",
    "document.read",
    "document.upload",
    "lease.read",
    "inspection.perform",
    "reading.read",
    "reading.capture",
    "device.install",
    "device.read",
    "device.command",
    "service_request.read",
    "service_request.handle",
    "parcel.manage",
    "community.read",
    "staff_task.read",
    "juristic.register.read",
    "juristic.collections.read",
  ],
  accountant: [
    "tenant.read",
    "tenant.settings.read",
    "property.read",
    "unit.read",
    "party.read",
    "document.read",
    "lease.read",
    "deposit.read",
    "reading.read",
    "device.read",
    "utility_invoice.manage",
    "rate_plan.read",
    "invoice.read",
    "invoice.issue",
    "payment.read",
    "receipt.issue",
    "export.create",
    "report.read",
    "juristic.register.read",
    "juristic.budget.read",
    "juristic.resolution.read",
    "juristic.collections.read",
  ],
  committee: [
    "tenant.read",
    "tenant.settings.read",
    "property.read",
    "unit.read",
    "party.read",
    "document.read",
    "lease.read",
    "rate_plan.read",
    "invoice.read",
    "payment.read",
    "report.read",
    "service_request.read",
    "juristic.register.read",
    "juristic.budget.read",
    "juristic.budget.approve",
    "juristic.resolution.read",
    "juristic.resolution.adopt",
    "juristic.collections.read",
    "juristic.payment_plan.approve",
    "juristic.collections.approve",
    "gate.read",
    "gate.log.read",
    "gate.invite.approve",
    "gate.incident.read",
  ],
  auditor: [
    "tenant.read",
    "tenant.settings.read",
    "tenant.audit.read",
    "property.read",
    "unit.read",
    "party.read",
    "document.read",
    "lease.read",
    "deposit.read",
    "reading.read",
    "rate_plan.read",
    "invoice.read",
    "payment.read",
    "report.read",
    "service_request.read",
    "juristic.register.read",
    "juristic.budget.read",
    "juristic.resolution.read",
    "juristic.collections.read",
  ],
};

export function tenantPermissions(role: Schemas["TenantRole"]): string[] {
  return TENANT_PERMISSIONS[role];
}
