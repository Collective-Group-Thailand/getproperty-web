import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import {
  BUILDING_A,
  BUILDING_B,
  FLOORS,
  INSPECTION_MOVE_IN_A201,
  LEASE_A201,
  LEASE_A202,
  PHOTO_LAST_A201,
  PHOTO_MOVE_IN_DOOR,
  PHOTO_MOVE_IN_WALLS,
  UNITS,
  period,
} from "../staff-world";
import { add, baht, mul, satang } from "./money";

type Schemas = components["schemas"];

/**
 * The owner console's world in the mock API (F2): the sample tenant's two properties — หอพักตัวอย่าง
 * (buildings A and B, the same floors, units, meters and leases the staff world uses) and a 300-unit
 * building C that exercises the unit board's virtualisation — with parties, leases in every state,
 * deposits (one settlement inspected and due in three days, one overdue), the current billing cycle
 * with drafts (an above-cap line, an estimate, a missing reading), last month's invoices, payments,
 * slips to review, receivables, meter readings and series, reading reviews, utility invoices and loss.
 * Typed against the generated contract, so a contract change breaks the mock at compile time.
 */

export const TENANT_ID = TENANTS.sample.profile.id;
export const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const PROPERTY_MAIN = "7b9f1c2e-3d4a-4f5b-8c6d-9e0f1a2b3c4d";
export const PROPERTY_BIG = "7b9f1c2e-3d4a-4f5b-8c6d-9e0f1a2b3c5e";
export const BUILDING_C = "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b8e";
export { BUILDING_A, BUILDING_B };

const DAY = 86_400_000;
const now = () => Date.now();
export const iso = (offsetDays = 0) => new Date(now() + offsetDays * DAY).toISOString();
/** A Bangkok calendar date `offsetDays` from today. */
export const day = (offsetDays = 0) => new Date(now() + 7 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10);

const ADDRESS: Schemas["AddressDto"] = {
  line1: "99/1 ถนนตัวอย่าง",
  line2: null,
  subdistrict: "แขวงตัวอย่าง",
  district: "เขตตัวอย่าง",
  province: "กรุงเทพมหานคร",
  postcode: "10000",
  country: "TH",
};

// ---------------------------------------------------------------------------------------------------
// Assets: properties, buildings, floors, units, unit profiles, utility accounts

export type OwnerUnit = Schemas["UnitDto"] & {
  /** Display data the board joins in (lessee, lease) — kept in the world, read by the board. */
  lesseePartyId: string | null;
};

export const FLOOR_A1 = id("f1000000", 1);
export const FLOOR_B1 = FLOORS.b1.floorId;
export const UNIT = {
  a201: UNITS.a201.id,
  a202: UNITS.a202.id,
  a203: id("6d9f0000", 203),
  a204: id("6d9f0000", 204),
  a301: UNITS.a301.id,
  a302: id("6d9f0000", 302),
  a303: id("6d9f0000", 303),
  a304: id("6d9f0000", 304),
  b101: UNITS.b101.id,
  b102: id("6d9f0000", 1102),
} as const;

export const PROFILE_STUDIO = id("9f0f0000", 1);
export const PROFILE_LARGE = id("9f0f0000", 2);

function buildingDto(
  partial: Pick<Schemas["BuildingDto"], "id" | "code" | "name" | "propertyId" | "floorsCount">,
): Schemas["BuildingDto"] {
  return {
    access: "operator",
    operatorTenantId: TENANT_ID,
    ownerTenantId: TENANT_ID,
    status: "active",
    type: "apartment",
    unitCount: 0,
    version: 1,
    ...partial,
  };
}

function unitDto(
  partial: Pick<OwnerUnit, "id" | "unitNo" | "buildingId" | "propertyId" | "floorId" | "floorLevel" | "status"> &
    Partial<OwnerUnit>,
): OwnerUnit {
  return {
    type: "room",
    areaSqm: "24.00",
    baseRent: "4500.00",
    currency: "THB",
    currentLeaseId: null,
    notes: null,
    ownershipRatio: null,
    statusChangedAt: iso(-30),
    statusReason: null,
    unitProfileId: PROFILE_STUDIO,
    unitProfileName: "ห้องสตูดิโอ",
    version: 1,
    nextActions: [],
    lesseePartyId: null,
    ...partial,
  };
}

/** C-0101 … C-1520: 15 floors × 20 units, statuses spread deterministically. */
function bigBuilding(): { floors: Schemas["FloorDto"][]; units: OwnerUnit[] } {
  const floors: Schemas["FloorDto"][] = [];
  const units: OwnerUnit[] = [];
  const statuses: Schemas["UnitStatus"][] = ["occupied", "occupied", "occupied", "vacant", "occupied", "reserved"];
  for (let level = 1; level <= 15; level += 1) {
    const floorId = id("f3000000", level);
    floors.push({
      id: floorId,
      buildingId: BUILDING_C,
      level,
      name: `ชั้น ${level}`,
      sortOrder: level,
      unitCount: 20,
    });
    for (let n = 1; n <= 20; n += 1) {
      const unitNo = `C-${String(level).padStart(2, "0")}${String(n).padStart(2, "0")}`;
      const status = level === 7 && n === 7 ? "maintenance" : statuses[(level * 7 + n) % statuses.length]!;
      units.push(
        unitDto({
          id: id("6d9f3000", level * 100 + n),
          unitNo,
          buildingId: BUILDING_C,
          propertyId: PROPERTY_BIG,
          floorId,
          floorLevel: level,
          status,
          baseRent: n % 5 === 0 ? "6500.00" : "4200.00",
          unitProfileId: null,
          unitProfileName: null,
        }),
      );
    }
  }
  return { floors, units };
}

// ---------------------------------------------------------------------------------------------------
// Parties

export const PARTY = {
  somsak: id("9a700000", 1),
  malee: id("9a700000", 2),
  anan: id("9a700000", 3),
  company: id("9a700000", 4),
  newcomer: id("9a700000", 5),
  pim: id("9a700000", 6),
  former303: id("9a700000", 7),
  former102: id("9a700000", 8),
} as const;

function partyDto(
  partial: Pick<Schemas["PartyDto"], "id" | "displayName"> & Partial<Schemas["PartyDto"]>,
): Schemas["PartyDto"] {
  return {
    type: "person",
    address: null,
    anonymised: false,
    companyName: null,
    createdAt: iso(-200),
    dateOfBirth: null,
    email: null,
    emergencyContact: null,
    firstName: null,
    lastName: null,
    gender: null,
    idDocumentCountry: "TH",
    idDocumentType: "thai_national_id",
    idExpiresOn: null,
    idNumberOnFile: true,
    language: "th",
    lineLinked: false,
    linkedLogins: 0,
    nationality: "TH",
    notes: null,
    occupantProfile: null,
    phone: null,
    taxId: null,
    version: 1,
    ...partial,
  };
}

function initialParties(): Schemas["PartyDto"][] {
  return [
    partyDto({
      id: PARTY.somsak,
      displayName: "สมศักดิ์ ใจดี",
      firstName: "สมศักดิ์",
      lastName: "ใจดี",
      phone: "+66810000101",
      lineLinked: true,
      linkedLogins: 1,
      emergencyContact: { name: "สมใจ ใจดี", relation: "มารดา", phoneOnFile: true },
    }),
    partyDto({
      id: PARTY.malee,
      displayName: "มาลี ศรีสุข",
      firstName: "มาลี",
      lastName: "ศรีสุข",
      phone: "+66810000102",
    }),
    partyDto({
      id: PARTY.anan,
      displayName: "อนันต์ พากเพียร",
      firstName: "อนันต์",
      lastName: "พากเพียร",
      phone: "+66810000103",
      lineLinked: true,
      linkedLogins: 1,
    }),
    partyDto({
      id: PARTY.company,
      type: "company",
      displayName: "บริษัท ตัวอย่างการค้า จำกัด",
      companyName: "บริษัท ตัวอย่างการค้า จำกัด",
      taxId: "0105500000001",
      idNumberOnFile: false,
      idDocumentType: null,
      phone: "+66810000104",
      email: "office@example.com",
    }),
    partyDto({
      id: PARTY.newcomer,
      displayName: "ปรีชา มาใหม่",
      firstName: "ปรีชา",
      lastName: "มาใหม่",
      phone: "+66810000105",
      idNumberOnFile: false,
    }),
    partyDto({
      id: PARTY.pim,
      displayName: "พิมพ์ พากเพียร",
      firstName: "พิมพ์",
      lastName: "พากเพียร",
      idNumberOnFile: false,
    }),
    partyDto({
      id: PARTY.former303,
      displayName: "วิชัย ย้ายออก",
      firstName: "วิชัย",
      lastName: "ย้ายออก",
      phone: "+66810000107",
    }),
    partyDto({
      id: PARTY.former102,
      displayName: "กมล ลาจาก",
      firstName: "กมล",
      lastName: "ลาจาก",
      phone: "+66810000108",
    }),
  ];
}

