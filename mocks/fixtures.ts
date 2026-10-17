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
    "members",
    "settings",
  ],
  accountant: ["dashboard", "invoices", "payments", "deposits", "reports"],
  staff: ["readings"],
};
const STAFF_MENU_BY_ROLE: Record<Schemas["TenantRole"], string[]> = {
  owner: ["readings", "inspections", "installs"],
  manager: ["readings", "inspections", "installs"],
  accountant: [],
  staff: ["readings", "inspections", "installs"],
};

export function menuFor(surface: "owner" | "staff", role: Schemas["TenantRole"]): string[] {
  return (surface === "owner" ? OWNER_MENU_BY_ROLE : STAFF_MENU_BY_ROLE)[role];
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
];

export const ADMIN_MENU = [
  "tenants",
  "platform_users",
  "utility_tariffs",
  "settings",
  "feature_flags",
  "devices",
  "support_grants",
  "subscriptions",
  "notification_templates",
  "outbox",
  "data_subject_requests",
  "integration_events",
  "audit_log",
  "ai_usage",
];
