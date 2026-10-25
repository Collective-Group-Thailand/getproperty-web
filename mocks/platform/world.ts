import { createHash } from "node:crypto";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";

type Schemas = components["schemas"];

/**
 * The platform admin's world (F5) for the mock API: tenants (the three persona tenants plus two that
 * only the admin suite changes), price plans, subscriptions, platform invoices and credit notes, the
 * HaaS register, install orders and site surveys, the pilot agreement and its KPIs, AI usage, feature
 * flags, support grants, utility tariffs, settings, notification templates, DSRs, the audit log, the
 * outbox, the device fleet with OTA, and ingest dead letters. Shapes are the contract's own.
 *
 * The persona tenants (หอพักตัวอย่าง …) are read by the owner console's specs at the same time: the
 * admin specs change only `ADMIN_ONLY` tenants, so the projects can run in parallel.
 */

const day = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const date = (offsetDays: number) => iso(offsetDays).slice(0, 10);
const monthStart = (offsetMonths: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1)).toISOString().slice(0, 10);
};
const monthEnd = (offsetMonths: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 0)).toISOString().slice(0, 10);
};

export const TENANT_IDS = {
  sample: TENANTS.sample.profile.id,
  branch: TENANTS.branch.profile.id,
  suspended: TENANTS.suspended.profile.id,
  garden: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c44",
  riverside: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c55",
} as const;

/** Tenants only the admin suite changes (subscribe, suspend, pilot, flags, support grants). */
export const ADMIN_ONLY = new Set<string>([TENANT_IDS.garden, TENANT_IDS.riverside]);

export const BUILDINGS = {
  sampleA: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c",
  sampleB: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b7d",
  garden: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5c01",
  riverside: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5c02",
} as const;

export const PLATFORM_USER_IDS = {
  admin: "3b241101-e2bb-4255-8caf-4136c566a9b1",
  support: "3b241101-e2bb-4255-8caf-4136c566a9b2",
  ops: "3b241101-e2bb-4255-8caf-4136c566a9b3",
  checker: "3b241101-e2bb-4255-8caf-4136c566a9b4",
  finance: "3b241101-e2bb-4255-8caf-4136c566a9b5",
  engineer: "3b241101-e2bb-4255-8caf-4136c566a9b6",
} as const;

function tenant(
  id: string,
  slug: string,
  displayName: string,
  type: Schemas["TenantType"],
  status: Schemas["TenantStatus"],
  plan: string | null,
  vatRegistered: boolean,
): Schemas["TenantProfileDto"] {
  return {
    id,
    slug,
    displayName,
    legalName: `บริษัท ${displayName} จำกัด`,
    legalForm: "company",
    type,
    status,
    plan,
    taxId: "0105566012345",
    vatRegistered,
    defaultLanguage: "th",
    address: {
      line1: "99 ถนนพหลโยธิน",
      district: "จตุจักร",
      province: "กรุงเทพมหานคร",
      postcode: "10900",
      country: "TH",
    },
    logoDocumentId: null,
    version: 1,
  };
}

function planVersion(
  id: string,
  unitPrice: string | null,
  extra: Partial<Schemas["PricePlanVersionDto"]> = {},
): Schemas["PricePlanVersionDto"] {
  return {
    id,
    version: 1,
    state: "published",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    publishedAt: "2025-12-20T10:00:00+07:00",
    billingUnit: "per_unit",
    unitPrice,
    minUnits: null,
    minMonthly: null,
    priceRange: null,
    setupFee: "0.00",
    annualDiscountPct: "0.00",
    vatRate: "7.00",
    termMonths: null,
    tiers: [],
    includedAllowances: {},
    terms: {},
    nextActions: [],
    ...extra,
  };
}

export const PLAN_REFS = {
  starter: {
    key: "apartment_starter",
    nameTh: "Apartment Starter",
    version: 1,
    versionId: "7a000000-0000-4000-8000-000000000001",
  },
  smart: {
    key: "apartment_smart",
    nameTh: "Apartment Smart",
    version: 1,
    versionId: "7a000000-0000-4000-8000-000000000002",
  },
  meterRental: {
    key: "meter_rental",
    nameTh: "เช่ามิเตอร์อัจฉริยะ",
    version: 1,
    versionId: "7a000000-0000-4000-8000-000000000003",
  },
  pm: { key: "pm_portfolio", nameTh: "PM Portfolio", version: 1, versionId: "7a000000-0000-4000-8000-000000000004" },
} as const satisfies Record<string, Schemas["PlanRefDto"]>;

function pricePlans(): Schemas["PricePlanDto"][] {
  return [
    {
      id: "7b000000-0000-4000-8000-000000000001",
      key: "apartment_starter",
      kind: "software",
      nameTh: "Apartment Starter",
      nameEn: "Apartment Starter",
      tenantType: "apartment",
      isActive: true,
      versions: [
        planVersion(PLAN_REFS.starter.versionId, "25.0000", {
          minUnits: 20,
          includedAllowances: { meterOcrImages: 500 },
        }),
      ],
    },
    {
      id: "7b000000-0000-4000-8000-000000000002",
      key: "apartment_smart",
      kind: "software",
      nameTh: "Apartment Smart",
      nameEn: "Apartment Smart",
      tenantType: "apartment",
      isActive: true,
      versions: [planVersion(PLAN_REFS.smart.versionId, "40.0000", { minUnits: 20 })],
    },
    {
      id: "7b000000-0000-4000-8000-000000000003",
      key: "meter_rental",
      kind: "hardware_rental",
      nameTh: "เช่ามิเตอร์อัจฉริยะ",
      nameEn: "Smart meter rental",
      tenantType: "apartment",
      isActive: true,
      versions: [
        planVersion(PLAN_REFS.meterRental.versionId, "60.0000", { billingUnit: "per_meter_point", termMonths: 36 }),
      ],
    },
    {
      id: "7b000000-0000-4000-8000-000000000004",
      key: "pm_portfolio",
      kind: "software",
      nameTh: "PM Portfolio",
      nameEn: "PM Portfolio",
      tenantType: "pm_company",
      isActive: true,
      versions: [
        planVersion(PLAN_REFS.pm.versionId, null, {
          billingUnit: "per_tenant",
          priceRange: { from: "50000.00", to: "120000.00" },
        }),
      ],
    },
    {
      id: "7b000000-0000-4000-8000-000000000005",
      key: "condo_juristic",
      kind: "software",
      nameTh: "Condo Juristic",
      nameEn: "Condo Juristic",
      tenantType: "condo_juristic",
      isActive: false,
      versions: [
        planVersion("7a000000-0000-4000-8000-000000000005", null, {
          state: "draft",
          publishedAt: null,
          minUnits: 100,
          tiers: [
            { fromUnits: 0, toUnits: 200, pricePerUnit: "15.00" },
            { fromUnits: 200, toUnits: 500, pricePerUnit: "12.00" },
            { fromUnits: 500, toUnits: null, pricePerUnit: "10.00" },
          ],
          nextActions: ["publish"],
        }),
      ],
    },
  ];
}