// ---------------------------------------------------------------------------------------------------
// Leases

export const LEASE = {
  a201: LEASE_A201,
  a202: LEASE_A202,
  a302: id("1ea50000", 302),
  b101: id("1ea50000", 1101),
  a303old: id("1ea50000", 9303),
  b102old: id("1ea50000", 9102),
  a204old: id("1ea50000", 9204),
} as const;

export const TEMPLATE_STANDARD = id("7e3a0000", 1);
export const TEMPLATE_VERSION = id("7e3a0000", 11);

const COMPLIANCE_OK: Schemas["LeaseComplianceViewDto"] = {
  inScope: true,
  evaluatedAt: iso(-1),
  checks: [
    { ruleId: "compliance.deposit_cap", outcome: "pass", severity: "block", acknowledgementId: null },
    { ruleId: "compliance.standard_contract", outcome: "pass", severity: "block", acknowledgementId: null },
  ],
};

function leaseDto(
  partial: Pick<
    Schemas["LeaseDto"],
    "id" | "unitId" | "unitNo" | "buildingId" | "lesseePartyId" | "lesseeName" | "status" | "startDate" | "endDate"
  > &
    Partial<Schemas["LeaseDto"]>,
): Schemas["LeaseDto"] {
  return {
    addendum: [],
    advanceRentAmount: "4500.00",
    billingDay: null,
    buildingName: partial.buildingId === BUILDING_B ? "อาคาร B" : "อาคาร A",
    compliance: COMPLIANCE_OK,
    contract: null,
    createdAt: iso(-400),
    currency: "THB",
    depositAmount: "4500.00",
    keysCount: 2,
    lines: [
      {
        id: crypto.randomUUID(),
        kind: "internet",
        description: "อินเทอร์เน็ต",
        amount: "300.00",
        recurrence: "monthly",
        effectiveFrom: partial.startDate,
      },
    ],
    months: 12,
    moveInAt: null,
    moveOutAt: null,
    nextActions: [],
    notice: null,
    number: null,
    parkingSlots: 0,
    parties: [
      {
        partyId: partial.lesseePartyId,
        displayName: partial.lesseeName,
        role: "lessee",
        isSigner: true,
        signedAt: null,
      },
    ],
    renewedFromLeaseId: null,
    rent: "4500.00",
    rentIncreases: [],
    signatures: [],
    termination: null,
    terms: {},
    utilityBillingMode: "metered",
    version: 3,
    ...partial,
  };
}

const signed = (partyId: string | null, role: Schemas["SignerRole"], at: string): Schemas["LeaseSignatureViewDto"] => ({
  id: crypto.randomUUID(),
  partyId,
  signerRole: role,
  method: role === "lessor" ? "draw_web" : "draw_liff",
  signedAt: at,
  otpVerified: role !== "lessor",
  lineLinked: role !== "lessor",
  pdfSha256: "9f2b7c1e4a5d6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8",
});

function initialLeases(): Schemas["LeaseDto"][] {
  const contract = (signedBoth: boolean): Schemas["LeaseContractViewDto"] => ({
    documentId: crypto.randomUUID(),
    sha256: "9f2b7c1e4a5d6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8",
    signed: signedBoth,
  });
  return [
    leaseDto({
      id: LEASE.a201,
      number: "CT-2568-00031",
      unitId: UNIT.a201,
      unitNo: "A-201",
      buildingId: BUILDING_A,
      lesseePartyId: PARTY.somsak,
      lesseeName: "สมศักดิ์ ใจดี",
      status: "notice_given",
      startDate: day(-350),
      endDate: day(15),
      moveInAt: iso(-350),
      contract: contract(true),
      notice: { by: "lessee", givenAt: iso(-20), effectiveDate: day(10), reasonCode: null, evidenceDocumentIds: [] },
      signatures: [signed(PARTY.somsak, "lessee", iso(-352)), signed(null, "lessor", iso(-351))],
      parties: [
        { partyId: PARTY.somsak, displayName: "สมศักดิ์ ใจดี", role: "lessee", isSigner: true, signedAt: iso(-352) },
      ],
      nextActions: ["begin-move-out", "terminate"],
    }),
    leaseDto({
      id: LEASE.a202,
      number: "CT-2569-00007",
      unitId: UNIT.a202,
      unitNo: "A-202",
      buildingId: BUILDING_A,
      lesseePartyId: PARTY.malee,
      lesseeName: "มาลี ศรีสุข",
      status: "pending_signature",
      startDate: day(3),
      endDate: day(368),
      contract: contract(false),
      signatures: [signed(PARTY.malee, "lessee", iso(-1))],
      parties: [
        { partyId: PARTY.malee, displayName: "มาลี ศรีสุข", role: "lessee", isSigner: true, signedAt: iso(-1) },
      ],
      nextActions: ["countersign", "cancel"],
    }),
    leaseDto({
      id: LEASE.a302,
      number: "CT-2569-00002",
      unitId: UNIT.a302,
      unitNo: "A-302",
      buildingId: BUILDING_A,
      lesseePartyId: PARTY.anan,
      lesseeName: "อนันต์ พากเพียร",
      status: "active",
      startDate: day(-120),
      endDate: day(245),
      rent: "6500.00",
      depositAmount: "6500.00",
      advanceRentAmount: "6500.00",
      moveInAt: iso(-120),
      contract: contract(true),
      lines: [
        {
          id: crypto.randomUUID(),
          kind: "internet",
          description: "อินเทอร์เน็ต",
          amount: "300.00",
          recurrence: "monthly",
          effectiveFrom: day(-120),
        },
        {
          id: crypto.randomUUID(),
          kind: "parking",
          description: "ที่จอดรถ 1 คัน",
          amount: "500.00",
          recurrence: "monthly",
          effectiveFrom: day(-120),
        },
      ],
      parkingSlots: 1,
      signatures: [signed(PARTY.anan, "lessee", iso(-125)), signed(null, "lessor", iso(-124))],
      parties: [
        { partyId: PARTY.anan, displayName: "อนันต์ พากเพียร", role: "lessee", isSigner: true, signedAt: iso(-125) },
        { partyId: PARTY.pim, displayName: "พิมพ์ พากเพียร", role: "occupant", isSigner: false, signedAt: null },
      ],
      nextActions: ["record-notice", "renew", "terminate"],
    }),
    leaseDto({
      id: LEASE.b101,
      number: "CT-2569-00004",
      unitId: UNIT.b101,
      unitNo: "B-101",
      buildingId: BUILDING_B,
      lesseePartyId: PARTY.company,
      lesseeName: "บริษัท ตัวอย่างการค้า จำกัด",
      status: "active",
      startDate: day(-60),
      endDate: day(305),
      rent: "5200.00",
      depositAmount: "5200.00",
      advanceRentAmount: "5200.00",
      moveInAt: iso(-60),
      contract: contract(true),
      signatures: [signed(PARTY.company, "lessee", iso(-62)), signed(null, "lessor", iso(-61))],
      parties: [
        {
          partyId: PARTY.company,
          displayName: "บริษัท ตัวอย่างการค้า จำกัด",
          role: "lessee",
          isSigner: true,
          signedAt: iso(-62),
        },
      ],
      nextActions: ["record-notice", "renew", "terminate"],
    }),
    leaseDto({
      id: LEASE.a303old,
      number: "CT-2568-00019",
      unitId: UNIT.a303,
      unitNo: "A-303",
      buildingId: BUILDING_A,
      lesseePartyId: PARTY.former303,
      lesseeName: "วิชัย ย้ายออก",
      status: "ended",
      startDate: day(-369),
      endDate: day(-4),
      moveInAt: iso(-369),
      moveOutAt: iso(-4),
      contract: contract(true),
      nextActions: [],
    }),
    leaseDto({
      id: LEASE.b102old,
      number: "CT-2568-00011",
      unitId: UNIT.b102,
      unitNo: "B-102",
      buildingId: BUILDING_B,
      lesseePartyId: PARTY.former102,
      lesseeName: "กมล ลาจาก",
      status: "ended",
      startDate: day(-374),
      endDate: day(-9),
      moveInAt: iso(-374),
      moveOutAt: iso(-9),
      contract: contract(true),
      nextActions: [],
    }),
    leaseDto({
      id: LEASE.a204old,
      number: "CT-2567-00040",
      unitId: UNIT.a204,
      unitNo: "A-204",
      buildingId: BUILDING_A,
      lesseePartyId: PARTY.former102,
      lesseeName: "กมล ลาจาก",
      status: "ended",
      startDate: day(-800),
      endDate: day(-400),
      moveInAt: iso(-800),
      moveOutAt: iso(-400),
      contract: contract(true),
      nextActions: [],
    }),
  ];
}