export interface PlatformWorld {
  tenants: Schemas["TenantProfileDto"][];
  members: Record<string, Schemas["MemberDto"][]>;
  health: Record<string, Omit<Schemas["TenantHealthDto"], "subscriptionState" | "status" | "planKey" | "tenantId">>;
  plans: Schemas["PricePlanDto"][];
  subscriptions: Schemas["SubscriptionDto"][];
  subscriptionEvents: Record<string, Schemas["SubscriptionEventDto"][]>;
  invoices: Schemas["PlatformInvoiceDto"][];
  haas: Schemas["HaasAssetDto"][];
  installOrders: Schemas["InstallOrderDto"][];
  surveys: Schemas["SiteSurveyDto"][];
  pilots: Record<string, Schemas["PilotAgreementDto"]>;
  aiUsage: Record<string, Schemas["AiUsageMonthDto"][]>;
  flags: Schemas["FeatureFlagDto"][];
  grants: Schemas["SupportGrantDto"][];
  tariffs: Schemas["UtilityTariffDto"][];
  settings: Schemas["SettingDefinitionDto"][];
  tenantSettings: { tenantId: string; key: string; value: unknown; effectiveFrom: string; reason: string }[];
  templates: Schemas["NotificationTemplateDto"][];
  testSends: { templateId: string; recipientUserId: string | null }[];
  dsrs: Schemas["DsrDto"][];
  audit: Schemas["AuditEntryDto"][];
  outbox: Schemas["OutboxMessageDto"][];
  integrationEvents: Schemas["IntegrationEventDto"][];
  consumptions: Schemas["EventConsumptionDto"][];
  devices: Schemas["FleetDeviceDto"][];
  configs: Record<string, Schemas["GatewayConfigVersionDto"][]>;
  deviceEvents: Record<string, Schemas["DeviceEventDto"][]>;
  commands: Schemas["DeviceCommandDto"][];
  releases: Schemas["OtaReleaseDto"][];
  /** Objects under `releases/edge/` in the product bucket, with their size (D-231; uploaded by a release engineer). */
  releaseObjects: Record<string, number>;
  rollouts: Schemas["OtaRolloutDto"][];
  ingestDeadLetters: Schemas["DeadLetterDto"][];
  platformUsers: Schemas["PlatformUserDto"][];
  /** Provider credentials (D-240): the API's metadata row and the hash of a payment's merchant reference — never values. */
  providerCredentials: { row: Schemas["ProviderCredentialDto"]; accountRefHash: string | null }[];
  replies: Map<string, { status: number; body: unknown; fingerprint: string }>;
  received: { op: string; idempotencyKey: string | null; body: unknown }[];
}

const pilotKpiBaseline: Schemas["PilotBaselineDto"] = {
  timeToBillHours: "72",
  invoiceCorrectionRatePct: "4.00",
  onTimePaymentPct: "68.00",
  autoReconciledPct: "0",
  lossPct: null,
  meterUptimePct: null,
  csat: null,
};

function invoice(
  id: string,
  number: string,
  tenantId: string,
  tenantName: string,
  subscriptionId: string,
  state: Schemas["PlatformInvoiceStatus"],
  amounts: { subtotal: string; discount: string; vat: string; total: string; paid: string; open: string },
  lines: Schemas["PlatformInvoiceLineDto"][],
  months: number,
): Schemas["PlatformInvoiceDto"] {
  const open = state === "issued" || state === "overdue" || state === "partially_paid";
  return {
    id,
    number,
    tenantId,
    tenantName,
    subscriptionId,
    kind: "monthly",
    state,
    periodStart: monthStart(months),
    periodEnd: monthEnd(months),
    issuedAt: `${monthStart(months + 1)}T09:00:00+07:00`,
    dueAt: `${monthStart(months + 1).slice(0, 8)}16T23:59:59+07:00`,
    overdueSince: state === "overdue" ? iso(-10) : null,
    subtotal: amounts.subtotal,
    discount: amounts.discount,
    vatAmount: amounts.vat,
    total: amounts.total,
    paidTotal: amounts.paid,
    creditedTotal: "0.00",
    openAmount: amounts.open,
    lines,
    payments:
      state === "paid"
        ? [
            {
              id: `${id.slice(0, -4)}a001`,
              amount: amounts.total,
              method: "qr",
              paidAt: `${monthStart(months + 1).slice(0, 8)}05T10:12:00+07:00`,
              provider: "kbank",
              providerRef: `KB${number.replace(/\D/g, "")}`,
              receiptDocumentId: `${id.slice(0, -4)}d001`,
              receiptNumber: number.replace("PIV", "PRC"),
            },
          ]
        : [],
    creditNotes: [],
    qr: open
      ? {
          payload: `00020101021230830016A00000067701011201150105566000000020218${number.replace(/\D/g, "")}5303764540${amounts.open.length}${amounts.open}5802TH6304ABCD`,
          reference: number.replace(/\D/g, ""),
          expiresAt: null,
        }
      : null,
    documentId: `${id.slice(0, -4)}d000`,
    nextActions: open ? ["record-payment", "request-credit-note"] : state === "paid" ? ["request-credit-note"] : [],
  };
}

function starterLines(units: number, amount: string): Schemas["PlatformInvoiceLineDto"][] {
  return [
    {
      lineNo: 1,
      kind: "subscription",
      description: `Apartment Starter — ${units} ห้อง × 25.00 บาท`,
      quantity: `${units}.000`,
      unitPrice: "25.0000",
      amount,
    },
  ];
}

function tariffVersion(
  id: string,
  state: Schemas["TariffVersionState"],
  effectiveFrom: string,
  effectiveTo: string | null,
  ceiling: string,
  ft: string,
  tiers: { fromUnits: string; toUnits: string | null; pricePerUnit: string }[],
  extra: Partial<Schemas["TariffVersionDto"]> = {},
): Schemas["TariffVersionDto"] {
  return {
    id,
    state,
    effectiveFrom,
    effectiveTo,
    ceilingPerUnit: ceiling,
    sourceUrl: "https://www.mea.or.th/our-services/tariff-calculation/other/D6AWBBn5I",
    sourceDocumentId: null,
    notes: null,
    needsCheck: false,
    enteredBy: PLATFORM_USER_IDS.ops,
    verifiedBy: state === "entered" ? null : PLATFORM_USER_IDS.checker,
    publishedAt: state === "published" || state === "superseded" ? `${effectiveFrom}T00:00:00+07:00` : null,
    nextActions: state === "entered" ? ["verify"] : state === "verified" ? ["publish"] : [],
    structure: {
      kind: "tiered",
      unit: "kwh",
      currency: "THB",
      tiers,
      ft: { pricePerUnit: ft, period: effectiveFrom.slice(0, 7) },
      serviceCharge: { amount: "24.62", basis: "per_month" },
      minimumCharge: null,
      vat: { rate: "7", included: false },
      ceilingPerUnit: ceiling,
      capBasis: "effective_average_rate",
    },
    ...extra,
  };
}

const MEA_TIERS = [
  { fromUnits: "0", toUnits: "150", pricePerUnit: "3.2484" },
  { fromUnits: "150", toUnits: "400", pricePerUnit: "4.2218" },
  { fromUnits: "400", toUnits: null, pricePerUnit: "4.4217" },
];