function initialLeaseEvents(): Map<string, Schemas["LeaseEventDto"][]> {
  const event = (type: string, offset: number, data: Record<string, unknown> = {}, actorType = "user") => ({
    id: crypto.randomUUID(),
    type,
    occurredAt: iso(offset),
    actorType,
    data,
  });
  return new Map([
    [
      LEASE.a201,
      [
        event("drafted", -360),
        event("sent_for_signature", -355, { number: "CT-2568-00031" }),
        event("signed", -352, { signerRole: "lessee" }),
        event("activated", -351, { signerRole: "lessor" }),
        event("moved_in", -350, {}, "system"),
        event("notice_given", -20, { by: "lessee", effectiveDate: day(10) }),
      ],
    ],
    [
      LEASE.a202,
      [
        event("drafted", -5),
        event("sent_for_signature", -4, { number: "CT-2569-00007" }),
        event("invitation_created", -4, { channel: "line_qr" }),
        event("signed", -1, { signerRole: "lessee" }),
      ],
    ],
    [LEASE.a302, [event("drafted", -130), event("moved_in", -120, {}, "system")]],
  ]);
}

// ---------------------------------------------------------------------------------------------------
// Deposits & settlements

export const DEPOSIT = {
  a201: id("de900000", 201),
  a202: id("de900000", 202),
  a302: id("de900000", 302),
  b101: id("de900000", 1101),
  a303: id("de900000", 303),
  b102: id("de900000", 1102),
  a204: id("de900000", 204),
} as const;

export const INSPECTION = {
  moveIn303: id("15e00000", 303),
  moveOut303: id("15e00000", 1303),
  moveIn102: id("15e00000", 102),
  moveOut102: id("15e00000", 1102),
} as const;

export const PHOTO = {
  moveIn303Walls: PHOTO_MOVE_IN_WALLS,
  moveIn303Door: PHOTO_MOVE_IN_DOOR,
  moveOut303Walls: id("d0c00000", 31),
  moveOut303Aircon: id("d0c00000", 32),
  lastReadingA201: PHOTO_LAST_A201,
} as const;

function deposit(
  partial: Pick<Schemas["DepositDto"], "id" | "leaseId" | "unitNo" | "status" | "lesseeName" | "leaseNumber"> &
    Partial<Schemas["DepositDto"]>,
): Schemas["DepositDto"] {
  return {
    amountSecurity: "4500.00",
    amountAdvanceRent: "4500.00",
    carriedFromDepositId: null,
    currency: "THB",
    receiptNumber: null,
    receivedAt: null,
    settlement: null,
    nextActions: [],
    version: 2,
    ...partial,
  };
}

function comparison303(): Schemas["InspectionComparisonDto"] {
  const side = (
    itemId: string,
    condition: Schemas["ItemCondition"],
    photos: string[],
    notes: string | null = null,
    meterRegister: string | null = null,
  ): Schemas["ComparisonSideDto"] => ({
    inspectionItemId: itemId,
    condition,
    photoDocumentIds: photos,
    notes,
    meterRegister,
  });
  return {
    moveInInspectionId: INSPECTION.moveIn303,
    moveOutInspectionId: INSPECTION.moveOut303,
    lines: [
      {
        itemKey: "walls",
        label: "ผนังและสี",
        area: "room",
        changed: true,
        moveIn: side(id("17e30000", 1), "good", [PHOTO.moveIn303Walls]),
        moveOut: side(id("17e40000", 1), "damaged", [PHOTO.moveOut303Walls], "ผนังเป็นรูขนาด 5 ซม. ข้างประตู"),
      },
      {
        itemKey: "door_lock",
        label: "ประตูและกุญแจ",
        area: "room",
        changed: false,
        moveIn: side(id("17e30000", 2), "good", [PHOTO.moveIn303Door]),
        moveOut: side(id("17e40000", 2), "good", []),
      },
      {
        itemKey: "asset:aircon",
        label: "เครื่องปรับอากาศ",
        area: "room",
        changed: true,
        moveIn: side(id("17e30000", 3), "good", []),
        moveOut: side(id("17e40000", 3), "missing", [PHOTO.moveOut303Aircon], "รีโมตแอร์หาย"),
      },
      {
        itemKey: "meter:electric",
        label: "มิเตอร์ไฟฟ้า",
        area: null,
        changed: false,
        moveIn: side(id("17e30000", 4), "good", [], null, "5100.000"),
        moveOut: side(id("17e40000", 4), "good", [], null, "6420.500"),
      },
    ],
  };
}

function initialDeposits(): Schemas["DepositDto"][] {
  return [
    deposit({
      id: DEPOSIT.a201,
      leaseId: LEASE.a201,
      leaseNumber: "CT-2568-00031",
      unitNo: "A-201",
      lesseeName: "สมศักดิ์ ใจดี",
      status: "held",
      receiptNumber: "DRC-2568-00031",
      receivedAt: iso(-350),
    }),
    deposit({
      id: DEPOSIT.a202,
      leaseId: LEASE.a202,
      leaseNumber: "CT-2569-00007",
      unitNo: "A-202",
      lesseeName: "มาลี ศรีสุข",
      status: "pending",
      nextActions: ["record-receipt"],
      version: 1,
    }),
    deposit({
      id: DEPOSIT.a302,
      leaseId: LEASE.a302,
      leaseNumber: "CT-2569-00002",
      unitNo: "A-302",
      lesseeName: "อนันต์ พากเพียร",
      status: "held",
      amountSecurity: "6500.00",
      amountAdvanceRent: "6500.00",
      receiptNumber: "DRC-2569-00002",
      receivedAt: iso(-120),
    }),
    deposit({
      id: DEPOSIT.b101,
      leaseId: LEASE.b101,
      leaseNumber: "CT-2569-00004",
      unitNo: "B-101",
      lesseeName: "บริษัท ตัวอย่างการค้า จำกัด",
      status: "held",
      amountSecurity: "5200.00",
      amountAdvanceRent: "5200.00",
      receiptNumber: "DRC-2569-00004",
      receivedAt: iso(-60),
    }),
    deposit({
      id: DEPOSIT.a303,
      leaseId: LEASE.a303old,
      leaseNumber: "CT-2568-00019",
      unitNo: "A-303",
      lesseeName: "วิชัย ย้ายออก",
      status: "settling",
      receiptNumber: "DRC-2568-00019",
      receivedAt: iso(-369),
      nextActions: ["propose"],
      settlement: {
        id: id("5e770000", 303),
        status: "inspected",
        depositHeld: "4500.00",
        advanceRentUnused: "0.00",
        utilitiesFinal: "0.00",
        deductionsTotal: "0.00",
        proposedRefund: null,
        agreedRefund: null,
        refundAmount: null,
        refundMethod: null,
        refundedAt: null,
        residentResponse: null,
        disputeReason: null,
        statementNumber: null,
        isLate: false,
        moveOutAt: iso(-4),
        deadlineAt: iso(3),
        moveInInspectionId: INSPECTION.moveIn303,
        moveOutInspectionId: INSPECTION.moveOut303,
        items: [],
      },
    }),
    deposit({
      id: DEPOSIT.b102,
      leaseId: LEASE.b102old,
      leaseNumber: "CT-2568-00011",
      unitNo: "B-102",
      lesseeName: "กมล ลาจาก",
      status: "settling",
      receiptNumber: "DRC-2568-00011",
      receivedAt: iso(-374),
      nextActions: ["record-refund"],
      settlement: {
        id: id("5e770000", 1102),
        status: "agreed",
        depositHeld: "4500.00",
        advanceRentUnused: "0.00",
        utilitiesFinal: "312.50",
        deductionsTotal: "500.00",
        proposedRefund: "3687.50",
        agreedRefund: "3687.50",
        refundAmount: null,
        refundMethod: null,
        refundedAt: null,
        residentResponse: "accepted",
        disputeReason: null,
        statementNumber: null,
        isLate: true,
        moveOutAt: iso(-9),
        deadlineAt: iso(-2),
        moveInInspectionId: INSPECTION.moveIn102,
        moveOutInspectionId: INSPECTION.moveOut102,
        items: [
          {
            id: id("dedc0000", 1),
            kind: "cleaning",
            description: "ทำความสะอาดห้องหลังย้ายออก",
            amount: "500.00",
            evidenceDocumentIds: [id("d0c00000", 41)],
            inspectionItemId: null,
            residentAccepted: true,
          },
        ],
      },
    }),
    deposit({
      id: DEPOSIT.a204,
      leaseId: LEASE.a204old,
      leaseNumber: "CT-2567-00040",
      unitNo: "A-204",
      lesseeName: "กมล ลาจาก",
      status: "refunded",
      receiptNumber: "DRC-2567-00040",
      receivedAt: iso(-800),
      settlement: {
        id: id("5e770000", 204),
        status: "closed",
        depositHeld: "4500.00",
        advanceRentUnused: "0.00",
        utilitiesFinal: "0.00",
        deductionsTotal: "0.00",
        proposedRefund: "4500.00",
        agreedRefund: "4500.00",
        refundAmount: "4500.00",
        refundMethod: "bank_transfer",
        refundedAt: iso(-396),
        residentResponse: "accepted",
        disputeReason: null,
        statementNumber: "DST-2568-00003",
        isLate: false,
        moveOutAt: iso(-400),
        deadlineAt: iso(-393),
        moveInInspectionId: null,
        moveOutInspectionId: null,
        items: [],
      },
    }),
  ];
}