function gateway(
  id: string,
  serial: string,
  status: Schemas["DeviceStatus"],
  tenantId: string | null,
  buildingId: string | null,
  ring: Schemas["OtaRing"],
  extra: Partial<Schemas["FleetDeviceDto"]> = {},
): Schemas["FleetDeviceDto"] {
  return {
    id,
    serial,
    kind: "gateway",
    model: "GP-GW1",
    vendor: "Collective",
    arch: "arm64",
    status,
    ownership: "platform_haas",
    tenantId,
    buildingId,
    assetItemId: null,
    gatewayDeviceId: null,
    driver: null,
    firmwareVersion: status === "inventory" ? null : "0.3.0",
    configAppliedVersion: status === "online" || status === "degraded" ? 4 : null,
    lastSeenAt:
      status === "online" ? iso(-0.002) : status === "offline" ? iso(-0.4) : status === "degraded" ? iso(-0.01) : null,
    meters: status === "inventory" ? 0 : 12,
    otaRing: ring,
    mqttWsFallback: false,
    health:
      status === "inventory" || status === "assigned"
        ? null
        : {
            agentVersion: "0.3.0",
            lastHeartbeatAt: status === "offline" ? iso(-0.4) : iso(-0.002),
            missedHeartbeats: status === "offline" ? 7 : status === "degraded" ? 1 : 0,
            link: "ethernet",
            rssi: null,
            bufferedReadings: status === "offline" ? 2304 : 0,
            configVersion: status === "degraded" ? 3 : 4,
            ingestLagMs: status === "online" ? 820 : null,
          },
    nextActions: [],
    version: 1,
    ...extra,
  };
}

/** A device's admin `nextActions` as getproperty-api computes them (`deviceNextActions(d, "admin")`, smart.mappers.ts). */
/** The hash a payment credential is matched by (getproperty-api keeps only the hash of the merchant reference). */
export function merchantRefHash(merchantRef: string): string {
  return createHash("sha256").update(merchantRef.trim()).digest("hex");
}

export function deviceNextActions(device: Schemas["FleetDeviceDto"]): string[] {
  const out: string[] = [];
  const live =
    device.kind === "gateway" &&
    device.status !== "retired" &&
    device.status !== "inventory" &&
    device.status !== "assigned";
  if (live) out.push("read-now", "restart", "identify", "upload-logs");
  if (device.status !== "retired" && !device.assetItemId) out.push("assign");
  if (device.kind === "gateway") out.push("set-ring");
  if (device.kind === "gateway" && device.status !== "retired") out.push("set-mqtt-transport");
  if (device.kind === "gateway" && device.status !== "retired") out.push("revoke-certificates");
  if (device.status !== "retired" && device.meters === 0 && !device.assetItemId) out.push("retire");
  return out;
}

export const DEVICE_IDS = {
  gwSampleA: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e01",
  gwSampleB: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e02",
  gwGarden: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e03",
  gwStock: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e04",
  meterStock: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e05",
} as const;