// ---------------------------------------------------------------------------------------------------
// Billing: rate plans, cycles, invoices

export const RATE_PLAN = { power: id("7a7e0000", 1), water: id("7a7e0000", 2) } as const;
export const CYCLE = { current: id("c7c10000", 1), previous: id("c7c10000", 2) } as const;
export const INVOICE = {
  a201prev: id("1e700000", 101),
  a302prev: id("1e700000", 102),
  b101prev: id("1e700000", 103),
  a201draft: id("1e700000", 201),
  a302draft: id("1e700000", 202),
  b101draft: id("1e700000", 203),
} as const;

export type MockInvoice = Schemas["InvoiceDto"] & {
  /** Payment and reminder history kept beside the invoice. */
  remindersLog: Schemas["DunningReminderDto"][];
  penalty: Schemas["PenaltyDto"] | null;
};

function previousPeriodKey(): string {
  const [year, month] = period().periodKey.split("-").map(Number) as [number, number];
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  return prev;
}

function periodBounds(key: string): { start: string; end: string } {
  const [year, month] = key.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${key}-01`, end: `${key}-${String(last).padStart(2, "0")}` };
}

export const PERIODS = {
  current: () => period().periodKey,
  previous: previousPeriodKey,
  bounds: periodBounds,
};

function line(
  partial: Pick<Schemas["InvoiceLineDto"], "lineNo" | "sourceType" | "lineKind" | "description" | "amount"> &
    Partial<Schemas["InvoiceLineDto"]>,
): Schemas["InvoiceLineDto"] {
  return {
    id: crypto.randomUUID(),
    aboveCap: false,
    capPerUnit: null,
    complianceAcknowledgementId: null,
    isEstimated: false,
    meterSegments: [],
    periodFrom: null,
    periodTo: null,
    proRata: null,
    quantity: "1.000",
    ratePlanVersionId: null,
    readingSource: null,
    registerFrom: null,
    registerTo: null,
    tierBreakdown: null,
    unit: null,
    unitPrice: null,
    units: null,
    utilityTariffVersionId: null,
    vatApplicable: false,
    ...partial,
  };
}

function meterLine(
  lineNo: number,
  utility: "electric" | "water",
  from: string,
  to: string,
  units: string,
  unitPrice: string,
  amount: string,
  options: { source?: string; aboveCap?: boolean; estimated?: boolean; photo?: string | null; code: string } = {
    code: "",
  },
): Schemas["InvoiceLineDto"] {
  return line({
    lineNo,
    sourceType: "meter",
    lineKind: utility === "electric" ? "electricity" : "water",
    description: utility === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา",
    amount,
    quantity: units,
    units,
    unit: utility === "electric" ? "kwh" : "m3",
    unitPrice,
    registerFrom: from,
    registerTo: to,
    readingSource: options.source ?? "ocr",
    aboveCap: options.aboveCap ?? false,
    capPerUnit: utility === "electric" ? "4.1800" : "10.5000",
    isEstimated: options.estimated ?? false,
    ratePlanVersionId: id("7a7e1000", utility === "electric" ? 1 : 2),
    utilityTariffVersionId: id("7a7f1000", utility === "electric" ? 1 : 2),
    meterSegments: [
      {
        meterAssignmentId: id("aa000000", 1),
        code: options.code,
        units,
        from: { readAt: iso(-31), readingId: crypto.randomUUID(), register: from, source: "ocr" },
        to: {
          readAt: iso(-1),
          readingId: options.photo ? id("e0000000", 91) : crypto.randomUUID(),
          register: to,
          source: options.source ?? "ocr",
        },
      },
    ],
    complianceAcknowledgementId: null,
  });
}

function invoice(
  partial: Pick<
    MockInvoice,
    "id" | "unitId" | "unitNo" | "buildingId" | "billedPartyId" | "billedPartyName" | "leaseId" | "status" | "lines"
  > &
    Partial<MockInvoice>,
): MockInvoice {
  const subtotal = add(...partial.lines.map((l) => l.amount));
  return {
    amountDue: subtotal,
    balance: subtotal,
    billingCycleId: null,
    complianceFlags: [],
    creditNotes: [],
    creditedTotal: "0.00",
    debitNotes: [],
    debitedTotal: "0.00",
    dueDate: null,
    hasAboveCapLine: partial.lines.some((l) => l.aboveCap),
    hasEstimate: partial.lines.some((l) => l.isEstimated),
    isFinal: false,
    issuedAt: null,
    leaseNumber: null,
    nextActions: [],
    number: null,
    paidTotal: "0.00",
    periodStart: day(-30),
    periodEnd: day(-1),
    priorBalance: "0.00",
    promptpayRef: null,
    replacedByInvoiceId: null,
    replacesInvoiceId: null,
    reviewFlags: [],
    snapshotSha256: null,
    subtotal,
    total: subtotal,
    vatAmount: "0.00",
    version: 1,
    voidReason: null,
    voidedAt: null,
    remindersLog: [],
    penalty: null,
    ...partial,
  };
}

function initialInvoices(): MockInvoice[] {
  const prev = periodBounds(previousPeriodKey());
  const cur = periodBounds(period().periodKey);
  const rent = (lineNo: number, amount: string, unitNo: string) =>
    line({
      lineNo,
      sourceType: "rent",
      lineKind: "rent",
      description: `ค่าเช่าห้อง ${unitNo}`,
      amount,
      unitPrice: amount,
      unit: "month",
    });
  const internet = (lineNo: number) =>
    line({
      lineNo,
      sourceType: "service",
      lineKind: "internet",
      description: "อินเทอร์เน็ต",
      amount: "300.00",
      unitPrice: "300.00",
    });
  const parking = (lineNo: number) =>
    line({
      lineNo,
      sourceType: "service",
      lineKind: "parking",
      description: "ที่จอดรถ 1 คัน",
      amount: "500.00",
      unitPrice: "500.00",
    });

  const a201prev = invoice({
    id: INVOICE.a201prev,
    number: "INV-2569-000101",
    unitId: UNIT.a201,
    unitNo: "A-201",
    buildingId: BUILDING_A,
    billedPartyId: PARTY.somsak,
    billedPartyName: "สมศักดิ์ ใจดี",
    leaseId: LEASE.a201,
    leaseNumber: "CT-2568-00031",
    billingCycleId: CYCLE.previous,
    status: "paid",
    periodStart: prev.start,
    periodEnd: prev.end,
    issuedAt: iso(-15),
    dueDate: day(-10),
    promptpayRef: "INV2569000101",
    snapshotSha256: "1b2c3d4e5f60718293a4b5c6d7e8f9011b2c3d4e5f60718293a4b5c6d7e8f901",
    lines: [
      rent(1, "4500.00", "A-201"),
      meterLine(2, "electric", "12010.000", "12300.000", "290.000", "5.0000", "1450.00", {
        code: "E-A-201",
        aboveCap: true,
        photo: PHOTO.lastReadingA201,
      }),
      meterLine(3, "water", "838.000", "845.200", "7.200", "18.0000", "129.60", { code: "W-A-201", source: "manual" }),
      internet(4),
    ],
  });
  a201prev.lines[1]!.complianceAcknowledgementId = id("ac000000", 1);
  a201prev.paidTotal = a201prev.total;
  a201prev.balance = "0.00";

  const a302prev = invoice({
    id: INVOICE.a302prev,
    number: "INV-2569-000102",
    unitId: UNIT.a302,
    unitNo: "A-302",
    buildingId: BUILDING_A,
    billedPartyId: PARTY.anan,
    billedPartyName: "อนันต์ พากเพียร",
    leaseId: LEASE.a302,
    leaseNumber: "CT-2569-00002",
    billingCycleId: CYCLE.previous,
    status: "overdue",
    periodStart: prev.start,
    periodEnd: prev.end,
    issuedAt: iso(-45),
    dueDate: day(-35),
    promptpayRef: "INV2569000102",
    snapshotSha256: "2b2c3d4e5f60718293a4b5c6d7e8f9011b2c3d4e5f60718293a4b5c6d7e8f902",
    nextActions: ["send-reminder", "resend"],
    lines: [
      rent(1, "6500.00", "A-302"),
      meterLine(2, "electric", "3010.000", "3190.000", "180.000", "4.0000", "720.00", { code: "E-A-302" }),
      meterLine(3, "water", "220.000", "229.000", "9.000", "18.0000", "162.00", {
        code: "W-A-302",
        source: "estimated",
        estimated: true,
      }),
      internet(4),
      parking(5),
    ],
  });
  a302prev.paidTotal = "1000.00";
  a302prev.balance = baht(satang(a302prev.total) - 100000);
  a302prev.amountDue = a302prev.total;
  a302prev.remindersLog = [
    {
      id: crypto.randomUUID(),
      step: 1,
      status: "sent",
      triggeredBy: "schedule",
      scheduledFor: iso(-34),
      sentAt: iso(-34),
    },
    {
      id: crypto.randomUUID(),
      step: 3,
      status: "sent",
      triggeredBy: "schedule",
      scheduledFor: iso(-32),
      sentAt: iso(-32),
    },
    {
      id: crypto.randomUUID(),
      step: 7,
      status: "deferred_quiet_hours",
      triggeredBy: "schedule",
      scheduledFor: iso(-28),
      sentAt: iso(-27),
    },
  ];

  const b101prev = invoice({
    id: INVOICE.b101prev,
    number: "INV-2569-000103",
    unitId: UNIT.b101,
    unitNo: "B-101",
    buildingId: BUILDING_B,
    billedPartyId: PARTY.company,
    billedPartyName: "บริษัท ตัวอย่างการค้า จำกัด",
    leaseId: LEASE.b101,
    leaseNumber: "CT-2569-00004",
    billingCycleId: CYCLE.previous,
    status: "issued",
    periodStart: prev.start,
    periodEnd: prev.end,
    issuedAt: iso(-5),
    dueDate: day(0),
    promptpayRef: "INV2569000103",
    snapshotSha256: "3b2c3d4e5f60718293a4b5c6d7e8f9011b2c3d4e5f60718293a4b5c6d7e8f903",
    nextActions: ["void", "resend", "send-reminder"],
    lines: [
      rent(1, "5200.00", "B-101"),
      meterLine(2, "electric", "40.000", "100.000", "60.000", "4.0000", "240.00", {
        code: "E-B-101",
        source: "manual",
      }),
      meterLine(3, "water", "48.000", "52.000", "4.000", "18.0000", "72.00", { code: "W-B-101", source: "manual" }),
    ],
  });

  const a201draft = invoice({
    id: INVOICE.a201draft,
    unitId: UNIT.a201,
    unitNo: "A-201",
    buildingId: BUILDING_A,
    billedPartyId: PARTY.somsak,
    billedPartyName: "สมศักดิ์ ใจดี",
    leaseId: LEASE.a201,
    leaseNumber: "CT-2568-00031",
    billingCycleId: CYCLE.current,
    status: "draft",
    periodStart: cur.start,
    periodEnd: cur.end,
    reviewFlags: ["acknowledgement_required:tariff_cap"],
    complianceFlags: ["above_cap:electricity"],
    nextActions: ["recompute"],
    lines: [
      rent(1, "4500.00", "A-201"),
      meterLine(2, "electric", "12300.000", "12512.400", "212.400", "5.0000", "1062.00", {
        code: "E-A-201",
        aboveCap: true,
        photo: PHOTO.lastReadingA201,
      }),
      meterLine(3, "water", "845.200", "851.000", "5.800", "18.0000", "104.40", { code: "W-A-201", source: "manual" }),
      internet(4),
    ],
  });
  a201draft.priorBalance = "0.00";

  const a302draft = invoice({
    id: INVOICE.a302draft,
    unitId: UNIT.a302,
    unitNo: "A-302",
    buildingId: BUILDING_A,
    billedPartyId: PARTY.anan,
    billedPartyName: "อนันต์ พากเพียร",
    leaseId: LEASE.a302,
    leaseNumber: "CT-2569-00002",
    billingCycleId: CYCLE.current,
    status: "draft",
    periodStart: cur.start,
    periodEnd: cur.end,
    nextActions: ["recompute"],
    lines: [
      rent(1, "6500.00", "A-302"),
      meterLine(2, "electric", "3190.000", "3375.000", "185.000", "4.0000", "740.00", {
        code: "E-A-302",
        source: "iot",
      }),
      meterLine(3, "water", "229.000", "236.000", "7.000", "18.0000", "126.00", {
        code: "W-A-302",
        source: "estimated",
        estimated: true,
      }),
      internet(4),
      parking(5),
      line({
        lineNo: 6,
        sourceType: "rent",
        lineKind: "estimate_settlement",
        description: "ปรับค่าน้ำประมาณการรอบก่อน",
        amount: "-18.00",
        quantity: "-1.000",
        unit: "m3",
        unitPrice: "18.0000",
      }),
    ],
  });
  a302draft.priorBalance = a302prev.balance;
  a302draft.amountDue = add(a302draft.total, a302draft.priorBalance);

  const b101draft = invoice({
    id: INVOICE.b101draft,
    unitId: UNIT.b101,
    unitNo: "B-101",
    buildingId: BUILDING_B,
    billedPartyId: PARTY.company,
    billedPartyName: "บริษัท ตัวอย่างการค้า จำกัด",
    leaseId: LEASE.b101,
    leaseNumber: "CT-2569-00004",
    billingCycleId: CYCLE.current,
    status: "draft",
    periodStart: cur.start,
    periodEnd: cur.end,
    reviewFlags: [`missing_reading:${id("aa000000", 7)}`],
    nextActions: ["recompute"],
    lines: [
      rent(1, "5200.00", "B-101"),
      meterLine(2, "electric", "100.000", "164.000", "64.000", "4.0000", "256.00", {
        code: "E-B-101",
        source: "manual",
      }),
    ],
  });
  b101draft.priorBalance = b101prev.balance;
  b101draft.amountDue = add(b101draft.total, b101draft.priorBalance);

  return [a201prev, a302prev, b101prev, a201draft, a302draft, b101draft];
}

function cycleDto(
  partial: Pick<Schemas["BillingCycleDto"], "id" | "periodKey" | "status"> & Partial<Schemas["BillingCycleDto"]>,
) {
  const bounds = periodBounds(partial.periodKey);
  const cutOffAt = new Date(`${bounds.end}T23:59:00+07:00`).toISOString();
  return {
    propertyId: PROPERTY_MAIN,
    propertyName: "หอพักตัวอย่าง",
    periodStart: bounds.start,
    periodEnd: bounds.end,
    cutOffAt,
    graceDeadlineAt: new Date(new Date(cutOffAt).getTime() + DAY).toISOString(),
    estimatePolicy: "allow",
    readingsWindowMinutes: 120,
    readingsRequestedAt: null,
    computedAt: null,
    issuedAt: null,
    closedAt: null,
    autoIssueAt: null,
    nextActions: [],
    stats: {},
    version: 1,
    ...partial,
  } satisfies Schemas["BillingCycleDto"];
}

function initialCycles(): Schemas["BillingCycleDto"][] {
  return [
    cycleDto({
      id: CYCLE.current,
      periodKey: period().periodKey,
      status: "readings_pending",
      computedAt: iso(-0.1),
      readingsRequestedAt: iso(-0.1),
      autoIssueAt: null,
      nextActions: ["compute", "issue"],
    }),
    cycleDto({
      id: CYCLE.previous,
      periodKey: previousPeriodKey(),
      status: "issued",
      computedAt: iso(-16),
      issuedAt: iso(-15),
      nextActions: ["close"],
    }),
  ];
}

// ---------------------------------------------------------------------------------------------------
// Payments, slips, receipts, credits

export const PAYMENT = { qr101: id("9a9e0000", 1), slip102: id("9a9e0000", 2), cashOld: id("9a9e0000", 3) } as const;
export const SLIP = {
  review102: id("5119e000", 1),
  duplicate: id("5119e000", 2),
  approved: id("5119e000", 3),
} as const;
export const RECEIPT = { r101: id("9ece0000", 1), r102: id("9ece0000", 2) } as const;

function initialPayments(invoices: MockInvoice[]): Schemas["PaymentDto"][] {
  const a201 = invoices.find((i) => i.id === INVOICE.a201prev)!;
  return [
    {
      id: PAYMENT.qr101,
      amount: a201.total,
      allocatedTotal: a201.total,
      creditedAmount: "0.00",
      whtAmount: "0.00",
      allocations: [{ invoiceId: a201.id, invoiceNumber: a201.number, amount: a201.total, reversedAt: null }],
      method: "qr",
      provider: "kbank",
      providerRef: "KB-20261001-0001",
      status: "confirmed",
      confirmedVia: "webhook",
      confirmedAt: iso(-12),
      paidAt: iso(-12),
      invoiceId: a201.id,
      payerName: "สมศักดิ์ ใจดี",
      payerPartyId: PARTY.somsak,
      unitId: UNIT.a201,
      unitNo: "A-201",
      evidenceDocumentId: null,
      slipReviewId: null,
      notes: null,
      receipts: [{ id: RECEIPT.r101, kind: "payment", number: "RCP-2569-000051", voided: false }],
      reconciledAt: iso(-11),
      reverseReason: null,
      reversedAt: null,
      nextActions: ["reverse"],
      version: 1,
    },
    {
      id: PAYMENT.slip102,
      amount: "1000.00",
      allocatedTotal: "1000.00",
      creditedAmount: "0.00",
      whtAmount: "0.00",
      allocations: [
        { invoiceId: INVOICE.a302prev, invoiceNumber: "INV-2569-000102", amount: "1000.00", reversedAt: null },
      ],
      method: "transfer_slip",
      provider: null,
      providerRef: "SLIP-0918-22",
      status: "confirmed",
      confirmedVia: "slip_review",
      confirmedAt: iso(-30),
      paidAt: iso(-30),
      invoiceId: INVOICE.a302prev,
      payerName: "อนันต์ พากเพียร",
      payerPartyId: PARTY.anan,
      unitId: UNIT.a302,
      unitNo: "A-302",
      evidenceDocumentId: id("d0c00000", 51),
      slipReviewId: SLIP.approved,
      notes: null,
      receipts: [{ id: RECEIPT.r102, kind: "payment", number: "RCP-2569-000044", voided: false }],
      reconciledAt: null,
      reverseReason: null,
      reversedAt: null,
      nextActions: ["reverse"],
      version: 1,
    },
  ];
}

function initialSlips(invoices: MockInvoice[]): Schemas["SlipReviewDto"][] {
  const a302 = invoices.find((i) => i.id === INVOICE.a302prev)!;
  const slip = (
    partial: Pick<Schemas["SlipReviewDto"], "id" | "status" | "reasons"> & Partial<Schemas["SlipReviewDto"]>,
  ) =>
    ({
      amountDetected: "3000.00",
      duplicateOfId: null,
      imageUrl: null,
      invoiceBalance: a302.balance,
      invoiceId: a302.id,
      invoiceNumber: a302.number,
      nextActions: [] as string[],
      payerName: "อนันต์ พากเพียร",
      paymentId: null,
      receiverAccountMasked: "xxx-x-x6789-0",
      rejectReason: null,
      senderName: "นาย อนันต์ พ.",
      slipDatetime: iso(-1),
      transRef: "014293184522ABC1",
      unitNo: "A-302",
      uploadedAt: iso(-1),
      version: 1,
      ...partial,
    }) satisfies Schemas["SlipReviewDto"];
  return [
    slip({ id: SLIP.review102, status: "pending_review", reasons: ["amount_below_due"], nextActions: ["decide"] }),
    slip({
      id: SLIP.duplicate,
      status: "pending_review",
      reasons: ["duplicate_reference"],
      duplicateOfId: SLIP.approved,
      transRef: "SLIP-0918-22",
      amountDetected: "1000.00",
      uploadedAt: iso(-0.5),
      nextActions: ["decide"],
    }),
    slip({
      id: SLIP.approved,
      status: "approved",
      reasons: ["amount_below_due"],
      transRef: "SLIP-0918-22",
      amountDetected: "1000.00",
      paymentId: PAYMENT.slip102,
      uploadedAt: iso(-30),
    }),
  ];
}

function initialReceipts(): Schemas["ReceiptDto"][] {
  return [
    {
      id: RECEIPT.r101,
      number: "RCP-2569-000051",
      kind: "payment",
      amount: "6379.60",
      payerName: "สมศักดิ์ ใจดี",
      paymentId: PAYMENT.qr101,
      unitNo: "A-201",
      issuedAt: iso(-12),
      hasDocument: true,
      voidReason: null,
      voidedAt: null,
    },
    {
      id: RECEIPT.r102,
      number: "RCP-2569-000044",
      kind: "payment",
      amount: "1000.00",
      payerName: "อนันต์ พากเพียร",
      paymentId: PAYMENT.slip102,
      unitNo: "A-302",
      issuedAt: iso(-30),
      hasDocument: true,
      voidReason: null,
      voidedAt: null,
    },
  ];
}

// ---------------------------------------------------------------------------------------------------
// Utility accounts, invoices, loss

function initialUtilityAccounts(): Schemas["UtilityAccountDto"][] {
  return [
    {
      id: id("0ac70000", 1),
      buildingId: BUILDING_A,
      utility: "electric",
      provider: "mea",
      customerNo: "020012345678",
      label: "มิเตอร์หลักอาคาร A",
      meterNo: "M-778899",
    },
    {
      id: id("0ac70000", 2),
      buildingId: BUILDING_A,
      utility: "water",
      provider: "mwa",
      customerNo: "11223344",
      label: "ประปาอาคาร A",
      meterNo: null,
    },
  ];
}

function initialUtilityInvoices(): Schemas["UtilityInvoiceDto"][] {
  const prev = periodBounds(previousPeriodKey());
  return [
    {
      id: id("0b170000", 1),
      buildingId: BUILDING_A,
      utility: "electric",
      provider: "mea",
      utilityAccountId: id("0ac70000", 1),
      invoiceNo: "MEA-6909-0001234",
      periodStart: prev.start,
      periodEnd: prev.end,
      units: "2850.000",
      amount: "12540.55",
      ft: "0.3972",
      serviceCharge: "38.22",
      vat: "820.41",
      previousRegister: "88120.000",
      currentRegister: "90970.000",
      invoiceDocumentId: null,
      source: "manual",
      version: 1,
    },
  ];
}

export function lossView(utility: Schemas["Utility"], cycleKey: string): Schemas["LossViewDto"] {
  const bounds = periodBounds(cycleKey);
  const trendValues =
    utility === "electric"
      ? ["310.000", "295.500", "402.250", "355.000", "288.000", "312.800"]
      : ["14.000", "12.500", "19.750", "16.000", "13.250", "15.500"];
  const months = [5, 4, 3, 2, 1, 0];
  const trend = months.map((back, index): Schemas["LossTrendPointDto"] => {
    const end = new Date(Date.UTC(Number(cycleKey.slice(0, 4)), Number(cycleKey.slice(5, 7)) - back, 0));
    return {
      periodEnd: end.toISOString().slice(0, 10),
      lossUnits: trendValues[index]!,
      lossThb: mul("4.18", Number(trendValues[index]!.split(".")[0])),
      lossPct: utility === "electric" ? ["10.9", "10.4", "14.1", "12.5", "10.1", "11.0"][index]! : "8.2",
    };
  });
  const last = trend.at(-1)!;
  return {
    report: {
      id: id("1055e000", utility === "electric" ? 1 : 2),
      buildingId: BUILDING_A,
      utility,
      periodKey: cycleKey,
      periodStart: bounds.start,
      periodEnd: bounds.end,
      invoiceUnits: utility === "electric" ? "2850.000" : "190.000",
      unitBilledUnits: utility === "electric" ? "2397.200" : "160.500",
      commonAreaUnits: utility === "electric" ? "140.000" : "14.000",
      lossUnits: last.lossUnits,
      lossThb: last.lossThb,
      lossPct: last.lossPct,
      priceBasis: "utility_tariff",
      billedUnitsSource: "invoices",
      computedAt: iso(-1),
      suspects: [
        {
          id: id("5a5e0000", 1),
          kind: "usage_while_vacant",
          score: "72",
          unitId: UNIT.a303,
          assetItemId: null,
          detail: { unitNo: "A-303", units: "42.500" },
        },
        {
          id: id("5a5e0000", 2),
          kind: "stale_meter",
          score: "55",
          unitId: UNIT.a301,
          assetItemId: id("a1000000", 4),
          detail: { unitNo: "A-301", code: "E-A-301", lastReadingAt: iso(-1) },
        },
        {
          id: id("5a5e0000", 3),
          kind: "zero_consumption_occupied",
          score: "60",
          unitId: UNIT.a302,
          assetItemId: null,
          detail: { unitNo: "A-302" },
        },
      ],
    },
    trend,
  };
}

// ---------------------------------------------------------------------------------------------------
// Reading reviews (D-035, D-142): an OCR reading under the confidence floor and one outside the band

export const REVIEW = { ocrA202: id("4e7e0000", 1), bandW201: id("4e7e0000", 2) } as const;
export const REVIEW_PHOTO = id("d0c00000", 61);

export function reading(
  partial: Pick<Schemas["MeterReadingDto"], "id" | "assetItemId" | "meterCode" | "register" | "readAt" | "source"> &
    Partial<Schemas["MeterReadingDto"]>,
): Schemas["MeterReadingDto"] {
  return {
    confidence: partial.source === "iot" ? "1.000" : partial.source === "ocr" ? "0.900" : "0.950",
    consumption: null,
    evidenceDocumentId: null,
    isFinal: false,
    isInstall: false,
    isRollover: false,
    meterAssignmentId: id("aa000000", 1),
    note: null,
    ocrConfidence: null,
    ocrRawValue: null,
    readingBatchId: null,
    reviewId: null,
    reviewState: "accepted",
    supersededByReadingId: null,
    typedValue: null,
    unit: "kwh",
    unitId: null,
    utility: "electric",
    via: partial.source === "iot" ? "mqtt" : "staff_pwa",
    ...partial,
  };
}

function initialReviews(): Schemas["ReadingReviewDto"][] {
  return [
    {
      id: REVIEW.ocrA202,
      buildingId: BUILDING_A,
      unitId: UNIT.a202,
      unitNo: "A-202",
      reason: "ocr_low_confidence",
      status: "open",
      bandLow: null,
      bandHigh: null,
      trailingAvg: "6.100",
      correctedReadingId: null,
      correctedRegister: null,
      createdAt: iso(-0.4),
      decidedAt: null,
      decisionNote: null,
      nextActions: ["decide"],
      reading: reading({
        id: id("e0000000", 81),
        assetItemId: id("a1000000", 3),
        meterAssignmentId: id("aa000000", 3),
        meterCode: "E-A-202",
        register: "8981.500",
        readAt: iso(-0.4),
        source: "ocr",
        ocrRawValue: "8981.5",
        ocrConfidence: "0.620",
        confidence: "0.620",
        consumption: "181.000",
        evidenceDocumentId: REVIEW_PHOTO,
        reviewState: "pending_review",
        reviewId: REVIEW.ocrA202,
        unitId: UNIT.a202,
      }),
    },
    {
      id: REVIEW.bandW201,
      buildingId: BUILDING_A,
      unitId: UNIT.a201,
      unitNo: "A-201",
      reason: "out_of_band",
      status: "open",
      bandLow: "3.500",
      bandHigh: "9.800",
      trailingAvg: "0.210",
      correctedReadingId: null,
      correctedRegister: null,
      createdAt: iso(-0.3),
      decidedAt: null,
      decisionNote: null,
      nextActions: ["decide"],
      reading: reading({
        id: id("e0000000", 82),
        assetItemId: id("a1000000", 2),
        meterAssignmentId: id("aa000000", 2),
        meterCode: "W-A-201",
        register: "865.000",
        readAt: iso(-0.3),
        source: "manual",
        typedValue: "865.000",
        consumption: "19.800",
        unit: "m3",
        utility: "water",
        reviewState: "pending_review",
        reviewId: REVIEW.bandW201,
        unitId: UNIT.a201,
      }),
    },
  ];
}

// ---------------------------------------------------------------------------------------------------
// The world

export interface OwnerWorld {
  properties: Schemas["PropertyDto"][];
  buildings: Schemas["BuildingDto"][];
  floors: Schemas["FloorDto"][];
  units: OwnerUnit[];
  profiles: Schemas["UnitProfileDto"][];
  utilityAccounts: Schemas["UtilityAccountDto"][];
  imports: Map<string, { buildingId: string; fileId: string; preview: Schemas["UnitImportPreviewDto"] }>;
  parties: Schemas["PartyDto"][];
  leases: Schemas["LeaseDto"][];
  leaseEvents: Map<string, Schemas["LeaseEventDto"][]>;
  leaseInvitations: Map<string, Schemas["LeaseInvitationDto"][]>;
  deposits: Schemas["DepositDto"][];
  comparisons: Map<string, Schemas["InspectionComparisonDto"]>;
  acknowledgements: Schemas["AcknowledgementDto"][];
  /** Pending compliance evaluations by id (warning → acknowledgement → repeat). */
  evaluations: Map<string, { ruleId: string; shown: Record<string, unknown> }>;
  cycles: Schemas["BillingCycleDto"][];
  invoices: MockInvoice[];
  charges: Schemas["InvoiceChargeDto"][];
  payments: Schemas["PaymentDto"][];
  slips: Schemas["SlipReviewDto"][];
  receipts: Schemas["ReceiptDto"][];
  credits: Schemas["PayerCreditDto"][];
  exports: Schemas["ExportJobDto"][];
  utilityInvoices: Schemas["UtilityInvoiceDto"][];
  reviews: Schemas["ReadingReviewDto"][];
  /** Owner-side meter readings (history per meter); the staff world's readings are added on top. */
  ownerReadings: Schemas["MeterReadingDto"][];
  replies: Map<string, { status: number; body: unknown; fingerprint: string }>;
  /** What the e2e suite asserts on: requests the owner world received (by operation). */
  received: { op: string; idempotencyKey: string | null; body: unknown }[];
  settings: Schemas["SettingDto"][];
}

function setting(
  key: string,
  value: Schemas["SettingDto"]["value"],
  valueType: Schemas["SettingValueType"],
  description: string,
  scope: Schemas["SettingScope"] = "platform",
): Schemas["SettingDto"] {
  return {
    key,
    value,
    valueType,
    description,
    scope,
    scopeAllowed: ["platform", "tenant", "property"],
    editable: true,
    effectiveFrom: iso(-90),
  };
}

function initialSettings(): Schemas["SettingDto"][] {
  return [
    setting(
      "billing.cutoff",
      { day: "end_of_month", time: "23:59", timezone: "Asia/Bangkok" },
      "json",
      "Billing cut-off (D-031)",
    ),
    setting("billing.default_due_day", 5, "int", "Rent due day (D-191)"),
    setting("billing.reading_grace_hours", 24, "int", "Staff readings accepted after the cut-off (D-191)"),
    setting("billing.estimate_policy", "allow", "string", "Estimate missing readings (D-031)", "tenant"),
    setting("billing.auto_issue", { enabled: false, afterHours: 24 }, "json", "Issue computed cycles by themselves"),
    setting("readings.require_photo", true, "bool", "Photo required for manual readings (D-035)"),
    setting("readings.round_window_days", 7, "int", "Reading round window (D-187)"),
    setting("reminders.schedule", [1, 3, 7], "json", "Reminder days after the due date (D-045)"),
    setting("late_fee.enabled", false, "bool", "Late fee (D-045, O-002)"),
    setting("late_fee.amount", "0.00", "money", "Late fee per overdue invoice (D-201)"),
    setting("payments.allow_partial", false, "bool", "Partial payments (D-198)"),
    setting("payments.allow_slip", true, "bool", "Slip uploads (D-043)"),
    setting("deposit.refund_days", 7, "int", "Deposit refund deadline in days (D-023)"),
    setting("deposit.max_months_short", "3", "decimal", "Deposit + advance rent cap in months (D-023)"),
    setting("readings.plausibility_pct", "60", "decimal", "Plausibility band (D-035)"),
    setting("tax.vat", { rate: "0.07", applicableLineKinds: [] }, "json", "VAT (O-007)"),
    setting("compliance.tariff_cap.severity", "warn", "string", "Tariff cap severity (D-021a)"),
  ];
}

export function initialOwnerWorld(): OwnerWorld {
  const big = bigBuilding();
  const unitsA: OwnerUnit[] = [
    unitDto({
      id: UNIT.a201,
      unitNo: "A-201",
      buildingId: BUILDING_A,
      propertyId: PROPERTY_MAIN,
      floorId: FLOORS.a2.floorId,
      floorLevel: 2,
      status: "occupied",
      currentLeaseId: LEASE.a201,
      lesseePartyId: PARTY.somsak,
    }),
    unitDto({
      id: UNIT.a202,
      unitNo: "A-202",
      buildingId: BUILDING_A,
      propertyId: PROPERTY_MAIN,
      floorId: FLOORS.a2.floorId,
      floorLevel: 2,
      status: "reserved",
      lesseePartyId: PARTY.malee,
    }),
    unitDto({
      id: UNIT.a203,
      unitNo: "A-203",
      buildingId: BUILDING_A,
      propertyId: PROPERTY_MAIN,
      floorId: FLOORS.a2.floorId,
      floorLevel: 2,
      status: "maintenance",
      statusReason: "ซ่อมท่อน้ำ",
      nextActions: ["set-status"],
    }),
    unitDto({
      id: UNIT.a204,
      unitNo: "A-204",
      buildingId: BUILDING_A,
      propertyId: PROPERTY_MAIN,
      floorId: FLOORS.a2.floorId,
      floorLevel: 2,
      status: "vacant",
      nextActions: ["set-status"],
    }),
    unitDto({
      id: UNIT.a301,
      unitNo: "A-301",
      buildingId: BUILDING_A,
      propertyId: PROPERTY_MAIN,
      floorId: FLOORS.a3.floorId,
      floorLevel: 3,
      status: "vacant",
      nextActions: ["set-status"],
    }),
    unitDto({
      id: UNIT.a302,
      unitNo: "A-302",
      buildingId: BUILDING_A,
      propertyId: PROPERTY_MAIN,
      floorId: FLOORS.a3.floorId,
      floorLevel: 3,
      status: "occupied",
      currentLeaseId: LEASE.a302,
      lesseePartyId: PARTY.anan,
      baseRent: "6500.00",
      unitProfileId: PROFILE_LARGE,
      unitProfileName: "ห้องใหญ่",
      areaSqm: "32.00",
    }),
    unitDto({
      id: UNIT.a303,
      unitNo: "A-303",
      buildingId: BUILDING_A,
      propertyId: PROPERTY_MAIN,
      floorId: FLOORS.a3.floorId,
      floorLevel: 3,
      status: "vacant",
      nextActions: ["set-status"],
    }),
    unitDto({
      id: UNIT.a304,
      unitNo: "A-304",
      buildingId: BUILDING_A,
      propertyId: PROPERTY_MAIN,
      floorId: FLOORS.a3.floorId,
      floorLevel: 3,
      status: "inactive",
      statusReason: "ใช้เป็นห้องเก็บของ",
      nextActions: ["set-status"],
    }),
  ];
  const unitsB: OwnerUnit[] = [
    unitDto({
      id: UNIT.b101,
      unitNo: "B-101",
      buildingId: BUILDING_B,
      propertyId: PROPERTY_MAIN,
      floorId: FLOOR_B1,
      floorLevel: 1,
      status: "occupied",
      currentLeaseId: LEASE.b101,
      lesseePartyId: PARTY.company,
      baseRent: "5200.00",
    }),
    unitDto({
      id: UNIT.b102,
      unitNo: "B-102",
      buildingId: BUILDING_B,
      propertyId: PROPERTY_MAIN,
      floorId: FLOOR_B1,
      floorLevel: 1,
      status: "vacant",
      baseRent: "5200.00",
      nextActions: ["set-status"],
    }),
  ];
  const units = [...unitsA, ...unitsB, ...big.units];
  const floors: Schemas["FloorDto"][] = [
    { id: FLOORS.a2.floorId, buildingId: BUILDING_A, level: 2, name: "ชั้น 2", sortOrder: 2, unitCount: 4 },
    { id: FLOORS.a3.floorId, buildingId: BUILDING_A, level: 3, name: "ชั้น 3", sortOrder: 3, unitCount: 4 },
    { id: FLOOR_B1, buildingId: BUILDING_B, level: 1, name: "ชั้น 1", sortOrder: 1, unitCount: 2 },
    ...big.floors,
  ];
  const count = (buildingId: string) => units.filter((unit) => unit.buildingId === buildingId).length;
  const invoices = initialInvoices();
  return {
    properties: [
      {
        id: PROPERTY_MAIN,
        code: "MAIN",
        name: "หอพักตัวอย่าง",
        address: ADDRESS,
        provinceCode: "10",
        status: "active",
        createdAt: iso(-500),
        version: 2,
      },
      {
        id: PROPERTY_BIG,
        code: "SNR",
        name: "ศรีนครินทร์ เรสซิเดนซ์",
        address: {
          ...ADDRESS,
          line1: "500 ถนนศรีนครินทร์",
          district: "เขตประเวศ",
          subdistrict: "แขวงหนองบอน",
          postcode: "10250",
        },
        provinceCode: "10",
        status: "active",
        createdAt: iso(-200),
        version: 1,
      },
    ],
    buildings: [
      {
        ...buildingDto({ id: BUILDING_A, code: "A", name: "อาคาร A", propertyId: PROPERTY_MAIN, floorsCount: 2 }),
        unitCount: count(BUILDING_A),
      },
      {
        ...buildingDto({ id: BUILDING_B, code: "B", name: "อาคาร B", propertyId: PROPERTY_MAIN, floorsCount: 1 }),
        unitCount: count(BUILDING_B),
      },
      {
        ...buildingDto({ id: BUILDING_C, code: "C", name: "อาคาร C", propertyId: PROPERTY_BIG, floorsCount: 15 }),
        unitCount: count(BUILDING_C),
      },
    ],
    floors,
    units,
    profiles: [
      {
        id: PROFILE_STUDIO,
        buildingId: BUILDING_A,
        name: "ห้องสตูดิโอ",
        areaSqm: "24.00",
        defaultRent: "4500.00",
        defaultDepositMonths: "1",
        defaultAdvanceRentMonths: "1",
        defaultLeaseLines: [{ kind: "internet", description: "อินเทอร์เน็ต", amount: "300.00" }],
        inspectionTemplateId: null,
        version: 1,
      },
      {
        id: PROFILE_LARGE,
        buildingId: BUILDING_A,
        name: "ห้องใหญ่",
        areaSqm: "32.00",
        defaultRent: "6500.00",
        defaultDepositMonths: "1",
        defaultAdvanceRentMonths: "1",
        defaultLeaseLines: [
          { kind: "internet", description: "อินเทอร์เน็ต", amount: "300.00" },
          { kind: "parking", description: "ที่จอดรถ 1 คัน", amount: "500.00" },
        ],
        inspectionTemplateId: null,
        version: 1,
      },
    ],
    utilityAccounts: initialUtilityAccounts(),
    imports: new Map(),
    parties: initialParties(),
    leases: initialLeases(),
    leaseEvents: initialLeaseEvents(),
    leaseInvitations: new Map([
      [
        LEASE.a202,
        [
          {
            id: id("1e71000", 1),
            channel: "line_qr",
            state: "accepted",
            partyId: PARTY.malee,
            createdAt: iso(-4),
            expiresAt: iso(10),
            acceptedAt: iso(-3),
          },
        ],
      ],
    ]),
    deposits: initialDeposits(),
    comparisons: new Map([
      [DEPOSIT.a303, comparison303()],
      [
        DEPOSIT.b102,
        { moveInInspectionId: INSPECTION.moveIn102, moveOutInspectionId: INSPECTION.moveOut102, lines: [] },
      ],
    ]),
    acknowledgements: [],
    evaluations: new Map(),
    cycles: initialCycles(),
    invoices,
    charges: [],
    payments: initialPayments(invoices),
    slips: initialSlips(invoices),
    receipts: initialReceipts(),
    credits: [
      {
        partyId: PARTY.company,
        partyName: "บริษัท ตัวอย่างการค้า จำกัด",
        unitId: UNIT.b101,
        unitNo: "B-101",
        balance: "250.00",
      },
    ],
    exports: [],
    utilityInvoices: initialUtilityInvoices(),
    reviews: initialReviews(),
    ownerReadings: [],
    replies: new Map(),
    received: [],
    settings: initialSettings(),
  };
}

export const INSPECTION_A201_MOVE_IN = INSPECTION_MOVE_IN_A201;