export function initialPlatformWorld(): PlatformWorld {
  const tenants = [
    tenant(
      TENANT_IDS.sample,
      "sample-dorm",
      TENANTS.sample.profile.displayName,
      "apartment",
      "active",
      "apartment_starter",
      true,
    ),
    tenant(
      TENANT_IDS.branch,
      "branch-two",
      TENANTS.branch.profile.displayName,
      "pm_company",
      "active",
      "pm_portfolio",
      true,
    ),
    tenant(
      TENANT_IDS.suspended,
      "paused-dorm",
      TENANTS.suspended.profile.displayName,
      "apartment",
      "read_only",
      "apartment_starter",
      false,
    ),
    tenant(TENANT_IDS.garden, "baan-suan", "หอพักบ้านสวน", "apartment", "active", "apartment_starter", false),
    tenant(TENANT_IDS.riverside, "riverside-condo", "นิติบุคคลอาคารชุดริมน้ำ", "condo_juristic", "active", null, false),
  ];
  const subscriptions: Schemas["SubscriptionDto"][] = [
    {
      id: "8a000000-0000-4000-8000-000000000001",
      tenantId: TENANT_IDS.sample,
      tenantName: TENANTS.sample.profile.displayName,
      plan: PLAN_REFS.starter,
      addons: [],
      billingPeriod: "monthly",
      state: "active",
      readOnly: false,
      startedAt: iso(-120),
      trialEndsAt: iso(-90),
      activatedAt: iso(-90),
      pastDueSince: null,
      suspendedAt: null,
      cancelledAt: null,
      cancelEffectiveDate: null,
      cancelReason: null,
      discountPct: "20.00",
      discountReason: "Pilot (D-083)",
      pilotAgreementId: "8d000000-0000-4000-8000-000000000001",
      nextActions: ["change-plan", "suspend", "cancel"],
    },
    {
      id: "8a000000-0000-4000-8000-000000000002",
      tenantId: TENANT_IDS.branch,
      tenantName: TENANTS.branch.profile.displayName,
      plan: PLAN_REFS.pm,
      addons: [],
      billingPeriod: "annual",
      state: "active",
      readOnly: false,
      startedAt: iso(-200),
      trialEndsAt: iso(-170),
      activatedAt: iso(-170),
      pastDueSince: null,
      suspendedAt: null,
      cancelledAt: null,
      cancelEffectiveDate: null,
      cancelReason: null,
      discountPct: "0.00",
      discountReason: null,
      pilotAgreementId: null,
      nextActions: ["change-plan", "suspend", "cancel"],
    },
    {
      id: "8a000000-0000-4000-8000-000000000003",
      tenantId: TENANT_IDS.suspended,
      tenantName: TENANTS.suspended.profile.displayName,
      plan: PLAN_REFS.starter,
      addons: [],
      billingPeriod: "monthly",
      state: "suspended",
      readOnly: true,
      startedAt: iso(-160),
      trialEndsAt: iso(-130),
      activatedAt: iso(-130),
      pastDueSince: iso(-40),
      suspendedAt: iso(-10),
      cancelledAt: null,
      cancelEffectiveDate: null,
      cancelReason: null,
      discountPct: "0.00",
      discountReason: null,
      pilotAgreementId: null,
      nextActions: ["reinstate", "cancel"],
    },
    {
      id: "8a000000-0000-4000-8000-000000000004",
      tenantId: TENANT_IDS.garden,
      tenantName: "หอพักบ้านสวน",
      plan: PLAN_REFS.starter,
      addons: [],
      billingPeriod: "monthly",
      state: "trial",
      readOnly: false,
      startedAt: iso(-12),
      trialEndsAt: iso(18),
      activatedAt: null,
      pastDueSince: null,
      suspendedAt: null,
      cancelledAt: null,
      cancelEffectiveDate: null,
      cancelReason: null,
      discountPct: "0.00",
      discountReason: null,
      pilotAgreementId: null,
      nextActions: ["change-plan", "suspend", "cancel"],
    },
  ];
  const sampleName = TENANTS.sample.profile.displayName;
  const invoices = [
    invoice(
      "8b000000-0000-4000-8000-000000000001",
      "PIV-2026-000041",
      TENANT_IDS.sample,
      sampleName,
      subscriptions[0]!.id,
      "issued",
      { subtotal: "1000.00", discount: "200.00", vat: "56.00", total: "856.00", paid: "0.00", open: "856.00" },
      [
        ...starterLines(40, "1000.00"),
        {
          lineNo: 2,
          kind: "discount",
          description: "ส่วนลดโครงการนำร่อง 20%",
          quantity: "1.000",
          unitPrice: "-200.0000",
          amount: "-200.00",
        },
      ],
      -1,
    ),
    invoice(
      "8b000000-0000-4000-8000-000000000002",
      "PIV-2026-000027",
      TENANT_IDS.sample,
      sampleName,
      subscriptions[0]!.id,
      "paid",
      { subtotal: "1000.00", discount: "200.00", vat: "56.00", total: "856.00", paid: "856.00", open: "0.00" },
      [
        ...starterLines(40, "1000.00"),
        {
          lineNo: 2,
          kind: "discount",
          description: "ส่วนลดโครงการนำร่อง 20%",
          quantity: "1.000",
          unitPrice: "-200.0000",
          amount: "-200.00",
        },
      ],
      -2,
    ),
    invoice(
      "8b000000-0000-4000-8000-000000000003",
      "PIV-2026-000035",
      TENANT_IDS.suspended,
      TENANTS.suspended.profile.displayName,
      subscriptions[2]!.id,
      "overdue",
      { subtotal: "500.00", discount: "0.00", vat: "35.00", total: "535.00", paid: "0.00", open: "535.00" },
      starterLines(20, "500.00"),
      -2,
    ),
    invoice(
      "8b000000-0000-4000-8000-000000000004",
      "PIV-2026-000044",
      TENANT_IDS.garden,
      "หอพักบ้านสวน",
      subscriptions[3]!.id,
      "issued",
      { subtotal: "750.00", discount: "0.00", vat: "52.50", total: "802.50", paid: "0.00", open: "802.50" },
      starterLines(30, "750.00"),
      -1,
    ),
  ];
  const world: PlatformWorld = {
    tenants,
    members: {
      [TENANT_IDS.sample]: [
        {
          id: "9a000000-0000-4000-8000-000000000001",
          userId: "3b241101-e2bb-4255-8caf-4136c566a901",
          displayName: "สมชาย เจ้าของหอ",
          email: "owner@example.com",
          phone: "+66810000001",
          role: "owner",
          status: "active",
          buildingIds: null,
          joinedAt: iso(-120),
        },
        {
          id: "9a000000-0000-4000-8000-000000000004",
          userId: "3b241101-e2bb-4255-8caf-4136c566a904",
          displayName: "Somsak Staff",
          email: null,
          phone: "+66810000004",
          role: "staff",
          status: "active",
          buildingIds: [BUILDINGS.sampleA],
          joinedAt: iso(-60),
        },
      ],
      [TENANT_IDS.garden]: [
        {
          id: "9a000000-0000-4000-8000-000000000041",
          userId: "3b241101-e2bb-4255-8caf-4136c566a941",
          displayName: "วิไล บ้านสวน",
          email: "wilai@example.com",
          phone: "+66810000041",
          role: "owner",
          status: "active",
          buildingIds: null,
          joinedAt: iso(-12),
        },
      ],
    },
    health: {
      [TENANT_IDS.sample]: {
        buildings: 3,
        units: 40,
        gateways: { total: 2, online: 1 },
        lastBillingCycle: { periodKey: monthStart(-1).slice(0, 7), status: "issued", createdAt: iso(-20) },
        openPlatformInvoices: 1,
        overduePlatformAmount: "0.00",
        signals: ["gateways_offline"],
        trialEndsAt: null,
      },
      [TENANT_IDS.branch]: {
        buildings: 4,
        units: 180,
        gateways: { total: 0, online: 0 },
        lastBillingCycle: null,
        openPlatformInvoices: 0,
        overduePlatformAmount: "0.00",
        signals: ["no_cycle_this_month"],
        trialEndsAt: null,
      },
      [TENANT_IDS.suspended]: {
        buildings: 1,
        units: 20,
        gateways: { total: 0, online: 0 },
        lastBillingCycle: { periodKey: monthStart(-2).slice(0, 7), status: "closed", createdAt: iso(-50) },
        openPlatformInvoices: 1,
        overduePlatformAmount: "535.00",
        signals: ["past_due", "suspended"],
        trialEndsAt: null,
      },
      [TENANT_IDS.garden]: {
        buildings: 1,
        units: 30,
        gateways: { total: 1, online: 1 },
        lastBillingCycle: null,
        openPlatformInvoices: 1,
        overduePlatformAmount: "0.00",
        signals: ["trial_ending"],
        trialEndsAt: iso(18),
      },
      [TENANT_IDS.riverside]: {
        buildings: 2,
        units: 240,
        gateways: { total: 0, online: 0 },
        lastBillingCycle: null,
        openPlatformInvoices: 0,
        overduePlatformAmount: "0.00",
        signals: [],
        trialEndsAt: null,
      },
    },
    plans: pricePlans(),
    subscriptions,
    subscriptionEvents: {
      [subscriptions[0]!.id]: [
        {
          id: "8c000000-0000-4000-8000-000000000001",
          type: "subscription.created",
          occurredAt: iso(-120),
          data: { plan: "apartment_starter" },
        },
        {
          id: "8c000000-0000-4000-8000-000000000002",
          type: "subscription.state_changed",
          occurredAt: iso(-90),
          data: { from: "trial", to: "active" },
        },
      ],
      [subscriptions[3]!.id]: [
        {
          id: "8c000000-0000-4000-8000-000000000041",
          type: "subscription.created",
          occurredAt: iso(-12),
          data: { plan: "apartment_starter" },
        },
      ],
    },
    invoices,
    haas: [
      {
        id: "8e000000-0000-4000-8000-000000000001",
        tenantId: TENANT_IDS.sample,
        deviceId: DEVICE_IDS.gwSampleA,
        serial: "GW-0001",
        kind: "gateway",
        buildingId: BUILDINGS.sampleA,
        state: "in_service",
        installedOn: date(-100),
        termMonths: 36,
        termEnd: date(-100 + 36 * 30),
        acquisitionCost: "4500.00",
        monthlyValue: "125.00",
        bookValue: "4125.00",
        replacedByAssetId: null,
        deinstallOrderId: null,
        events: [
          { type: "allocated", occurredAt: iso(-110), data: {} },
          {
            type: "installed",
            occurredAt: iso(-100),
            data: { installOrderId: "8f000000-0000-4000-8000-000000000001" },
          },
          { type: "in_service", occurredAt: iso(-99), data: {} },
        ],
        nextActions: ["replace", "deinstall", "write-off"],
      },
      {
        id: "8e000000-0000-4000-8000-000000000002",
        tenantId: TENANT_IDS.garden,
        deviceId: DEVICE_IDS.gwGarden,
        serial: "GW-0003",
        kind: "gateway",
        buildingId: BUILDINGS.garden,
        state: "allocated",
        installedOn: null,
        termMonths: 36,
        termEnd: null,
        acquisitionCost: "4500.00",
        monthlyValue: "125.00",
        bookValue: "4500.00",
        replacedByAssetId: null,
        deinstallOrderId: null,
        events: [{ type: "allocated", occurredAt: iso(-5), data: {} }],
        nextActions: ["install", "write-off"],
      },
    ],
    installOrders: [
      {
        id: "8f000000-0000-4000-8000-000000000002",
        tenantId: TENANT_IDS.garden,
        buildingId: BUILDINGS.garden,
        buildingName: "อาคารบ้านสวน",
        kind: "install",
        state: "open",
        assignedTo: null,
        dueAt: iso(4),
        completedAt: null,
        notes: "ติดตั้งเกตเวย์ + มิเตอร์ไฟฟ้า 30 ห้อง",
        items: [
          { deviceKind: "gateway", deviceId: DEVICE_IDS.gwGarden, assetItemId: null, unitId: null, done: false },
          {
            deviceKind: "electric_meter",
            deviceId: null,
            assetItemId: "4a000000-0000-4000-8000-000000000101",
            unitId: "6d000000-0000-4000-8000-000000000101",
            done: false,
          },
        ],
        nextActions: ["assign", "start", "cancel"],
      },
    ],
    surveys: [
      {
        id: "8f100000-0000-4000-8000-000000000001",
        tenantId: TENANT_IDS.sample,
        buildingId: BUILDINGS.sampleB,
        targetPlanKey: "apartment_smart",
        state: "requested",
        scheduledFor: null,
        assignedTo: null,
        notes: "อยากเปลี่ยนเป็น Smart ที่อาคาร B",
        findings: {},
        installOrderId: null,
        createdAt: iso(-3),
      },
    ],
    pilots: {
      [TENANT_IDS.sample]: {
        id: "8d000000-0000-4000-8000-000000000001",
        tenantId: TENANT_IDS.sample,
        signedOn: date(-120),
        termMonths: 6,
        discountPct: "20.00",
        referenceSiteRights: true,
        anonymisedDataUse: true,
        feedbackCadence: "biweekly",
        kpiReviewOn: date(-30),
        baseline: pilotKpiBaseline,
        kpiTargets: {},
        agreementDocumentId: null,
        notes: "ลูกค้านำร่องรายแรก (D-083)",
      },
    },
    aiUsage: {
      [TENANT_IDS.sample]: [
        {
          month: monthStart(-1),
          feature: "meter_ocr",
          calls: 612,
          units: 612,
          allowance: 500,
          overage: 112,
          costThb: "30.60",
        },
        {
          month: monthStart(-1),
          feature: "invoice_ocr",
          calls: 3,
          units: 3,
          allowance: null,
          overage: 0,
          costThb: "0.45",
        },
        {
          month: monthStart(-2),
          feature: "meter_ocr",
          calls: 480,
          units: 480,
          allowance: 500,
          overage: 0,
          costThb: "24.00",
        },
      ],
    },
    flags: [
      {
        key: "channel.web_push",
        description: "Web push notifications for operators.",
        defaultEnabled: true,
        rolloutPct: 100,
        overrides: [],
      },
      {
        key: "module.service_requests",
        description: "Service requests and work orders (R2).",
        defaultEnabled: false,
        rolloutPct: 0,
        overrides: [{ tenantId: TENANT_IDS.sample, enabled: false, reason: "R2 not released" }],
      },
      {
        key: "billing.auto_issue",
        description: "Automatic issue of billing cycles.",
        defaultEnabled: true,
        rolloutPct: 50,
        overrides: [],
      },
    ],
    grants: [
      {
        id: "8a100000-0000-4000-8000-000000000001",
        tenantId: TENANT_IDS.sample,
        state: "active",
        reason: "ลูกค้าแจ้งบิลเดือนที่แล้วไม่ตรง",
        ticketRef: "SUP-1042",
        approvedVia: "in_app",
        validFrom: iso(-0.1),
        validTo: iso(0.9),
        createdAt: iso(-0.2),
        nextActions: ["revoke"],
      },
      {
        id: "8a100000-0000-4000-8000-000000000002",
        tenantId: TENANT_IDS.garden,
        state: "requested",
        reason: "ช่วยตั้งค่าอัตราค่าไฟ",
        ticketRef: "SUP-1050",
        approvedVia: null,
        validFrom: null,
        validTo: null,
        createdAt: iso(-0.05),
        nextActions: ["approve-incident", "revoke"],
      },
    ],
    tariffs: [
      {
        id: "9b000000-0000-4000-8000-000000000001",
        utility: "electric",
        provider: "mea",
        tariffCode: "1.1",
        nameTh: "ประเภท 1.1 บ้านอยู่อาศัย (กฟน.)",
        versions: [
          tariffVersion(
            "9c000000-0000-4000-8000-000000000003",
            "entered",
            date(40),
            null,
            "4.5617",
            "0.3672",
            MEA_TIERS,
            {
              needsCheck: true,
              notes: "Ft งวดใหม่",
            },
          ),
          tariffVersion("9c000000-0000-4000-8000-000000000002", "published", "2026-09-01", null, "4.6189", "0.1972", [
            { fromUnits: "0", toUnits: "150", pricePerUnit: "3.2484" },
            { fromUnits: "150", toUnits: "400", pricePerUnit: "4.2218" },
            { fromUnits: "400", toUnits: null, pricePerUnit: "4.4217" },
          ]),
          tariffVersion(
            "9c000000-0000-4000-8000-000000000001",
            "superseded",
            "2026-05-01",
            "2026-09-01",
            "4.6100",
            "0.1883",
            MEA_TIERS,
          ),
        ],
      },
      {
        id: "9b000000-0000-4000-8000-000000000002",
        utility: "electric",
        provider: "pea",
        tariffCode: "1.1",
        nameTh: "ประเภท 1.1 บ้านอยู่อาศัย (กฟภ.)",
        versions: [
          tariffVersion(
            "9c000000-0000-4000-8000-000000000011",
            "published",
            "2026-09-01",
            null,
            "4.6189",
            "0.1972",
            MEA_TIERS,
          ),
        ],
      },
      {
        id: "9b000000-0000-4000-8000-000000000003",
        utility: "water",
        provider: "mwa",
        tariffCode: "1",
        nameTh: "ประเภทที่อยู่อาศัย (กปน.)",
        versions: [
          {
            ...tariffVersion(
              "9c000000-0000-4000-8000-000000000021",
              "published",
              "2026-01-01",
              null,
              "14.4500",
              "0",
              [],
            ),
            sourceUrl: "https://www.mwa.co.th/",
            structure: {
              kind: "tiered",
              unit: "m3",
              currency: "THB",
              tiers: [
                { fromUnits: "0", toUnits: "30", pricePerUnit: "8.50" },
                { fromUnits: "30", toUnits: "50", pricePerUnit: "10.03" },
                { fromUnits: "50", toUnits: null, pricePerUnit: "14.45" },
              ],
              ft: null,
              serviceCharge: null,
              minimumCharge: { amount: "45.00" },
              vat: { rate: "7", included: false },
              ceilingPerUnit: "14.4500",
              capBasis: "effective_average_rate",
            },
          },
        ],
      },
    ],
    settings: [
      // D-276 / D-279 storage (5 GB free per tenant type; price and packs set by the platform admin)
      ...(
        [
          ["storage.free_gb", { apartment: "5", condo_juristic: "5", pm_company: "5", landlord: "5" }],
          ["storage.price_per_gb_month", { apartment: null, condo_juristic: null, pm_company: null, landlord: null }],
          ["storage.packs", []],
          ["storage.notice_at_percent", [80, 100]],
          ["storage.record_bytes", { _default: 1024, invoice: 2048, receipt: 2048, meter_reading: 256 }],
        ] as const
      ).map(([key, value]) => ({
        key,
        valueType: "json" as const,
        value: value as Schemas["SettingDefinitionDto"]["value"],
        scopeAllowed:
          key === "storage.free_gb" || key === "storage.price_per_gb_month" ? ["platform", "tenant"] : ["platform"],
        editableBy: ["admin.setting.manage"],
        effectiveFrom: "2026-10-25T00:00:00+07:00",
        description: `D-276 / D-279: ${key}`,
      })),
      {
        key: "subscription.trial_days",
        valueType: "int",
        value: 30,
        scopeAllowed: ["platform"],
        editableBy: ["admin.subscription.manage"],
        effectiveFrom: "2026-01-01T00:00:00+07:00",
        description: "D-082: length of the trial before a subscription becomes active.",
      },
      {
        key: "subscription.invoice_due_days",
        valueType: "int",
        value: 15,
        scopeAllowed: ["platform"],
        editableBy: ["admin.subscription.manage"],
        effectiveFrom: "2026-01-01T00:00:00+07:00",
        description: "D-204: days from the issue of a platform invoice to its due date.",
      },
      {
        key: "support.grant_max_hours",
        valueType: "int",
        value: 24,
        scopeAllowed: ["platform"],
        editableBy: ["admin.setting.manage"],
        effectiveFrom: "2026-01-01T00:00:00+07:00",
        description: "D-167: longest support grant an Owner can approve.",
      },
      {
        key: "reminders.schedule",
        valueType: "json",
        value: [1, 3, 7],
        scopeAllowed: ["platform", "tenant"],
        editableBy: ["tenant.settings.update"],
        effectiveFrom: "2026-01-01T00:00:00+07:00",
        description: "D-045: LINE reminders after due date + grace.",
      },
      {
        key: "notifications.quiet_hours",
        valueType: "json",
        value: { start: "21:00", end: "08:00" },
        scopeAllowed: ["platform", "tenant"],
        editableBy: ["tenant.settings.update"],
        effectiveFrom: "2026-01-01T00:00:00+07:00",
        description: "D-167: no non-urgent resident messages in these hours (Asia/Bangkok).",
      },
      {
        key: "ai.usage_metering",
        valueType: "json",
        value: { enabled: false },
        scopeAllowed: ["platform"],
        editableBy: ["admin.subscription.manage"],
        effectiveFrom: "2026-01-01T00:00:00+07:00",
        description: "O-009: bill OCR beyond the plan's allowance.",
      },
      {
        key: "compliance.tariff_cap.severity",
        valueType: "string",
        value: "warn",
        scopeAllowed: ["platform", "tenant"],
        editableBy: ["admin.compliance.manage"],
        effectiveFrom: "2026-01-01T00:00:00+07:00",
        description: "D-021a: how a rate above the utility rate is treated.",
      },
      // Release fixes and B6 platform defaults (getproperty-api 048a8bd catalogue).
      {
        key: "payments.duplicate_window_hours",
        valueType: "int",
        value: 72,
        scopeAllowed: ["platform", "tenant"],
        editableBy: ["tenant.billing_settings.update"],
        effectiveFrom: "2026-10-21T00:00:00+07:00",
        description:
          "D-220: a QR callback or settlement row of the same amount as a slip or hand-recorded transfer of the same payer × unit within this many hours is held for the owner as a possible duplicate.",
      },
      {
        key: "etax.enabled",
        valueType: "bool",
        value: false,
        scopeAllowed: ["platform", "tenant"],
        editableBy: ["tenant.billing_settings.update"],
        effectiveFrom: "2026-10-21T00:00:00+07:00",
        description:
          "D-050 / D-215: submit receipts of a VAT-registered tenant to its e-Tax service provider (opt-in).",
      },
      {
        key: "tm30.notify_within_hours",
        valueType: "int",
        value: 24,
        scopeAllowed: ["platform"],
        editableBy: ["admin.compliance.manage"],
        effectiveFrom: "2026-10-21T00:00:00+07:00",
        description: "D-052 / D-216 ⚖ (Immigration Act B.E. 2522 s.38): hours to notify a foreigner's stay (TM30 SLA).",
      },
      {
        key: "analytics.reminder_effective_days",
        valueType: "int",
        value: 7,
        scopeAllowed: ["platform"],
        editableBy: ["admin.setting.manage"],
        effectiveFrom: "2026-10-21T00:00:00+07:00",
        description: "D-045 / D-217: a reminder counts as effective when the invoice is paid within this many days.",
      },
    ],
    tenantSettings: [],
    templates: [
      {
        id: "9d000000-0000-4000-8000-000000000001",
        key: "invoice.issued",
        audience: "resident",
        channel: "line",
        description: "Resident: a new invoice with its Thai QR.",
        versions: [
          {
            id: "9e000000-0000-4000-8000-000000000002",
            version: 2,
            state: "draft",
            language: "th",
            format: "handlebars_text",
            subject: null,
            body: "บิลห้อง {{unit.no}} เดือน {{period}} ยอด {{amount}} บาท ชำระภายใน {{dueDate}}",
            sampleData: { unit: { no: "A-201" }, period: "ต.ค. 2569", amount: "4,850.00", dueDate: "5 พ.ย. 2569" },
            publishedAt: null,
          },
          {
            id: "9e000000-0000-4000-8000-000000000001",
            version: 1,
            state: "published",
            language: "th",
            format: "handlebars_text",
            subject: null,
            body: "บิลใหม่ห้อง {{unit.no}} ยอด {{amount}} บาท",
            sampleData: { unit: { no: "A-201" }, amount: "4,850.00" },
            publishedAt: iso(-60),
          },
        ],
      },
      {
        id: "9d000000-0000-4000-8000-000000000002",
        key: "tenant.bank_account.changed",
        audience: "owner",
        channel: "email",
        description: "Owner: receiving bank account changed.",
        versions: [
          {
            id: "9e000000-0000-4000-8000-000000000011",
            version: 1,
            state: "published",
            language: "th",
            format: "plain",
            subject: "บัญชีรับเงินถูกเปลี่ยน",
            body: "บัญชีรับเงินของ {{tenant.name}} ถูกเปลี่ยนเป็น {{account.masked}}",
            sampleData: { tenant: { name: "หอพักตัวอย่าง" }, account: { masked: "xxxxxx1234" } },
            publishedAt: iso(-90),
          },
        ],
      },
    ],
    testSends: [],
    dsrs: [
      {
        id: "9f000000-0000-4000-8000-000000000001",
        tenantId: TENANT_IDS.sample,
        kind: "access",
        state: "in_progress",
        receivedAt: iso(-12),
        dueAt: iso(18),
        fulfilledAt: null,
        exportDocumentId: null,
        notes: null,
        nextActions: [],
      },
      {
        id: "9f000000-0000-4000-8000-000000000002",
        tenantId: TENANT_IDS.garden,
        kind: "erasure",
        state: "received",
        receivedAt: iso(-33),
        dueAt: iso(-3),
        fulfilledAt: null,
        exportDocumentId: null,
        notes: null,
        nextActions: [],
      },
      {
        id: "9f000000-0000-4000-8000-000000000003",
        tenantId: null,
        kind: "rectification",
        state: "fulfilled",
        receivedAt: iso(-50),
        dueAt: iso(-20),
        fulfilledAt: iso(-40),
        exportDocumentId: null,
        notes: "บัญชีผู้ดูแลอาคาร",
        nextActions: [],
      },
      {
        // A login not linked to any tenant asks for its data: Collective is the controller (D-214).
        id: "9f000000-0000-4000-8000-000000000004",
        tenantId: null,
        kind: "access",
        state: "received",
        receivedAt: iso(-2),
        dueAt: iso(28),
        fulfilledAt: null,
        exportDocumentId: null,
        notes: null,
        nextActions: ["verify", "reject"],
      },
    ],
    audit: [
      {
        id: "a0000000-0000-4000-8000-000000000001",
        action: "support_grant.used",
        actor: {
          type: "user",
          audience: "platform",
          id: PLATFORM_USER_IDS.support,
          supportGrantId: "8a100000-0000-4000-8000-000000000001",
        },
        outcome: "success",
        occurredAt: iso(-0.05),
        subjectType: "core.tenant",
        subjectId: TENANT_IDS.sample,
        buildingId: null,
        ip: "203.0.113.20",
        before: null,
        after: null,
        metadata: { method: "GET", path: `/v1/admin/tenants/${TENANT_IDS.sample}/members` },
        supportGrantId: "8a100000-0000-4000-8000-000000000001",
      },
      {
        id: "a0000000-0000-4000-8000-000000000002",
        action: "tenant.bank_account.changed",
        actor: { type: "user", audience: "operator", id: "3b241101-e2bb-4255-8caf-4136c566a901" },
        outcome: "success",
        occurredAt: iso(-2),
        subjectType: "core.tenant_bank_account",
        subjectId: "a1000000-0000-4000-8000-000000000001",
        buildingId: null,
        ip: "203.0.113.10",
        before: null,
        after: { state: "active" },
        metadata: { tenantId: TENANT_IDS.sample },
        supportGrantId: null,
      },
      {
        id: "a0000000-0000-4000-8000-000000000003",
        action: "utility_tariff.published",
        actor: { type: "user", audience: "platform", id: PLATFORM_USER_IDS.checker },
        outcome: "success",
        occurredAt: iso(-48),
        subjectType: "platform.utility_tariff_version",
        subjectId: "9c000000-0000-4000-8000-000000000002",
        buildingId: null,
        ip: "203.0.113.30",
        before: { state: "verified" },
        after: { state: "published" },
        metadata: {},
        supportGrantId: null,
      },
    ],
    integrationEvents: [
      {
        id: "a2100000-0000-4000-8000-000000000001",
        direction: "outbound",
        system: "getbuild",
        type: "warranty.claim_requested",
        contractVersion: "1",
        aggregateRef: "service_request:SR-2610-0004",
        tenantId: TENANT_IDS.sample,
        state: "acked",
        attempts: 1,
        lastError: null,
        occurredAt: iso(-2),
        ackedAt: iso(-1.9),
      },
      {
        id: "a2100000-0000-4000-8000-000000000002",
        direction: "inbound",
        system: "getbuild",
        type: "warranty.claim_resolved",
        contractVersion: "1",
        aggregateRef: "service_request:SR-2610-0004",
        tenantId: TENANT_IDS.sample,
        state: "applied",
        attempts: 1,
        lastError: null,
        occurredAt: iso(-1),
        ackedAt: null,
      },
      {
        id: "a2100000-0000-4000-8000-000000000003",
        direction: "outbound",
        system: "getbuild",
        type: "work_order.completed",
        contractVersion: "1",
        aggregateRef: "work_order:9d3c0e1a",
        tenantId: TENANT_IDS.sample,
        state: "dead",
        attempts: 8,
        lastError: "getbuild bridge 503 Service Unavailable",
        occurredAt: iso(-0.5),
        ackedAt: null,
      },
    ],
    outbox: [
      {
        id: "a2000000-0000-4000-8000-000000000001",
        eventId: "a3000000-0000-4000-8000-000000000001",
        eventType: "invoice.issued",
        topic: "billing",
        tenantId: TENANT_IDS.sample,
        state: "dead",
        attempts: 8,
        lastError: "LINE API 500 Internal Server Error",
        createdAt: iso(-1),
      },
      {
        id: "a2000000-0000-4000-8000-000000000002",
        eventId: "a3000000-0000-4000-8000-000000000002",
        eventType: "payment.confirmed",
        topic: "payments",
        tenantId: TENANT_IDS.sample,
        state: "failed",
        attempts: 2,
        lastError: "timeout",
        createdAt: iso(-0.1),
      },
    ],
    consumptions: [
      {
        id: "a4000000-0000-4000-8000-000000000001",
        eventId: "a3000000-0000-4000-8000-000000000003",
        eventType: "lease.signed",
        subscriber: "documents.lease-pdf",
        state: "dead",
        attempts: 5,
        lastError: "Chromium crashed while printing",
        replayedAt: null,
      },
    ],
    devices: [
      gateway(DEVICE_IDS.gwSampleA, "GW-0001", "online", TENANT_IDS.sample, BUILDINGS.sampleA, "pilot"),
      // A building whose network blocks outbound 8883: the platform admin allowed the WebSocket fallback (D-239).
      gateway(DEVICE_IDS.gwSampleB, "GW-0002", "offline", TENANT_IDS.sample, BUILDINGS.sampleB, "canary", {
        mqttWsFallback: true,
      }),
      gateway(DEVICE_IDS.gwGarden, "GW-0003", "degraded", TENANT_IDS.garden, BUILDINGS.garden, "canary", {
        configAppliedVersion: 3,
      }),
      gateway(DEVICE_IDS.gwStock, "GW-0004", "inventory", null, null, "all"),
      {
        ...gateway(DEVICE_IDS.meterStock, "EM-9001", "inventory", null, null, "all"),
        kind: "electric_meter",
        model: "SDM120-Modbus",
        vendor: "Eastron",
        arch: null,
        driver: "eastron_sdm120",
        meters: 0,
      },
    ],
    configs: {
      [DEVICE_IDS.gwSampleA]: [
        {
          id: "a5000000-0000-4000-8000-000000000004",
          version: 4,
          meters: 12,
          compiledAt: iso(-3),
          publishedAt: iso(-3),
          appliedAt: iso(-3),
          rejectedAt: null,
          rejectError: null,
          driftFlaggedAt: null,
        },
        {
          id: "a5000000-0000-4000-8000-000000000003",
          version: 3,
          meters: 11,
          compiledAt: iso(-20),
          publishedAt: iso(-20),
          appliedAt: iso(-20),
          rejectedAt: null,
          rejectError: null,
          driftFlaggedAt: null,
        },
      ],
      [DEVICE_IDS.gwGarden]: [
        {
          id: "a5000000-0000-4000-8000-000000000014",
          version: 4,
          meters: 12,
          compiledAt: iso(-0.2),
          publishedAt: iso(-0.2),
          appliedAt: null,
          rejectedAt: null,
          rejectError: null,
          driftFlaggedAt: iso(-0.1),
        },
        {
          id: "a5000000-0000-4000-8000-000000000013",
          version: 3,
          meters: 11,
          compiledAt: iso(-9),
          publishedAt: iso(-9),
          appliedAt: iso(-9),
          rejectedAt: null,
          rejectError: null,
          driftFlaggedAt: null,
        },
      ],
    },
    deviceEvents: {
      [DEVICE_IDS.gwGarden]: [
        {
          // T-13 (D-241): the per-meter change a heartbeat reports, instead of the whole meters[] array.
          id: "a6000000-0000-4000-8000-000000000003",
          deviceId: "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e91",
          type: "meter_status_changed",
          severity: "warning",
          message: "meter 2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e91 ok → stale",
          occurredAt: iso(-0.01),
        },
        {
          id: "a6000000-0000-4000-8000-000000000001",
          deviceId: DEVICE_IDS.gwGarden,
          type: "meter_offline",
          severity: "warning",
          message: "Modbus address 7 timed out 3 times",
          occurredAt: iso(-0.02),
        },
        {
          id: "a6000000-0000-4000-8000-000000000002",
          deviceId: DEVICE_IDS.gwGarden,
          type: "restart",
          severity: "info",
          message: "agent 0.3.0 started",
          occurredAt: iso(-1),
        },
      ],
    },
    commands: [
      {
        id: "a7000000-0000-4000-8000-000000000001",
        gatewayDeviceId: DEVICE_IDS.gwGarden,
        type: "upload_logs",
        args: {},
        status: "done",
        attempts: 1,
        issuedAt: iso(-0.5),
        finishedAt: iso(-0.49),
        expiresAt: iso(-0.4),
        error: null,
        result: { fileId: "a8000000-0000-4000-8000-000000000001", sizeBytes: 182334 },
      },
    ],
    releaseObjects: {
      "releases/edge/0.3.0/getproperty-edge-0.3.0-linux-arm64": 17_904_640,
      "releases/edge/0.4.0/getproperty-edge-0.4.0-linux-arm64": 18_102_272,
    },
    releases: [
      {
        id: "a9000000-0000-4000-8000-000000000003",
        version: "0.4.0",
        arch: "arm64",
        channel: "stable",
        sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        keyId: "gp-ota-2026",
        artifactUrl:
          "https://device.getproperty.example/v1/device/ota/artifacts/0.4.0/getproperty-edge-0.4.0-linux-arm64",
        notes: "Modbus timeouts fixed",
        releasedAt: iso(-2),
        deprecatedAt: null,
      },
      {
        id: "a9000000-0000-4000-8000-000000000002",
        version: "0.3.0",
        arch: "arm64",
        channel: "stable",
        sha256: "1f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        keyId: "gp-ota-2026",
        artifactUrl:
          "https://device.getproperty.example/v1/device/ota/artifacts/0.3.0/getproperty-edge-0.3.0-linux-arm64",
        notes: null,
        releasedAt: iso(-60),
        deprecatedAt: null,
      },
    ],
    rollouts: [
      {
        id: "aa000000-0000-4000-8000-000000000001",
        release: {
          id: "a9000000-0000-4000-8000-000000000003",
          version: "0.4.0",
          arch: "arm64",
          channel: "stable",
          sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
          keyId: "gp-ota-2026",
          artifactUrl:
            "https://device.getproperty.example/v1/device/ota/artifacts/0.4.0/getproperty-edge-0.4.0-linux-arm64",
          notes: "Modbus timeouts fixed",
          releasedAt: iso(-2),
          deprecatedAt: null,
        },
        ring: "canary",
        status: "running",
        maxFailuresPct: "10.00",
        startedAt: iso(-0.05),
        finishedAt: null,
        counts: { applied: 1, commanded: 1 },
        devices: [
          {
            deviceId: DEVICE_IDS.gwSampleB,
            status: "applied",
            fromVersion: "0.3.0",
            error: null,
            updatedAt: iso(-0.03),
          },
          {
            deviceId: DEVICE_IDS.gwGarden,
            status: "commanded",
            fromVersion: "0.3.0",
            error: null,
            updatedAt: iso(-0.04),
          },
        ],
        nextActions: ["pause", "abort"],
      },
    ],
    ingestDeadLetters: [
      {
        id: "ab000000-0000-4000-8000-000000000001",
        channel: "mqtt",
        topic: "gp/v1/2f6c1d7e/telemetry",
        reason: "invalid_payload",
        detail: "readings[3].value must be a decimal string",
        gatewayDeviceId: DEVICE_IDS.gwGarden,
        payloadBytes: 1840,
        payloadPreview: '{"schema":1,"readings":[{"meterId":"m7","seq":88,"value":12.5}]}',
        receivedAt: iso(-0.3),
        replayedAt: null,
        replayOutcome: null,
      },
      {
        id: "ab000000-0000-4000-8000-000000000002",
        channel: "https_batch",
        topic: "/v1/device/readings/batch",
        reason: "unknown_gateway",
        detail: null,
        gatewayDeviceId: null,
        payloadBytes: 920,
        payloadPreview: '{"schema":1}',
        receivedAt: iso(-2),
        replayedAt: iso(-1.5),
        replayOutcome: "dead_letter",
      },
    ],
    platformUsers: [
      {
        id: PLATFORM_USER_IDS.admin,
        displayName: "Admin Test",
        email: "admin@example.com",
        roles: [{ role: "platform_admin", expiresAt: null }],
        status: "active",
        totpEnabled: false,
        lastLoginAt: null,
      },
      {
        id: PLATFORM_USER_IDS.support,
        displayName: "Support Test",
        email: "support@example.com",
        roles: [{ role: "support", expiresAt: null }],
        status: "active",
        totpEnabled: true,
        lastLoginAt: iso(-1),
      },
      {
        id: PLATFORM_USER_IDS.ops,
        displayName: "Ops Maker",
        email: "ops@example.com",
        roles: [{ role: "platform_admin", expiresAt: null }],
        status: "active",
        totpEnabled: true,
        lastLoginAt: iso(-1),
      },
      {
        id: PLATFORM_USER_IDS.checker,
        displayName: "Checker Two",
        email: "checker@example.com",
        roles: [{ role: "platform_admin", expiresAt: null }],
        status: "active",
        totpEnabled: true,
        lastLoginAt: iso(-3),
      },
      {
        id: PLATFORM_USER_IDS.finance,
        displayName: "Finance Test",
        email: "finance@example.com",
        roles: [{ role: "finance", expiresAt: null }],
        status: "active",
        totpEnabled: true,
        lastLoginAt: iso(-2),
      },
      {
        id: PLATFORM_USER_IDS.engineer,
        displayName: "Field Engineer",
        email: "engineer@example.com",
        roles: [{ role: "field_engineer", expiresAt: null }],
        status: "active",
        totpEnabled: true,
        lastLoginAt: iso(-4),
      },
    ],
    providerCredentials: [
      {
        row: {
          id: "ac000000-0000-4000-8000-000000000001",
          tenantId: TENANT_IDS.sample,
          kind: "payment",
          provider: "kbank",
          accountRefHint: "0042",
          keyNames: ["consumerId", "consumerSecret", "merchantId", "partnerId", "partnerSecret", "webhookSecret"],
          fingerprint: "9a1f03c2b7de",
          source: "import",
          createdAt: iso(-30),
          revokedAt: null,
          revokeReason: null,
        },
        accountRefHash: merchantRefHash("KB-M-000042"),
      },
      {
        row: {
          id: "ac000000-0000-4000-8000-000000000002",
          tenantId: TENANT_IDS.sample,
          kind: "lock",
          provider: "ttlock",
          accountRefHint: null,
          keyNames: ["clientId", "clientSecret", "password", "username"],
          fingerprint: "4c7e19a0d2f3",
          source: "admin",
          createdAt: iso(-12),
          revokedAt: null,
          revokeReason: null,
        },
        accountRefHash: null,
      },
      {
        row: {
          id: "ac000000-0000-4000-8000-000000000003",
          tenantId: TENANT_IDS.sample,
          kind: "lock",
          provider: "ttlock",
          accountRefHint: null,
          keyNames: ["clientId", "clientSecret", "password", "username"],
          fingerprint: "0b3d5e7f9a1c",
          source: "import",
          createdAt: iso(-40),
          revokedAt: iso(-12),
          revokeReason: "replaced: new TTLock developer account (ticket OPS-2026-118)",
        },
        accountRefHash: null,
      },
      {
        row: {
          id: "ac000000-0000-4000-8000-000000000004",
          tenantId: null,
          kind: "payment",
          provider: "scb",
          accountRefHint: "7781",
          keyNames: ["apiKey", "apiSecret", "billerId", "webhookSecret"],
          fingerprint: "e21c6a8b0f44",
          source: "import",
          createdAt: iso(-30),
          revokedAt: null,
          revokeReason: null,
        },
        accountRefHash: merchantRefHash("SCB-BILLER-7781"),
      },
    ],
    replies: new Map(),
    received: [],
  };
  for (const device of world.devices) device.nextActions = deviceNextActions(device);
  return world;
}
