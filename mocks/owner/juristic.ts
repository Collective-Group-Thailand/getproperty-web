import { http, type HttpHandler } from "msw";
import { toDataURL } from "qrcode";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import { body, idempotent, json, mutating, owner, paged, problem, query, record, roleOf, validation } from "./support";

type Schemas = components["schemas"];

/*
 * Pack J on the owner surface (JW1a; api J1.1a–J1.2b at ed938f2): a juristic tenant "นิติบุคคล เดอะ ริเวอร์ไซด์" with
 * - a condominium (property kind `condo`, building "อาคาร A" under `condo_act`): four floors × four units with
 *   ownership ratios; A-101 has co-owners 60 / 40, A-102 is incomplete (50 %), A-404 has no owner yet, A-201 and
 *   A-302 belong to one owner who named an agency as bill-to;
 * - a housing estate (kind `village`, two soi as buildings under `land_allocation_act`): plots with ตร.วา.
 * Resolutions, budgets (rate preview + rate-plan draft), rate plans of every frequency, quarterly / annual cycles,
 * members with a committee member and a time-boxed auditor, and the read-only report figures of the overview.
 * Generic endpoints (properties, buildings, units, parties, cycles, rate plans, members, invitations, files) answer
 * for the juristic tenant from this world and fall through to the sample world otherwise.
 * Controls: `POST /__mock/owner/juristic/reset`, `GET /__mock/owner/juristic`.
 */

export const JURISTIC_TENANT = TENANTS.juristic.profile.id;
/** A part of a decimal string, rounded to satang (the mock is the API's side: it may compute). */
const share = (amount: string, part: number) => (Math.round(Number(amount) * 100 * part) / 100).toFixed(2);
const DAY = 86_400_000;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays = 0) => new Date(Date.now() + 7 * 3600_000 + offsetDays * DAY).toISOString().slice(0, 10);
const jid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const J = {
  condo: jid("7b9f0a01", 1),
  village: jid("7b9f0a01", 2),
  buildingA: jid("5c8e0a01", 1),
  soi1: jid("5c8e0a01", 2),
  soi2: jid("5c8e0a01", 3),
} as const;

interface JuristicUnit {
  dto: Schemas["UnitDto"];
  titleDeedNo: string | null;
}

interface Ownership {
  id: string;
  unitId: string;
  partyId: string;
  sharePct: string;
  validFrom: string;
  validTo: string | null;
  source: string;
}

export interface MockJuristicWorld {
  properties: Schemas["PropertyDto"][];
  buildings: Schemas["BuildingDto"][];
  floors: Schemas["FloorDto"][];
  units: JuristicUnit[];
  parties: Schemas["RegisterPartyDto"][];
  ownerships: Ownership[];
  billTo: (Schemas["BillToDto"] & { unitId: string })[];
  transfers: Schemas["OwnershipTransferDto"][];
  invites: Schemas["UnitResidentInviteDto"][];
  resolutions: Schemas["ResolutionDto"][];
  budgets: Schemas["BudgetDto"][];
  ratePlans: Schemas["RatePlanDto"][];
  cycles: Schemas["BillingCycleDto"][];
  members: Schemas["MemberDto"][];
  invitations: Schemas["InvitationDto"][];
}

const ADDRESS = {
  line1: "88 ถนนเจริญนคร",
  subdistrict: "แขวงคลองต้นไทร",
  district: "เขตคลองสาน",
  province: "กรุงเทพมหานคร",
  postcode: "10600",
  country: "TH",
};

function party(
  n: number,
  displayName: string,
  patch: Partial<Schemas["RegisterPartyDto"]> = {},
): Schemas["RegisterPartyDto"] {
  return {
    id: jid("9a7e0a01", n),
    type: "person",
    displayName,
    phoneMasked: `+66•••••${String(1200 + n).slice(-4)}`,
    email: null,
    lineLinked: n % 3 !== 0,
    residentLinked: n % 2 === 1,
    ...patch,
  };
}

export const JP = {
  sirirat: jid("9a7e0a01", 1),
  kittisak: jid("9a7e0a01", 2),
  thanadol: jid("9a7e0a01", 3),
  wannee: jid("9a7e0a01", 4),
  thanasiri: jid("9a7e0a01", 5),
  piya: jid("9a7e0a01", 6),
  pimpan: jid("9a7e0a01", 7),
  agency: jid("9a7e0a01", 8),
  somporn: jid("9a7e0a01", 9),
} as const;

function unit(
  n: number,
  input: Pick<Schemas["UnitDto"], "unitNo" | "buildingId" | "propertyId" | "type"> &
    Partial<Schemas["UnitDto"]> & { titleDeedNo?: string | null },
): JuristicUnit {
  const { titleDeedNo = null, ...dto } = input;
  return {
    titleDeedNo,
    dto: {
      id: jid("3b24ua01", n),
      floorId: null,
      floorLevel: null,
      areaSqm: null,
      baseRent: null,
      status: "occupied",
      statusReason: null,
      statusChangedAt: iso(-400),
      unitProfileId: null,
      unitProfileName: null,
      ownershipRatio: null,
      landAreaSqwa: null,
      plotNo: null,
      currentLeaseId: null,
      notes: null,
      currency: "THB",
      version: 1,
      nextActions: [],
      ...dto,
    },
  };
}

const CONDO_AREAS = ["34.77", "45.50", "52.10", "68.25"];
/** Ratios of the 16 condo units, Σ = 1.000000 (area ÷ Σ areas, the remainder on the last unit). */
const CONDO_RATIOS = ["0.043476", "0.056892", "0.065145", "0.085339"];

export function juristicUnitId(n: number) {
  return jid("3b24ua01", n);
}

export function initialJuristicWorld(): MockJuristicWorld {
  const properties: Schemas["PropertyDto"][] = [
    {
      id: J.condo,
      code: "RVS",
      name: "เดอะ ริเวอร์ไซด์",
      address: ADDRESS,
      provinceCode: "10",
      kind: "condo",
      status: "active",
      createdAt: iso(-900),
      version: 1,
    },
    {
      id: J.village,
      code: "SSN",
      name: "หมู่บ้านสวนสน",
      address: { ...ADDRESS, line1: "199 ถนนสุขาภิบาล 2", district: "เขตประเวศ", subdistrict: "แขวงดอกไม้" },
      provinceCode: "10",
      kind: "village",
      status: "active",
      createdAt: iso(-800),
      version: 1,
    },
  ];
  const building = (
    id: string,
    code: string,
    name: string,
    propertyId: string,
    legalForm: Schemas["BuildingLegalForm"],
    type: Schemas["BuildingType"],
    floorsCount: number | null,
  ): Schemas["BuildingDto"] => ({
    id,
    propertyId,
    code,
    name,
    type,
    floorsCount,
    ownerTenantId: JURISTIC_TENANT,
    operatorTenantId: JURISTIC_TENANT,
    access: "operator",
    legalForm,
    status: "active",
    unitCount: 0,
    version: 1,
  });
  const buildings = [
    building(J.buildingA, "A", "อาคาร A", J.condo, "condo_act", "condo", 4),
    building(J.soi1, "S1", "ซอย 1", J.village, "land_allocation_act", "house_cluster", null),
    building(J.soi2, "S2", "ซอย 2", J.village, "land_allocation_act", "house_cluster", null),
  ];
  const floors: Schemas["FloorDto"][] = [1, 2, 3, 4].map((level) => ({
    id: jid("f1a00a01", level),
    buildingId: J.buildingA,
    level,
    name: `ชั้น ${level}`,
    sortOrder: level,
    unitCount: 4,
  }));
  const units: JuristicUnit[] = [];
  let n = 0;
  for (const level of [1, 2, 3, 4])
    for (const position of [0, 1, 2, 3]) {
      n += 1;
      const last = level === 4 && position === 3;
      units.push(
        unit(n, {
          unitNo: `A-${level}0${position + 1}`,
          buildingId: J.buildingA,
          propertyId: J.condo,
          type: "condo_unit",
          floorId: jid("f1a00a01", level),
          floorLevel: level,
          areaSqm: CONDO_AREAS[position]!,
          // The last unit carries the satang remainder so the 16 ratios add up to exactly 1.
          ownershipRatio: last ? "0.087354" : CONDO_RATIOS[position]!,
          titleDeedNo: `${2500 + n}`,
        }),
      );
    }
  const plots: [string, string, string][] = [
    [J.soi1, "1/1", "52.50"],
    [J.soi1, "1/2", "50.00"],
    [J.soi1, "1/3", "50.00"],
    [J.soi1, "1/4", "61.25"],
    [J.soi1, "1/5", "50.00"],
    [J.soi1, "1/6", "72.00"],
    [J.soi2, "2/1", "55.00"],
    [J.soi2, "2/2", "55.00"],
    [J.soi2, "2/3", "80.50"],
    [J.soi2, "2/4", "55.00"],
  ];
  for (const [buildingId, plotNo, sqwa] of plots) {
    n += 1;
    units.push(
      unit(n, {
        unitNo: `99/${plotNo.replace("/", "")}`,
        buildingId,
        propertyId: J.village,
        type: "plot",
        plotNo,
        landAreaSqwa: sqwa,
        titleDeedNo: `โฉนด ${41200 + n}`,
      }),
    );
  }
  for (const b of buildings) b.unitCount = units.filter((u) => u.dto.buildingId === b.id).length;

  const parties = [
    party(1, "คุณศิริพร วงศ์สุวรรณ", { email: "sirirat@example.com" }),
    party(2, "คุณกิตติศักดิ์ พานิชกิจ"),
    party(3, "นายธนดล เจริญทรัพย์"),
    party(4, "นางวรรณี ชื่นกมล"),
    party(5, "บจก. ธนาสิริ กรุ๊ป", { type: "company", email: "account@thanasiri.example", lineLinked: false }),
    party(6, "นายปิยะ อัครเมธา", { phoneMasked: null, lineLinked: false, residentLinked: false }),
    party(7, "น.ส. พิมลพรรณ ชัยกุล"),
    party(8, "บจก. พร็อพแคร์ เอเจนซี่", { type: "company", email: "billing@propcare.example" }),
    party(9, "นายสมพร ใจดี"),
  ];
  const own = (
    m: number,
    unitIndex: number,
    partyId: string,
    sharePct: string,
    validFrom = date(-700),
    validTo: string | null = null,
  ): Ownership => ({
    id: jid("0e0a0a01", m),
    unitId: juristicUnitId(unitIndex),
    partyId,
    sharePct,
    validFrom,
    validTo,
    source: "manual",
  });
  const ownerships: Ownership[] = [
    own(1, 1, JP.sirirat, "60.0000"),
    own(2, 1, JP.kittisak, "40.0000"),
    own(3, 2, JP.thanadol, "50.0000"),
    own(4, 3, JP.wannee, "100.0000"),
    own(5, 4, JP.thanasiri, "100.0000"),
    own(6, 5, JP.piya, "100.0000"),
    own(7, 6, JP.pimpan, "100.0000"),
    own(8, 7, JP.somporn, "100.0000", date(-300)),
    // The seller before Somporn (a transfer 300 days ago).
    own(9, 7, JP.wannee, "100.0000", date(-1500), date(-300)),
    own(10, 8, JP.sirirat, "100.0000"),
    own(11, 9, JP.kittisak, "100.0000"),
    own(12, 10, JP.piya, "100.0000"),
    own(13, 11, JP.thanadol, "100.0000"),
    own(14, 12, JP.pimpan, "100.0000"),
    own(15, 13, JP.wannee, "100.0000"),
    own(16, 14, JP.thanasiri, "100.0000"),
    own(17, 15, JP.somporn, "100.0000"),
    // A-404 (16) has no owner on the register yet.
    ...Array.from({ length: 10 }, (_, index) =>
      own(20 + index, 17 + index, [JP.wannee, JP.piya, JP.somporn, JP.pimpan, JP.thanadol][index % 5]!, "100.0000"),
    ),
  ];
  const billTo: MockJuristicWorld["billTo"] = [
    {
      id: jid("b177a01", 1),
      unitId: juristicUnitId(6),
      ownerPartyId: JP.pimpan,
      billToParty: parties[7]!,
      kind: "agency",
      consentDocumentId: jid("d0c0a001", 1),
      consentNote: "เจ้าของอยู่ต่างประเทศ มอบให้ตัวแทนชำระ",
      validFrom: date(-200),
      validTo: null,
      endedReason: null,
    },
  ];
  const resolutions: Schemas["ResolutionDto"][] = [
    {
      id: jid("e5010a01", 1),
      buildingId: J.buildingA,
      meetingKind: "agm",
      meetingDate: date(-40),
      number: "1/2569",
      title: "อนุมัติงบประมาณประจำปี 2570 และอัตราค่าส่วนกลาง",
      text: "ที่ประชุมใหญ่สามัญประจำปีมีมติอนุมัติงบประมาณรายรับรายจ่ายประจำปี 2570 ตามที่คณะกรรมการเสนอ และให้เรียกเก็บค่าส่วนกลางตามอัตราส่วนกรรมสิทธิ์ รายไตรมาส ล่วงหน้า เริ่มไตรมาส 1/2570",
      votesSummary: "เห็นด้วย 182 ไม่เห็นด้วย 3 งดออกเสียง 5",
      state: "adopted",
      adoptedAt: iso(-39),
      voidedAt: null,
      voidReason: null,
      documents: [{ documentId: jid("d0c0a001", 2), kind: "minutes", createdAt: iso(-39) }],
      nextActions: ["void", "add_document"],
      version: 2,
      createdAt: iso(-42),
    },
    {
      id: jid("e5010a01", 2),
      buildingId: J.soi1,
      meetingKind: "agm",
      meetingDate: date(-60),
      number: "2/2569",
      title: "อัตราค่าส่วนกลางหมู่บ้าน ปี 2570",
      text: "ที่ประชุมใหญ่มีมติให้เรียกเก็บค่าบำรุงสาธารณูปโภคตามเนื้อที่ดิน ตารางวาละ 30 บาทต่อเดือน เรียกเก็บรายปีล่วงหน้า",
      votesSummary: "เห็นด้วย 96 ไม่เห็นด้วย 4",
      state: "adopted",
      adoptedAt: iso(-59),
      voidedAt: null,
      voidReason: null,
      documents: [],
      nextActions: ["void", "add_document"],
      version: 2,
      createdAt: iso(-61),
    },
    {
      id: jid("e5010a01", 3),
      buildingId: J.buildingA,
      meetingKind: "committee",
      meetingDate: date(-3),
      number: "3/2569",
      title: "ปรับงบซ่อมบำรุงลิฟต์",
      text: "คณะกรรมการเสนอปรับงบประมาณซ่อมบำรุงลิฟต์เพิ่มเติม รอที่ประชุมรับรอง",
      votesSummary: null,
      state: "draft",
      adoptedAt: null,
      voidedAt: null,
      voidReason: null,
      documents: [],
      nextActions: ["adopt", "void", "update", "add_document"],
      version: 1,
      createdAt: iso(-3),
    },
  ];
  const line = (
    m: number,
    kind: Schemas["BudgetLineKind"],
    label: string,
    amount: string,
  ): Schemas["BudgetLineDto"] => ({
    id: jid("b0d1a001", m),
    kind,
    label,
    amount,
    accountId: null,
  });
  const budgets: Schemas["BudgetDto"][] = [
    {
      id: jid("b0d6a001", 1),
      buildingId: J.buildingA,
      fiscalYear: 2027,
      name: "งบประมาณประจำปี 2570 · อาคาร A",
      periodStart: "2027-01-01",
      periodEnd: "2027-12-31",
      state: "draft",
      resolutionId: null,
      total: "1234567.89",
      incomeTotal: "120000.00",
      lines: [
        line(1, "expense", "ค่ารักษาความปลอดภัย", "480000.00"),
        line(2, "expense", "ค่าทำความสะอาดพื้นที่ส่วนกลาง", "312000.00"),
        line(3, "expense", "ค่าไฟฟ้าส่วนกลาง", "198000.00"),
        line(4, "expense", "ค่าซ่อมบำรุงลิฟต์และระบบ", "144567.89"),
        line(5, "fund", "เงินกองทุนสำรอง", "100000.00"),
        line(6, "income", "ค่าเช่าพื้นที่โฆษณา", "120000.00"),
      ],
      approvedAt: null,
      nextActions: ["approve", "update", "rate_preview", "create_rate_plan_draft"],
      version: 1,
    },
    {
      id: jid("b0d6a001", 2),
      buildingId: J.soi1,
      fiscalYear: 2027,
      name: "งบประมาณประจำปี 2570 · หมู่บ้านสวนสน",
      periodStart: "2027-01-01",
      periodEnd: "2027-12-31",
      state: "approved",
      resolutionId: jid("e5010a01", 2),
      total: "214560.00",
      incomeTotal: "0.00",
      lines: [
        line(11, "expense", "ค่ารักษาความปลอดภัย", "144000.00"),
        line(12, "expense", "ค่าดูแลสวนและไฟถนน", "70560.00"),
      ],
      approvedAt: iso(-58),
      nextActions: ["rate_preview", "create_rate_plan_draft"],
      version: 2,
    },
  ];
  // The current year's approved budget of Building A, its lines measured on accounts of the chart (JW2a, J2.1).
  const thisYear = Number(date().slice(0, 4));
  const acc = (n: number) => jid("acc0a001", n);
  const measured = (
    m: number,
    kind: Schemas["BudgetLineKind"],
    label: string,
    amount: string,
    accountId: string | null,
  ) => ({
    ...line(m, kind, label, amount),
    accountId,
  });
  budgets.push({
    id: jid("b0d6a001", 3),
    buildingId: J.buildingA,
    fiscalYear: thisYear,
    name: `งบประมาณประจำปี ${thisYear + 543} · อาคาร A`,
    periodStart: `${thisYear}-01-01`,
    periodEnd: `${thisYear}-12-31`,
    state: "approved",
    resolutionId: jid("e5010a01", 1),
    total: "2402400.00",
    incomeTotal: "0.00",
    lines: [
      measured(21, "expense", "เงินเดือนและค่าตอบแทนบุคลากร", "504000.00", acc(16)),
      measured(22, "expense", "ค่าไฟฟ้าและค่าน้ำประปาส่วนกลาง", "228000.00", acc(17)),
      measured(23, "expense", "ค่าจ้างรักษาความปลอดภัยและทำความสะอาด", "702000.00", acc(19)),
      measured(24, "expense", "ค่าซ่อมแซมและบำรุงรักษา", "180000.00", acc(18)),
      measured(25, "expense", "เบี้ยประกันภัยอาคาร", "48000.00", acc(21)),
      measured(26, "expense", "ค่าจัดประชุมใหญ่", "15000.00", acc(29)),
      measured(27, "expense", "ค่าใช้จ่ายเบ็ดเตล็ด", "35400.00", null),
      measured(28, "fund", "เงินสมทบกองทุนสำรอง", "190080.00", acc(25)),
    ],
    approvedAt: `${thisYear - 1}-12-15T10:00:00+07:00`,
    nextActions: ["rate_preview", "create_rate_plan_draft"],
    version: 2,
  });
  const version = (
    m: number,
    basis: Schemas["RateBasis"],
    tiers: Record<string, unknown>,
    resolutionId: string | null,
    effectiveFrom = date(-60),
  ): Schemas["RatePlanVersionDto"] => ({
    id: jid("7a7e0a01", m),
    basis,
    tiers,
    minimumCharge: null,
    note: null,
    effectiveFrom,
    effectiveTo: null,
    inForce: true,
    aboveCap: false,
    capCheck: null,
    complianceAcknowledgementId: null,
    resolutionId,
  });
  const ratePlans: Schemas["RatePlanDto"][] = [
    {
      id: jid("7a7e0a02", 1),
      buildingId: J.buildingA,
      kind: "common_fee",
      name: "ค่าส่วนกลาง อาคาร A",
      isDefault: true,
      frequency: "quarterly",
      version: 2,
      versions: [
        version(
          1,
          "budget_split",
          { kind: "budget", amount: "1134567.89", period: "year", splitBy: "ownership_ratio" },
          jid("e5010a01", 1),
        ),
      ],
    },
    {
      id: jid("7a7e0a02", 2),
      buildingId: J.soi1,
      kind: "common_fee",
      name: "ค่าบำรุงหมู่บ้าน ซอย 1",
      isDefault: true,
      frequency: "annual",
      version: 1,
      versions: [version(2, "per_sqwa", { kind: "flat", pricePerUnit: "30.0000", unit: "sqwa" }, jid("e5010a01", 2))],
    },
    {
      id: jid("7a7e0a02", 3),
      buildingId: J.buildingA,
      kind: "fund",
      name: "เงินกองทุน อาคาร A",
      isDefault: true,
      frequency: "annual",
      version: 1,
      versions: [],
    },
  ];
  const cycle = (
    m: number,
    propertyId: string,
    propertyName: string,
    frequency: Schemas["BillingFrequency"],
    periodKey: string,
    periodStart: string,
    periodEnd: string,
    status: Schemas["BillingCycleStatus"],
    stats: Record<string, unknown>,
  ): Schemas["BillingCycleDto"] => ({
    id: jid("c7c1a001", m),
    propertyId,
    propertyName,
    periodKey,
    frequency,
    periodStart,
    periodEnd,
    cutOffAt: `${periodStart}T00:00:00+07:00`,
    status,
    readingsWindowMinutes: 0,
    graceDeadlineAt: `${periodStart}T00:00:00+07:00`,
    estimatePolicy: "allow",
    readingsRequestedAt: null,
    computedAt: status === "open" ? null : `${periodStart}T00:15:00+07:00`,
    issuedAt: status === "issued" || status === "closed" ? `${periodStart}T09:00:00+07:00` : null,
    closedAt: status === "closed" ? `${periodEnd}T23:59:00+07:00` : null,
    autoIssueAt: null,
    stats,
    nextActions: status === "open" ? ["compute"] : status === "computed" ? ["compute", "issue"] : [],
    version: 1,
  });
  const cycles = [
    cycle(1, J.condo, "เดอะ ริเวอร์ไซด์", "quarterly", "2027-Q1", "2027-01-01", "2027-03-31", "computed", {
      billables: 15,
      drafts: 15,
      needsReview: 2,
      issued: 0,
      total: "308641.97",
      flags: { ownership_shares_incomplete: 2 },
    }),
    cycle(2, J.condo, "เดอะ ริเวอร์ไซด์", "quarterly", "2026-Q4", "2026-10-01", "2026-12-31", "issued", {
      billables: 15,
      drafts: 0,
      needsReview: 0,
      issued: 15,
      total: "296250.00",
      flags: {},
    }),
    cycle(3, J.condo, "เดอะ ริเวอร์ไซด์", "quarterly", "2026-Q3", "2026-07-01", "2026-09-30", "closed", {
      billables: 15,
      drafts: 0,
      needsReview: 0,
      issued: 15,
      total: "296250.00",
      flags: {},
    }),
    cycle(4, J.condo, "เดอะ ริเวอร์ไซด์", "annual", "2027", "2027-01-01", "2027-12-31", "open", {
      billables: 0,
      drafts: 0,
      needsReview: 0,
      issued: 0,
      total: "0.00",
      flags: {},
    }),
    cycle(5, J.village, "หมู่บ้านสวนสน", "annual", "2026", "2026-01-01", "2026-12-31", "issued", {
      billables: 10,
      drafts: 0,
      needsReview: 0,
      issued: 10,
      total: "209700.00",
      flags: {},
    }),
    cycle(6, J.village, "หมู่บ้านสวนสน", "semiannual", "2027-H1", "2027-01-01", "2027-06-30", "open", {
      billables: 0,
      drafts: 0,
      needsReview: 0,
      issued: 0,
      total: "0.00",
      flags: {},
    }),
  ];
  const members: Schemas["MemberDto"][] = [
    {
      id: jid("9a00a001", 1),
      userId: "3b241101-e2bb-4255-8caf-4136c566a910",
      displayName: "วศิน ผู้จัดการนิติ",
      email: "juristic@example.com",
      phone: "+66810000010",
      role: "owner",
      status: "active",
      buildingIds: null,
      joinedAt: iso(-300),
      accessUntil: null,
    },
    {
      id: jid("9a00a001", 2),
      userId: "3b241101-e2bb-4255-8caf-4136c566a911",
      displayName: "ประภา กรรมการ",
      email: null,
      phone: "+66810000011",
      role: "committee",
      status: "active",
      buildingIds: null,
      joinedAt: iso(-120),
      accessUntil: null,
    },
    {
      id: jid("9a00a001", 3),
      userId: jid("3b24a0a1", 3),
      displayName: "สำนักงานสอบบัญชี เอ แอนด์ พี",
      email: "audit@ap.example",
      phone: null,
      role: "auditor",
      status: "active",
      buildingIds: null,
      joinedAt: iso(-10),
      accessUntil: `${date(80)}T23:59:59+07:00`,
    },
    {
      id: jid("9a00a001", 4),
      userId: jid("3b24a0a1", 4),
      displayName: "สมชาย เจ้าหน้าที่อาคาร",
      email: null,
      phone: "+66810000014",
      role: "staff",
      status: "active",
      buildingIds: null,
      joinedAt: iso(-260),
      accessUntil: null,
    },
    {
      id: jid("9a00a001", 5),
      userId: jid("3b24a0a1", 5),
      displayName: "สุดา บัญชีดี",
      email: "suda@example.com",
      phone: "+66810000015",
      role: "accountant",
      status: "active",
      buildingIds: null,
      joinedAt: iso(-200),
      accessUntil: null,
    },
    {
      id: jid("9a00a001", 6),
      userId: jid("3b24a0a1", 6),
      displayName: "นพดล กรรมการ",
      email: null,
      phone: "+66810000016",
      role: "committee",
      status: "active",
      buildingIds: null,
      joinedAt: iso(-120),
      accessUntil: null,
    },
  ];
  return {
    properties,
    buildings,
    floors,
    units,
    parties,
    ownerships,
    billTo,
    transfers: [
      {
        id: jid("70a0a001", 1),
        unitId: juristicUnitId(7),
        transferDate: date(-300),
        policy: "carry_to_buyer",
        fromOwnershipIds: [jid("0e0a0a01", 9)],
        toOwnershipIds: [jid("0e0a0a01", 8)],
        creditNoteIds: [jid("c4ed0a01", 1)],
        chargeIds: [jid("c4a90a01", 1)],
        note: "โอนตามสัญญาซื้อขาย ณ สำนักงานที่ดิน",
        createdAt: iso(-300),
      },
    ],
    invites: [],
    resolutions,
    budgets,
    ratePlans,
    cycles,
    members,
    invitations: [],
  };
}

const j = () => state.juristic;

/** The juristic tenant's call, or `null` (another tenant: the request falls through to the next handler). */
function juristicCall(request: Request, op: string, write = false): ReturnType<typeof owner> | null {
  const ok = write ? mutating(request, op) : owner(request, op);
  if (ok instanceof Response) return ok;
  return ok.tenantId === JURISTIC_TENANT ? ok : null;
}

const can = (ok: Exclude<ReturnType<typeof owner>, Response>, permission: string) => {
  const role = roleOf(ok);
  if (!role) return false;
  const table: Record<string, string[]> = {
    "juristic.register.manage": ["owner", "manager"],
    "juristic.budget.manage": ["owner", "manager"],
    "juristic.budget.approve": ["owner", "committee"],
    "juristic.resolution.manage": ["owner", "manager"],
    "juristic.resolution.adopt": ["owner", "committee"],
  };
  return (table[permission] ?? ["owner", "manager"]).includes(role);
};

function current(ownership: Ownership, on = date()): boolean {
  return ownership.validFrom <= on && (ownership.validTo === null || ownership.validTo > on);
}

function ownerDto(ownership: Ownership): Schemas["RegisterOwnerDto"] {
  return {
    ownershipId: ownership.id,
    party: j().parties.find((candidate) => candidate.id === ownership.partyId)!,
    sharePct: ownership.sharePct,
    validFrom: ownership.validFrom,
    validTo: ownership.validTo,
    source: ownership.source,
  };
}

function sharesTotal(owners: Ownership[]): string {
  const total = owners.reduce((sum, row) => sum + Math.round(Number(row.sharePct) * 10_000), 0);
  return (total / 10_000).toFixed(4);
}

function registerRow(u: JuristicUnit): Schemas["RegisterUnitDto"] {
  const building = j().buildings.find((candidate) => candidate.id === u.dto.buildingId)!;
  const owners = j().ownerships.filter((row) => row.unitId === u.dto.id && current(row));
  const total = sharesTotal(owners);
  return {
    unitId: u.dto.id,
    unitNo: u.dto.unitNo,
    type: u.dto.type,
    buildingId: building.id,
    buildingName: building.name,
    legalForm: building.legalForm,
    areaSqm: u.dto.areaSqm,
    ownershipRatio: u.dto.ownershipRatio,
    landAreaSqwa: u.dto.landAreaSqwa,
    plotNo: u.dto.plotNo,
    titleDeedNo: u.titleDeedNo,
    owners: owners.map(ownerDto),
    sharesTotal: total,
    incomplete: Number(total) < 100,
    billTo: j()
      .billTo.filter((row) => row.unitId === u.dto.id && (row.validTo === null || row.validTo > date()))
      .map(({ unitId: _unitId, ...dto }) => dto),
    version: u.dto.version,
  };
}

function registerDetail(u: JuristicUnit): Schemas["RegisterUnitDetailDto"] {
  return {
    ...registerRow(u),
    history: j()
      .ownerships.filter((row) => row.unitId === u.dto.id)
      .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
      .map(ownerDto),
    billToHistory: j()
      .billTo.filter((row) => row.unitId === u.dto.id)
      .map(({ unitId: _unitId, ...dto }) => dto),
    transfers: j().transfers.filter((row) => row.unitId === u.dto.id),
  };
}

function findUnit(unitId: unknown) {
  return j().units.find((candidate) => candidate.dto.id === unitId);
}

/** A register party as a full `PartyDto` (the parties list the pickers read). */
export function partyDto(row: Schemas["RegisterPartyDto"]): Schemas["PartyDto"] {
  return {
    id: row.id,
    type: row.type,
    displayName: row.displayName,
    firstName: null,
    lastName: null,
    companyName: row.type === "company" ? row.displayName : null,
    taxId: null,
    phone: row.phoneMasked,
    email: row.email,
    lineLinked: row.lineLinked,
    language: "th",
    nationality: null,
    idDocumentType: null,
    idDocumentCountry: null,
    idNumberOnFile: false,
    idExpiresOn: null,
    dateOfBirth: null,
    gender: null,
    address: null,
    emergencyContact: null,
    occupantProfile: null,
    linkedLogins: row.residentLinked ? 1 : 0,
    notes: null,
    anonymised: false,
    version: 1,
    createdAt: iso(-400),
  };
}

function newParty(input: Schemas["NewPartyDto"]): Schemas["RegisterPartyDto"] {
  const created: Schemas["RegisterPartyDto"] = {
    id: crypto.randomUUID(),
    type: input.type,
    displayName: input.displayName.trim(),
    phoneMasked: input.phone ? `+66•••••${input.phone.slice(-4)}` : null,
    email: input.email ?? null,
    lineLinked: false,
    residentLinked: false,
  };
  j().parties.push(created);
  return created;
}

const SHARE = /^(100(\.0{1,4})?|\d{1,2}(\.\d{1,4})?)$/;
const units4 = (pct: string) => Math.round(Number(pct) * 10_000);

/** Splits `total` (satang) over weights, half-up per unit and the remainder to the largest weight (J1.1b). */
function split(totalSatang: number, weights: { id: string; weight: number }[]): Map<string, number> {
  const sum = weights.reduce((acc, row) => acc + row.weight, 0);
  const result = new Map<string, number>();
  let given = 0;
  for (const row of weights) {
    const share = Math.round((totalSatang * row.weight) / sum);
    result.set(row.id, share);
    given += share;
  }
  const largest = [...weights].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))[0];
  if (largest) result.set(largest.id, result.get(largest.id)! + (totalSatang - given));
  return result;
}

const baht = (satang: number) => (satang / 100).toFixed(2);
const satangOf = (value: string) => Math.round(Number(value) * 100);
const MONTHS: Record<Schemas["BillingFrequency"], number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

function ratePreview(
  budget: Schemas["BudgetDto"],
  input: Schemas["RatePreviewRequestDto"],
): Schemas["RatePreviewDto"] | Response {
  const kind = input.kind;
  const lines = budget.lines.filter((row) =>
    input.lineIds?.length ? input.lineIds.includes(row.id) : row.kind === (kind === "fund" ? "fund" : "expense"),
  );
  const annual = lines.reduce((sum, row) => sum + satangOf(row.amount), 0);
  const plan = j().ratePlans.find(
    (candidate) => candidate.buildingId === budget.buildingId && candidate.kind === kind && candidate.isDefault,
  );
  const frequency = input.frequency ?? plan?.frequency ?? "monthly";
  const cycleSatang = Math.round((annual / 12) * MONTHS[frequency]);
  const building = j().buildings.find((candidate) => candidate.id === budget.buildingId)!;
  // A village budget is split over every plot of the estate (both soi).
  const scope = j().units.filter((u) => u.dto.propertyId === building.propertyId);
  const weightOf = (u: JuristicUnit): string | null =>
    input.splitBy === "ownership_ratio"
      ? u.dto.ownershipRatio
      : input.splitBy === "area_sqm"
        ? u.dto.areaSqm
        : input.splitBy === "land_area_sqwa"
          ? u.dto.landAreaSqwa
          : "1";
  const missing = scope.filter((u) => !weightOf(u));
  const weighted = scope.filter((u) => weightOf(u)).map((u) => ({ id: u.dto.id, weight: Number(weightOf(u)) }));
  const amounts = missing.length ? new Map<string, number>() : split(cycleSatang, weighted);
  const units = scope
    .filter((u) => weightOf(u))
    .map((u) => ({
      unitId: u.dto.id,
      unitNo: u.dto.unitNo,
      weight: weightOf(u)!,
      amount: baht(amounts.get(u.dto.id) ?? 0),
    }));
  const sorted = [...units].map((u) => satangOf(u.amount)).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)]! : 0;
  const sum = units.reduce((acc, u) => acc + satangOf(u.amount), 0);
  return {
    budgetId: budget.id,
    buildingId: budget.buildingId,
    kind,
    splitBy: input.splitBy,
    frequency,
    annualAmount: baht(annual),
    cycleAmount: baht(cycleSatang),
    min: baht(sorted[0] ?? 0),
    median: baht(median),
    max: baht(sorted.at(-1) ?? 0),
    sum: baht(sum),
    sumMatches: missing.length === 0 && sum === cycleSatang,
    unitsCount: scope.length,
    missingUnitIds: missing.map((u) => u.dto.id),
    units,
    ratePlanId: plan?.id ?? null,
  };
}

function cycleStatus(cycle: Schemas["BillingCycleDto"]): Schemas["BillingCycleDetailDto"] {
  return { ...cycle, invoices: [] };
}

export const juristicHandlers: HttpHandler[] = [
  // ── Generic endpoints, answered for the juristic tenant ───────────────────────────────────────────────────────
  http.get("*/v1/owner/properties", ({ request }) => {
    const ok = juristicCall(request, "owner.properties.list");
    if (!ok) return;
    if (ok instanceof Response) return ok;
    return json(j().properties);
  }),
  http.post("*/v1/owner/properties", async ({ request }) => {
    const op = "owner.properties.create";
    const ok = juristicCall(request, op, true);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["PropertyCreateDto"]>(request);
    record(op, request, input);
    if (!input.kind) return validation(op, "kind", "required for a juristic tenant");
    if (!input.name?.trim()) return validation(op, "name", "required");
    const property: Schemas["PropertyDto"] = {
      id: crypto.randomUUID(),
      code: input.code,
      name: input.name.trim(),
      address: input.address ?? null,
      provinceCode: input.provinceCode ?? null,
      kind: input.kind,
      status: "active",
      createdAt: iso(),
      version: 1,
    };
    j().properties.push(property);
    return json(property, 201);
  }),
  http.get("*/v1/owner/properties/:propertyId", ({ request, params }) => {
    const op = "owner.properties.get";
    const ok = juristicCall(request, op);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const property = j().properties.find((candidate) => candidate.id === params.propertyId);
    return property ? json(property, 200, { etag: `"v${property.version}"` }) : problem(op, "http.not_found");
  }),
  http.patch("*/v1/owner/properties/:propertyId", async ({ request, params }) => {
    const op = "owner.properties.update";
    const ok = juristicCall(request, op, true);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const property = j().properties.find((candidate) => candidate.id === params.propertyId);
    if (!property) return problem(op, "http.not_found");
    const input = await body<Schemas["PropertyUpdateDto"]>(request);
    record(op, request, input);
    if (input.kind) property.kind = input.kind;
    if (input.name) property.name = input.name;
    property.version += 1;
    return json(property, 200, { etag: `"v${property.version}"` });
  }),
  http.get("*/v1/owner/buildings", ({ request }) => {
    const ok = juristicCall(request, "owner.buildings.list");
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const propertyId = query(request).get("propertyId");
    return json(j().buildings.filter((building) => !propertyId || building.propertyId === propertyId));
  }),
  http.post("*/v1/owner/buildings", async ({ request }) => {
    const op = "owner.buildings.create";
    const ok = juristicCall(request, op, true);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["BuildingCreateDto"]>(request);
    record(op, request, input);
    if (!input.legalForm) return validation(op, "legalForm", "required for a juristic tenant");
    const building: Schemas["BuildingDto"] = {
      id: crypto.randomUUID(),
      propertyId: input.propertyId,
      code: input.code,
      name: input.name,
      type: input.type,
      floorsCount: input.floorsCount ?? null,
      ownerTenantId: JURISTIC_TENANT,
      operatorTenantId: JURISTIC_TENANT,
      access: "operator",
      legalForm: input.legalForm,
      status: "active",
      unitCount: 0,
      version: 1,
    };
    j().buildings.push(building);
    return json(building, 201);
  }),
  http.get("*/v1/owner/buildings/:buildingId", ({ request, params }) => {
    const op = "owner.buildings.get";
    const ok = juristicCall(request, op);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const building = j().buildings.find((candidate) => candidate.id === params.buildingId);
    return building ? json(building, 200, { etag: `"v${building.version}"` }) : problem(op, "http.not_found");
  }),
  http.patch("*/v1/owner/buildings/:buildingId", async ({ request, params }) => {
    const op = "owner.buildings.update";
    const ok = juristicCall(request, op, true);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const building = j().buildings.find((candidate) => candidate.id === params.buildingId);
    if (!building) return problem(op, "http.not_found");
    const input = await body<Schemas["BuildingUpdateDto"]>(request);
    record(op, request, input);
    if (input.legalForm) building.legalForm = input.legalForm;
    if (input.name) building.name = input.name;
    building.version += 1;
    return json(building, 200, { etag: `"v${building.version}"` });
  }),
  http.get("*/v1/owner/buildings/:buildingId/floors", ({ request, params }) => {
    const ok = juristicCall(request, "owner.floors.list");
    if (!ok) return;
    if (ok instanceof Response) return ok;
    return json(j().floors.filter((floor) => floor.buildingId === params.buildingId));
  }),
  http.get("*/v1/owner/units", ({ request }) => {
    const ok = juristicCall(request, "owner.units.list");
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const rows = j()
      .units.map((u) => u.dto)
      .filter(
        (u) =>
          (!params.get("buildingId") || u.buildingId === params.get("buildingId")) &&
          (!params.get("floorId") || u.floorId === params.get("floorId")) &&
          (!q || u.unitNo.toLowerCase().includes(q)),
      );
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/parties", ({ request }) => {
    const ok = juristicCall(request, "owner.parties.list");
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const rows = j()
      .parties.filter(
        (row) =>
          (!params.get("type") || row.type === params.get("type")) && (!q || row.displayName.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "th"))
      .map(partyDto);
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/billing-cycles", ({ request }) => {
    const ok = juristicCall(request, "owner.billingCycles.list");
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = j().cycles.filter(
      (cycle) =>
        (!params.get("propertyId") || cycle.propertyId === params.get("propertyId")) &&
        (!params.get("status") || cycle.status === params.get("status")) &&
        (!params.get("frequency") || cycle.frequency === params.get("frequency")),
    );
    return json(
      paged(
        [...rows].sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
        request,
      ),
    );
  }),
  http.get("*/v1/owner/billing-cycles/:billingCycleId", ({ request, params }) => {
    const op = "owner.billingCycles.get";
    const ok = juristicCall(request, op);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const cycle = j().cycles.find((candidate) => candidate.id === params.billingCycleId);
    return cycle ? json(cycleStatus(cycle)) : problem(op, "http.not_found");
  }),
  http.get("*/v1/owner/rate-plans", ({ request }) => {
    const ok = juristicCall(request, "owner.ratePlans.list");
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const params = query(request);
    return json(
      j().ratePlans.filter(
        (plan) =>
          (!params.get("kind") || plan.kind === params.get("kind")) &&
          (!params.get("buildingId") || plan.buildingId === params.get("buildingId")),
      ),
    );
  }),
  http.post("*/v1/owner/rate-plans", async ({ request }) => {
    const op = "owner.ratePlans.create";
    const ok = juristicCall(request, op, true);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["RatePlanCreateDto"]>(request);
    record(op, request, input);
    if (!input.name?.trim()) return validation(op, "name", "required");
    if (input.frequency && input.frequency !== "monthly" && !["common_fee", "fund"].includes(input.kind))
      return validation(op, "frequency", "only common fee and fund plans may be billed less often than monthly");
    const plan: Schemas["RatePlanDto"] = {
      id: crypto.randomUUID(),
      kind: input.kind,
      name: input.name.trim(),
      buildingId: input.buildingId ?? null,
      isDefault: input.isDefault ?? false,
      frequency: input.frequency ?? "monthly",
      version: 1,
      versions: [],
    };
    j().ratePlans.push(plan);
    return json(plan, 201, { etag: `"rp${plan.version}"` });
  }),
  http.get("*/v1/owner/rate-plans/:planId", ({ request, params }) => {
    const op = "owner.ratePlans.get";
    const ok = juristicCall(request, op);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const plan = j().ratePlans.find((candidate) => candidate.id === params.planId);
    return plan ? json(plan, 200, { etag: `"rp${plan.version}"` }) : problem(op, "http.not_found");
  }),
  http.patch("*/v1/owner/rate-plans/:planId", async ({ request, params }) => {
    const op = "owner.ratePlans.update";
    const ok = juristicCall(request, op, true);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const plan = j().ratePlans.find((candidate) => candidate.id === params.planId);
    if (!plan) return problem(op, "http.not_found");
    const input = await body<Schemas["RatePlanUpdateDto"]>(request);
    record(op, request, input);
    if (input.frequency && input.frequency !== "monthly" && !["common_fee", "fund"].includes(plan.kind))
      return validation(op, "frequency", "only common fee and fund plans may be billed less often than monthly");
    if (input.name !== undefined) plan.name = input.name.trim();
    if (input.isDefault !== undefined) plan.isDefault = input.isDefault;
    if (input.frequency) plan.frequency = input.frequency;
    plan.version += 1;
    return json(plan, 200, { etag: `"rp${plan.version}"` });
  }),
  http.post("*/v1/owner/rate-plans/:planId/versions", async ({ request, params }) => {
    const op = "owner.ratePlans.saveVersion";
    const ok = juristicCall(request, op, true);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const plan = j().ratePlans.find((candidate) => candidate.id === params.planId);
    if (!plan) return problem(op, "http.not_found");
    const input = await body<Schemas["RatePlanVersionCreateDto"]>(request);
    record(op, request, input);
    const building = j().buildings.find((candidate) => candidate.id === plan.buildingId);
    const resolution = j().resolutions.find((candidate) => candidate.id === input.resolutionId);
    if (["common_fee", "fund"].includes(plan.kind) && !input.resolutionId)
      return problem(op, "rate_plan.resolution_required", {
        errors: [{ path: "resolutionId", code: "required", message: "an adopted resolution of the building" }],
      });
    if (
      input.resolutionId &&
      (!resolution || resolution.state !== "adopted" || (building && resolution.buildingId !== building.id))
    )
      return problem(op, "rate_plan.resolution_invalid", {
        errors: [{ path: "resolutionId", code: "invalid", message: "not an adopted resolution of this building" }],
      });
    const effectiveFrom = input.effectiveFrom ?? date();
    for (const existing of plan.versions)
      if (existing.inForce && effectiveFrom <= date())
        Object.assign(existing, { inForce: false, effectiveTo: effectiveFrom });
    plan.versions.unshift({
      id: crypto.randomUUID(),
      basis: input.basis,
      tiers: input.tiers,
      minimumCharge: input.minimumCharge ?? null,
      note: input.note ?? null,
      effectiveFrom,
      effectiveTo: null,
      inForce: effectiveFrom <= date(),
      aboveCap: false,
      capCheck: null,
      complianceAcknowledgementId: null,
      resolutionId: input.resolutionId ?? null,
    });
    plan.version += 1;
    return json(plan, 201, { etag: `"rp${plan.version}"` });
  }),
  http.get("*/v1/owner/members", ({ request }) => {
    const ok = juristicCall(request, "owner.members.list");
    if (!ok) return;
    if (ok instanceof Response) return ok;
    return json(j().members);
  }),
  http.get("*/v1/owner/invitations", ({ request }) => {
    const ok = juristicCall(request, "owner.invitations.list");
    if (!ok) return;
    if (ok instanceof Response) return ok;
    return json(j().invitations);
  }),
  http.post("*/v1/owner/invitations", async ({ request }) => {
    const op = "owner.invitations.create";
    const ok = juristicCall(request, op, true);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["InvitationCreateDto"]>(request);
    record(op, request, input);
    if (input.channel === "sms" && !/^\+66\d{9}$/.test(input.phone ?? ""))
      return validation(op, "phone", "a Thai mobile number");
    if (input.channel === "email" && !/^[^@\s]+@[^@\s]+$/.test(input.email ?? ""))
      return validation(op, "email", "an email address");
    if (input.role === "auditor" && !input.accessUntil)
      return problem(op, "membership.access_until_required", {
        errors: [{ path: "accessUntil", code: "required", message: "an auditor's access needs an end date" }],
      });
    if (input.accessUntil && new Date(input.accessUntil).getTime() > Date.now() + 365 * DAY)
      return validation(op, "accessUntil", "within juristic.auditor_max_days (365)");
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const invitation: Schemas["InvitationCreatedDto"] = {
      id: crypto.randomUUID(),
      role: input.role,
      channel: input.channel,
      phoneMasked: input.phone ? `${input.phone.slice(0, 4)} xx-xxx-${input.phone.slice(-4)}` : null,
      email: input.email ?? null,
      buildingIds: input.buildingIds ?? [],
      state: "pending",
      createdAt: iso(),
      expiresAt: iso(7),
      acceptedAt: null,
      accessUntil: input.role === "auditor" ? (input.accessUntil ?? null) : null,
      nextActions: ["revoke"],
      code,
      inviteUrl: `${new URL(request.url).origin}/join?code=${code}`,
    };
    const { code: _code, inviteUrl: _url, ...stored } = invitation;
    void _code;
    void _url;
    j().invitations.unshift(stored);
    return json(invitation, 201);
  }),
  // Files of the juristic tenant: presign / upload / complete are the shared stand-in (owner/files.ts); a download of
  // a seeded juristic document (minutes, consent letters) answers the placeholder PDF.
  http.get("*/v1/owner/files/:fileId", ({ request, params }) => {
    const op = "owner.files.get";
    const ok = juristicCall(request, op);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const fileId = String(params.fileId);
    const stored = state.staff.files.get(fileId);
    if (stored) return; // uploaded through the stand-in: the shared handler signs it
    const origin = new URL(request.url).origin;
    return json({
      file: {
        id: fileId,
        kind: "other",
        scopeType: "building",
        scopeId: null,
        buildingId: J.buildingA,
        title: null,
        mimeType: "application/pdf",
        sizeBytes: 1,
        width: null,
        height: null,
        retentionClass: "juristic_record",
        scanStatus: "clean",
        uploadState: "verified",
        createdAt: iso(-1),
      },
      url: `${origin}/__files/pdf-${fileId}`,
      thumbnailUrl: null,
      expiresAt: iso(0.003),
    } satisfies Schemas["FileDownloadDto"]);
  }),

  // ── Register (J1.1b) ──────────────────────────────────────────────────────────────────────────────────────────
  http.get("*/v1/owner/juristic/register", ({ request }) => {
    const op = "owner.juristicRegister.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (ok.tenantId !== JURISTIC_TENANT) return json(paged([], request));
    const params = query(request);
    const q = params.get("q")?.toLowerCase().trim();
    const rows = j()
      .units.filter((u) => !params.get("buildingId") || u.dto.buildingId === params.get("buildingId"))
      .map(registerRow)
      .filter(
        (row) =>
          (params.get("incomplete") !== "true" || row.incomplete) &&
          (!q ||
            row.unitNo.toLowerCase().includes(q) ||
            (row.plotNo ?? "").includes(q) ||
            row.owners.some((o) => o.party.displayName.toLowerCase().includes(q))),
      );
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/juristic/register/units/:unitId", ({ request, params }) => {
    const op = "owner.juristicRegister.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const u = ok.tenantId === JURISTIC_TENANT ? findUnit(params.unitId) : undefined;
    return u ? json(registerDetail(u)) : problem(op, "http.not_found");
  }),
  http.patch("*/v1/owner/juristic/register/units/:unitId", async ({ request, params }) => {
    const op = "owner.juristicRegister.updateUnit";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const u = ok.tenantId === JURISTIC_TENANT ? findUnit(params.unitId) : undefined;
    if (!u) return problem(op, "http.not_found");
    if (!can(ok, "juristic.register.manage")) return problem(op, "auth.forbidden");
    const input = await body<Schemas["RegisterUnitUpdateDto"]>(request);
    record(op, request, input);
    if (input.version !== undefined && input.version !== u.dto.version) return problem(op, "concurrency.stale");
    const decimal = /^\d{1,9}(\.\d{1,6})?$/;
    for (const key of ["areaSqm", "landAreaSqwa", "ownershipRatio"] as const) {
      const value = input[key];
      if (value !== undefined && value !== null && !decimal.test(value)) return validation(op, key, "a decimal number");
    }
    if (input.areaSqm !== undefined) u.dto.areaSqm = input.areaSqm;
    if (input.landAreaSqwa !== undefined) u.dto.landAreaSqwa = input.landAreaSqwa;
    if (input.ownershipRatio !== undefined) u.dto.ownershipRatio = input.ownershipRatio;
    if (input.plotNo !== undefined) u.dto.plotNo = input.plotNo;
    if (input.titleDeedNo !== undefined) u.titleDeedNo = input.titleDeedNo;
    u.dto.version += 1;
    return json(registerDetail(u));
  }),
  http.post("*/v1/owner/juristic/register/units/:unitId/owners", async ({ request, params }) => {
    const op = "owner.juristicRegister.addOwner";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const u = ok.tenantId === JURISTIC_TENANT ? findUnit(params.unitId) : undefined;
    if (!u) return problem(op, "http.not_found");
    if (!can(ok, "juristic.register.manage")) return problem(op, "auth.forbidden");
    const input = await body<Schemas["OwnerAddDto"]>(request);
    record(op, request, input);
    if (!SHARE.test(input.sharePct ?? "") || units4(input.sharePct) === 0)
      return validation(op, "sharePct", "a share in percent, 0 < x ≤ 100");
    if (!input.partyId && !input.party?.displayName?.trim()) return validation(op, "party.displayName", "required");
    const owners = j().ownerships.filter((row) => row.unitId === u.dto.id && current(row));
    if (owners.reduce((sum, row) => sum + units4(row.sharePct), 0) + units4(input.sharePct) > 1_000_000)
      return problem(op, "register.shares_exceeded", {
        errors: [{ path: "sharePct", code: "max", message: "the shares of the unit would pass 100 %" }],
      });
    const partyId = input.partyId ?? newParty(input.party!).id;
    j().ownerships.push({
      id: crypto.randomUUID(),
      unitId: u.dto.id,
      partyId,
      sharePct: Number(input.sharePct).toFixed(4),
      validFrom: input.validFrom ?? date(),
      validTo: null,
      source: "manual",
    });
    return json(registerDetail(u), 201);
  }),
  http.get("*/v1/owner/juristic/register/units/:unitId/transfers", ({ request, params }) => {
    const op = "owner.juristicRegister.transfers";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const u = ok.tenantId === JURISTIC_TENANT ? findUnit(params.unitId) : undefined;
    return u ? json(j().transfers.filter((row) => row.unitId === u.dto.id)) : problem(op, "http.not_found");
  }),
  http.post("*/v1/owner/juristic/register/units/:unitId/transfers", async ({ request, params }) => {
    const op = "owner.juristicRegister.transfer";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const u = ok.tenantId === JURISTIC_TENANT ? findUnit(params.unitId) : undefined;
    if (!u) return problem(op, "http.not_found");
    if (!can(ok, "juristic.register.manage")) return problem(op, "auth.forbidden");
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["TransferCreateDto"];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transferDate ?? "")) return validation(op, "transferDate", "a date");
      if (!input.buyers?.length) return validation(op, "buyers", "at least one buyer");
      for (const [index, buyer] of input.buyers.entries())
        if (!SHARE.test(buyer.sharePct ?? "") || units4(buyer.sharePct) === 0)
          return validation(op, `buyers[${index}].sharePct`, "a share in percent, 0 < x ≤ 100");
      if (input.buyers.reduce((sum, buyer) => sum + units4(buyer.sharePct), 0) > 1_000_000)
        return problem(op, "register.shares_exceeded", {
          errors: [{ path: "buyers", code: "max", message: "the buyers' shares pass 100 %" }],
        });
      const sellers = j().ownerships.filter((row) => row.unitId === u.dto.id && current(row, input.transferDate));
      if (sellers.length === 0) return problem(op, "register.transfer_invalid");
      for (const seller of sellers) seller.validTo = input.transferDate;
      for (const row of j().billTo)
        if (row.unitId === u.dto.id && row.validTo === null)
          Object.assign(row, { validTo: input.transferDate, endedReason: "ownership_transfer" });
      const bought = input.buyers.map((buyer) => {
        const partyId = buyer.partyId ?? newParty(buyer.party!).id;
        const row: Ownership = {
          id: crypto.randomUUID(),
          unitId: u.dto.id,
          partyId,
          sharePct: Number(buyer.sharePct).toFixed(4),
          validFrom: input.transferDate,
          validTo: null,
          source: "transfer",
        };
        j().ownerships.push(row);
        return row;
      });
      const policy = input.policy ?? "carry_to_buyer";
      // A condo unit carries an issued advance (quarterly) invoice this quarter: credit the seller, charge the buyers.
      const advance = u.dto.propertyId === J.condo;
      const transfer: Schemas["OwnershipTransferDto"] = {
        id: crypto.randomUUID(),
        unitId: u.dto.id,
        transferDate: input.transferDate,
        policy,
        fromOwnershipIds: sellers.map((row) => row.id),
        toOwnershipIds: bought.map((row) => row.id),
        creditNoteIds: advance ? sellers.map(() => crypto.randomUUID()) : [],
        chargeIds: advance && policy === "carry_to_buyer" ? bought.map(() => crypto.randomUUID()) : [],
        note: input.note ?? null,
        createdAt: iso(),
      };
      j().transfers.unshift(transfer);
      return { status: 201, body: { transfer, register: registerDetail(u) } satisfies Schemas["TransferResultDto"] };
    });
  }),
  http.post("*/v1/owner/juristic/register/units/:unitId/bill-to", async ({ request, params }) => {
    const op = "owner.juristicRegister.setBillTo";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const u = ok.tenantId === JURISTIC_TENANT ? findUnit(params.unitId) : undefined;
    if (!u) return problem(op, "http.not_found");
    if (!can(ok, "juristic.register.manage")) return problem(op, "auth.forbidden");
    const input = await body<Schemas["BillToCreateDto"]>(request);
    record(op, request, input);
    const errors = [
      ...(!input.consentDocumentId
        ? [{ path: "consentDocumentId", code: "required", message: "the owner's written consent" }]
        : []),
      ...(!input.payer?.partyId && !input.payer?.party?.displayName?.trim()
        ? [{ path: "payer.party.displayName", code: "required", message: "who pays" }]
        : []),
      ...(!j().ownerships.some((row) => row.unitId === u.dto.id && row.partyId === input.ownerPartyId && current(row))
        ? [{ path: "ownerPartyId", code: "invalid", message: "a current co-owner of the unit" }]
        : []),
    ];
    if (errors.length) return problem(op, "validation.failed", { errors });
    const payer = input.payer.partyId
      ? j().parties.find((row) => row.id === input.payer.partyId)
      : newParty(input.payer.party!);
    if (!payer) return validation(op, "payer.partyId", "unknown party");
    const validFrom = input.validFrom ?? date();
    for (const row of j().billTo)
      if (row.unitId === u.dto.id && row.ownerPartyId === input.ownerPartyId && row.validTo === null)
        Object.assign(row, { validTo: validFrom, endedReason: "replaced" });
    j().billTo.push({
      id: crypto.randomUUID(),
      unitId: u.dto.id,
      ownerPartyId: input.ownerPartyId,
      billToParty: payer,
      kind: input.kind,
      consentDocumentId: input.consentDocumentId,
      consentNote: input.consentNote ?? null,
      validFrom,
      validTo: null,
      endedReason: null,
    });
    return json(registerDetail(u), 201);
  }),
  http.post("*/v1/owner/juristic/register/units/:unitId/bill-to/:billToId/actions/end", async ({ request, params }) => {
    const op = "owner.juristicRegister.endBillTo";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const u = ok.tenantId === JURISTIC_TENANT ? findUnit(params.unitId) : undefined;
    const row = j().billTo.find((candidate) => candidate.id === params.billToId && candidate.unitId === u?.dto.id);
    if (!u || !row) return problem(op, "http.not_found");
    const input = await body<Schemas["BillToEndDto"]>(request);
    record(op, request, input);
    Object.assign(row, { validTo: input.validTo ?? date(), endedReason: "ended" });
    return json(registerDetail(u));
  }),

  // ── Resident invite codes (JR) ────────────────────────────────────────────────────────────────────────────────
  http.get("*/v1/owner/units/:unitId/resident-invites", ({ request, params }) => {
    const op = "owner.units.residentInvites";
    const ok = juristicCall(request, op);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const u = findUnit(params.unitId);
    return u ? json(j().invites.filter((row) => row.unitId === u.dto.id)) : problem(op, "http.not_found");
  }),
  http.post("*/v1/owner/units/:unitId/resident-invites", async ({ request, params }) => {
    const op = "owner.units.inviteResident";
    const ok = juristicCall(request, op, true);
    if (!ok) return;
    if (ok instanceof Response) return ok;
    const u = findUnit(params.unitId);
    if (!u) return problem(op, "http.not_found");
    return idempotent(request, op, async (payload) => {
      const input = payload as unknown as Schemas["UnitResidentInviteCreateDto"];
      const owners = j().ownerships.filter((row) => row.unitId === u.dto.id && current(row));
      const ownerRow = input.partyId
        ? owners.find((row) => row.partyId === input.partyId)
        : owners.length === 1
          ? owners[0]
          : undefined;
      if (!ownerRow) return validation(op, "partyId", "a current co-owner of the unit");
      const target = j().parties.find((row) => row.id === ownerRow.partyId)!;
      if (input.channel === "sms" && !target.phoneMasked) return problem(op, "invitation.phone_missing");
      const code = Array.from({ length: 4 }, () =>
        Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X"),
      ).join("-");
      const url = `https://liff.getproperty.invalid/link/unit?code=${code}`;
      const invite: Schemas["UnitResidentInviteDto"] = {
        id: crypto.randomUUID(),
        unitId: u.dto.id,
        partyId: target.id,
        channel: input.channel,
        state: "pending",
        expiresAt: iso(14),
        acceptedAt: null,
        createdAt: iso(),
      };
      j().invites.unshift(invite);
      return {
        status: 201,
        body: {
          ...invite,
          unitNo: u.dto.unitNo,
          code,
          url,
          qrPayload: url,
          qrPngDataUrl: await toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" }),
        } satisfies Schemas["UnitResidentInviteCreatedDto"],
      };
    });
  }),

  // ── Resolutions and budgets (J1.1b) ───────────────────────────────────────────────────────────────────────────
  http.get("*/v1/owner/juristic/resolutions", ({ request }) => {
    const op = "owner.juristicResolutions.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const rows = (ok.tenantId === JURISTIC_TENANT ? j().resolutions : []).filter(
      (row) =>
        (!params.get("buildingId") || row.buildingId === params.get("buildingId")) &&
        (!params.get("state") || row.state === params.get("state")) &&
        (!q || row.title.toLowerCase().includes(q) || row.number.includes(q)),
    );
    return json(
      paged(
        [...rows].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate)),
        request,
      ),
    );
  }),
  http.post("*/v1/owner/juristic/resolutions", async ({ request }) => {
    const op = "owner.juristicResolutions.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (ok.tenantId !== JURISTIC_TENANT) return problem(op, "http.not_found");
    if (!can(ok, "juristic.resolution.manage")) return problem(op, "auth.forbidden");
    const input = await body<Schemas["ResolutionCreateDto"]>(request);
    record(op, request, input);
    const errors = (["buildingId", "meetingKind", "meetingDate", "number", "title", "text"] as const)
      .filter((key) => !String(input[key] ?? "").trim())
      .map((path) => ({ path, code: "required", message: "required" }));
    if (errors.length) return problem(op, "validation.failed", { errors });
    const row: Schemas["ResolutionDto"] = {
      id: crypto.randomUUID(),
      buildingId: input.buildingId,
      meetingKind: input.meetingKind,
      meetingDate: input.meetingDate,
      number: input.number,
      title: input.title,
      text: input.text,
      votesSummary: input.votesSummary ?? null,
      state: "draft",
      adoptedAt: null,
      voidedAt: null,
      voidReason: null,
      documents: [],
      nextActions: ["adopt", "void", "update", "add_document"],
      version: 1,
      createdAt: iso(),
    };
    j().resolutions.unshift(row);
    return json(row, 201);
  }),
  http.get("*/v1/owner/juristic/resolutions/:resolutionId", ({ request, params }) => {
    const op = "owner.juristicResolutions.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const row = ok.tenantId === JURISTIC_TENANT ? j().resolutions.find((r) => r.id === params.resolutionId) : undefined;
    return row ? json(row) : problem(op, "http.not_found");
  }),
  http.patch("*/v1/owner/juristic/resolutions/:resolutionId", async ({ request, params }) => {
    const op = "owner.juristicResolutions.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const row = ok.tenantId === JURISTIC_TENANT ? j().resolutions.find((r) => r.id === params.resolutionId) : undefined;
    if (!row) return problem(op, "http.not_found");
    if (row.state !== "draft") return problem(op, "resolution.invalid_state");
    const input = await body<Schemas["ResolutionUpdateDto"]>(request);
    record(op, request, input);
    if (input.version !== undefined && input.version !== row.version) return problem(op, "concurrency.stale");
    const { version: _version, ...patch } = input;
    void _version;
    Object.assign(row, patch, { version: row.version + 1 });
    return json(row);
  }),
  http.post("*/v1/owner/juristic/resolutions/:resolutionId/actions/adopt", async ({ request, params }) => {
    const op = "owner.juristicResolutions.adopt";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const row = ok.tenantId === JURISTIC_TENANT ? j().resolutions.find((r) => r.id === params.resolutionId) : undefined;
    if (!row) return problem(op, "http.not_found");
    if (!can(ok, "juristic.resolution.adopt")) return problem(op, "auth.forbidden");
    return idempotent(request, op, () => {
      if (row.state !== "draft") return problem(op, "resolution.invalid_state");
      Object.assign(row, {
        state: "adopted",
        adoptedAt: iso(),
        nextActions: ["void", "add_document"],
        version: row.version + 1,
      });
      return { status: 200, body: row };
    });
  }),
  http.post("*/v1/owner/juristic/resolutions/:resolutionId/actions/void", async ({ request, params }) => {
    const op = "owner.juristicResolutions.void";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const row = ok.tenantId === JURISTIC_TENANT ? j().resolutions.find((r) => r.id === params.resolutionId) : undefined;
    if (!row) return problem(op, "http.not_found");
    if (!can(ok, "juristic.resolution.adopt")) return problem(op, "auth.forbidden");
    const input = await body<Schemas["ReasonDto"]>(request);
    record(op, request, input);
    if (!input.reason?.trim()) return validation(op, "reason", "required");
    if (row.state === "void") return problem(op, "resolution.invalid_state");
    // A resolution an approved budget or a rate version names cannot be voided (the API's guard).
    if (j().budgets.some((b) => b.resolutionId === row.id && b.state === "approved"))
      return problem(op, "resolution.invalid_state", {
        detail: "มติฉบับนี้ใช้อนุมัติงบประมาณแล้ว ยกเลิกไม่ได้",
      });
    Object.assign(row, {
      state: "void",
      voidedAt: iso(),
      voidReason: input.reason.trim(),
      nextActions: [],
      version: row.version + 1,
    });
    return json(row);
  }),
  http.post("*/v1/owner/juristic/resolutions/:resolutionId/documents", async ({ request, params }) => {
    const op = "owner.juristicResolutions.addDocument";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const row = ok.tenantId === JURISTIC_TENANT ? j().resolutions.find((r) => r.id === params.resolutionId) : undefined;
    if (!row) return problem(op, "http.not_found");
    if (row.state === "void") return problem(op, "resolution.invalid_state");
    const input = await body<Schemas["ResolutionDocumentAddDto"]>(request);
    record(op, request, input);
    if (!input.documentId) return validation(op, "documentId", "required");
    row.documents.push({ documentId: input.documentId, kind: input.kind, createdAt: iso() });
    return json(row);
  }),
  http.delete("*/v1/owner/juristic/resolutions/:resolutionId/documents/:documentId", ({ request, params }) => {
    const op = "owner.juristicResolutions.removeDocument";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const row = ok.tenantId === JURISTIC_TENANT ? j().resolutions.find((r) => r.id === params.resolutionId) : undefined;
    if (!row) return problem(op, "http.not_found");
    if (row.state !== "draft") return problem(op, "resolution.invalid_state");
    row.documents = row.documents.filter((doc) => doc.documentId !== params.documentId);
    return json(row);
  }),
  http.get("*/v1/owner/juristic/budgets", ({ request }) => {
    const op = "owner.juristicBudgets.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = (ok.tenantId === JURISTIC_TENANT ? j().budgets : []).filter(
      (row) =>
        (!params.get("buildingId") || row.buildingId === params.get("buildingId")) &&
        (!params.get("state") || row.state === params.get("state")) &&
        (!params.get("fiscalYear") || String(row.fiscalYear) === params.get("fiscalYear")),
    );
    return json(paged(rows, request));
  }),
  http.post("*/v1/owner/juristic/budgets", async ({ request }) => {
    const op = "owner.juristicBudgets.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (ok.tenantId !== JURISTIC_TENANT) return problem(op, "http.not_found");
    if (!can(ok, "juristic.budget.manage")) return problem(op, "auth.forbidden");
    const input = await body<Schemas["BudgetCreateDto"]>(request);
    record(op, request, input);
    const errors = [
      ...(!input.buildingId ? [{ path: "buildingId", code: "required", message: "required" }] : []),
      ...(!input.name?.trim() ? [{ path: "name", code: "required", message: "required" }] : []),
      ...(!Number.isInteger(input.fiscalYear) ? [{ path: "fiscalYear", code: "required", message: "a year" }] : []),
      ...(input.lines ?? []).flatMap((row, index) => [
        ...(!row.label?.trim() ? [{ path: `lines[${index}].label`, code: "required", message: "required" }] : []),
        ...(!/^\d{1,12}(\.\d{1,2})?$/.test(row.amount ?? "")
          ? [{ path: `lines[${index}].amount`, code: "pattern", message: "an amount in baht" }]
          : []),
      ]),
    ];
    if (errors.length) return problem(op, "validation.failed", { errors });
    const lines = input.lines.map((row) => ({
      id: crypto.randomUUID(),
      kind: row.kind,
      label: row.label.trim(),
      amount: Number(row.amount).toFixed(2),
      accountId: null,
    }));
    const sum = (kinds: string[]) =>
      baht(lines.filter((row) => kinds.includes(row.kind)).reduce((acc, row) => acc + satangOf(row.amount), 0));
    const budget: Schemas["BudgetDto"] = {
      id: crypto.randomUUID(),
      buildingId: input.buildingId,
      fiscalYear: input.fiscalYear,
      name: input.name.trim(),
      periodStart: input.periodStart ?? `${input.fiscalYear}-01-01`,
      periodEnd: input.periodEnd ?? `${input.fiscalYear}-12-31`,
      state: "draft",
      resolutionId: null,
      total: sum(["expense", "fund"]),
      incomeTotal: sum(["income"]),
      lines,
      approvedAt: null,
      nextActions: ["approve", "update", "rate_preview", "create_rate_plan_draft"],
      version: 1,
    };
    j().budgets.unshift(budget);
    return json(budget, 201);
  }),
  http.get("*/v1/owner/juristic/budgets/:budgetId", ({ request, params }) => {
    const op = "owner.juristicBudgets.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const row = ok.tenantId === JURISTIC_TENANT ? j().budgets.find((b) => b.id === params.budgetId) : undefined;
    return row ? json(row) : problem(op, "http.not_found");
  }),
  http.post("*/v1/owner/juristic/budgets/:budgetId/actions/approve", async ({ request, params }) => {
    const op = "owner.juristicBudgets.approve";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const budget = ok.tenantId === JURISTIC_TENANT ? j().budgets.find((b) => b.id === params.budgetId) : undefined;
    if (!budget) return problem(op, "http.not_found");
    if (!can(ok, "juristic.budget.approve")) return problem(op, "auth.forbidden");
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["BudgetApproveDto"];
      if (budget.state !== "draft") return problem(op, "budget.invalid_state");
      const resolution = j().resolutions.find((row) => row.id === input.resolutionId);
      if (!resolution || resolution.state !== "adopted" || resolution.buildingId !== budget.buildingId)
        return validation(op, "resolutionId", "an adopted resolution of the budget's building");
      for (const other of j().budgets)
        if (
          other !== budget &&
          other.buildingId === budget.buildingId &&
          other.fiscalYear === budget.fiscalYear &&
          other.state === "approved"
        )
          Object.assign(other, { state: "superseded", nextActions: [] });
      Object.assign(budget, {
        state: "approved",
        resolutionId: resolution.id,
        approvedAt: iso(),
        nextActions: ["rate_preview", "create_rate_plan_draft"],
        version: budget.version + 1,
      });
      return { status: 200, body: budget };
    });
  }),
  http.post("*/v1/owner/juristic/budgets/:budgetId/rate-preview", async ({ request, params }) => {
    const op = "owner.juristicBudgets.ratePreview";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const budget = ok.tenantId === JURISTIC_TENANT ? j().budgets.find((b) => b.id === params.budgetId) : undefined;
    if (!budget) return problem(op, "http.not_found");
    const input = await body<Schemas["RatePreviewRequestDto"]>(request);
    if (!input.kind || !input.splitBy) return validation(op, input.kind ? "splitBy" : "kind", "required");
    const preview = ratePreview(budget, input);
    return preview instanceof Response ? preview : json(preview);
  }),
  http.post("*/v1/owner/juristic/budgets/:budgetId/actions/create-rate-plan-draft", async ({ request, params }) => {
    const op = "owner.juristicBudgets.createRateDraft";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const budget = ok.tenantId === JURISTIC_TENANT ? j().budgets.find((b) => b.id === params.budgetId) : undefined;
    if (!budget) return problem(op, "http.not_found");
    if (!can(ok, "juristic.budget.manage")) return problem(op, "auth.forbidden");
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["RateDraftCreateDto"];
      if (!input.effectiveFrom || input.effectiveFrom < date()) return problem(op, "rate_plan.backdated");
      if (budget.state !== "approved" || !budget.resolutionId)
        return problem(op, "rate_plan.resolution_required", {
          detail: "อนุมัติงบประมาณด้วยมติที่ประชุมก่อน แล้วจึงสร้างอัตราจากงบนี้",
        });
      const preview = ratePreview(budget, input);
      if (preview instanceof Response) return preview;
      if (preview.missingUnitIds.length) return validation(op, "splitBy", "some units lack the weight");
      let plan = j().ratePlans.find(
        (candidate) =>
          candidate.buildingId === budget.buildingId && candidate.kind === input.kind && candidate.isDefault,
      );
      if (!plan) {
        plan = {
          id: crypto.randomUUID(),
          buildingId: budget.buildingId,
          kind: input.kind,
          name: input.planName ?? budget.name,
          isDefault: true,
          frequency: preview.frequency,
          version: 1,
          versions: [],
        };
        j().ratePlans.push(plan);
      }
      plan.versions.unshift({
        id: crypto.randomUUID(),
        basis: "budget_split",
        tiers: { kind: "budget", amount: preview.annualAmount, period: "year", splitBy: input.splitBy },
        minimumCharge: null,
        note: budget.name,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        inForce: false,
        aboveCap: false,
        capCheck: null,
        complianceAcknowledgementId: null,
        resolutionId: budget.resolutionId,
      });
      plan.version += 1;
      return {
        status: 200,
        body: { plan, preview: { ...preview, ratePlanId: plan.id } } satisfies Schemas["RateDraftDto"],
      };
    });
  }),
  http.get("*/v1/owner/juristic/budgets/:budgetId/actual-income", ({ request, params }) => {
    const op = "owner.juristicBudgets.actualIncome";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const budget = ok.tenantId === JURISTIC_TENANT ? j().budgets.find((b) => b.id === params.budgetId) : undefined;
    if (!budget) return problem(op, "http.not_found");
    return json({
      budgetId: budget.id,
      buildingId: budget.buildingId,
      fiscalYear: budget.fiscalYear,
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
      asOf: date(),
      budgetedIncome: budget.incomeTotal,
      incomeLines: budget.lines.filter((row) => row.kind === "income").map(({ label, amount }) => ({ label, amount })),
      // Two of the year's quarters billed so far, most of it collected (figures as the API would sum them).
      billed: share(budget.incomeTotal, 0.5),
      billedByKind: [
        { kind: "common_fee", amount: share(budget.incomeTotal, 0.45) },
        { kind: "fund", amount: share(budget.incomeTotal, 0.04) },
        { kind: "surcharge", amount: share(budget.incomeTotal, 0.01) },
      ],
      collected: share(budget.incomeTotal, 0.43),
      billedVsBudgetPct: "50.00",
      collectedVsBilledPct: "86.00",
      // Answered with the expense side by owner/accounting.ts for the juristic tenant (J2.1).
      expenseSideAvailable: false,
      budgetedExpense: "0.00",
      actualExpense: "0.00",
      expenseLines: [],
    } satisfies Schemas["BudgetActualIncomeDto"]);
  }),

  // ── Read-only figures of the overview and the reports page (J1.2b; lists in owner/collections.ts) ────────────────────────────────────────────────────────
  http.get("*/v1/owner/juristic/reports/aging", ({ request }) => {
    const op = "owner.juristicReports.aging";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const bucket = (key: string, fromDays: number, toDays: number | null, accounts: number, amount: string) => ({
      key,
      fromDays,
      toDays,
      accounts,
      invoices: accounts + 2,
      amount,
    });
    const juristic = ok.tenantId === JURISTIC_TENANT;
    const buckets = juristic
      ? [
          bucket("0-30", 0, 30, 18, "248400.00"),
          bucket("31-90", 31, 90, 11, "312800.00"),
          bucket("91-365", 91, 365, 8, "284520.00"),
          bucket("365+", 366, null, 4, "298600.00"),
        ]
      : [];
    const overall = {
      notDue: { accounts: juristic ? 120 : 0, invoices: juristic ? 120 : 0, amount: juristic ? "742500.00" : "0.00" },
      buckets,
      overdue: { accounts: juristic ? 41 : 0, invoices: juristic ? 49 : 0, amount: juristic ? "1144320.00" : "0.00" },
    };
    const building = (buildingId: string, name: string, counts: [number, string][], notDue: [number, string]) => ({
      buildingId,
      name,
      buckets: counts.map(([accounts, amount], index) =>
        bucket(buckets[index]!.key, buckets[index]!.fromDays, buckets[index]!.toDays, accounts, amount),
      ),
      notDue: { accounts: notDue[0], invoices: notDue[0], amount: notDue[1] },
      overdue: {
        accounts: counts.reduce((total, [accounts]) => total + accounts, 0),
        invoices: counts.reduce((total, [accounts]) => total + accounts + 1, 0),
        amount: (counts.reduce((total, [, amount]) => total + Math.round(Number(amount) * 100), 0) / 100).toFixed(2),
      },
    });
    const buildings = juristic
      ? [
          building(
            J.buildingA,
            "อาคาร A",
            [
              [14, "201600.00"],
              [9, "268300.00"],
              [7, "262020.00"],
              [4, "298600.00"],
            ],
            [96, "601200.00"],
          ),
          building(
            J.soi1,
            "ซอย 1",
            [
              [3, "34300.00"],
              [2, "44500.00"],
              [1, "22500.00"],
              [0, "0.00"],
            ],
            [16, "92100.00"],
          ),
          building(
            J.soi2,
            "ซอย 2",
            [
              [1, "12500.00"],
              [0, "0.00"],
              [0, "0.00"],
              [0, "0.00"],
            ],
            [8, "49200.00"],
          ),
        ]
      : [];
    return json({ asOf: date(), bounds: [30, 90, 365], overall, buildings } satisfies Schemas["JuristicAgingDto"]);
  }),
  http.get("*/v1/owner/juristic/reports/collection-rate", ({ request }) => {
    const op = "owner.juristicReports.collectionRate";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const juristic = ok.tenantId === JURISTIC_TENANT;
    return json({
      from: date(-365),
      to: date(),
      kpiDays: 30,
      cycles: juristic
        ? [
            [
              "2026-Q4",
              "quarterly",
              "2026-10-01",
              J.condo,
              15,
              "296250.00",
              "214780.00",
              "190110.00",
              "72.50",
              "64.17",
            ],
            [
              "2026-Q3",
              "quarterly",
              "2026-07-01",
              J.condo,
              16,
              "296250.00",
              "281430.00",
              "259120.00",
              "95.00",
              "87.47",
            ],
            [
              "2026-Q2",
              "quarterly",
              "2026-04-01",
              J.condo,
              16,
              "296250.00",
              "290120.00",
              "268850.00",
              "97.93",
              "90.75",
            ],
            [
              "2026-H2",
              "semiannual",
              "2026-07-01",
              J.village,
              10,
              "186000.00",
              "171120.00",
              "158200.00",
              "92.00",
              "85.05",
            ],
            [
              "2026-H1",
              "semiannual",
              "2026-01-01",
              J.village,
              10,
              "186000.00",
              "183210.00",
              "176700.00",
              "98.50",
              "95.00",
            ],
          ].map(
            ([periodKey, frequency, periodStart, propertyId, invoices, billed, collected, within, rate, kpi], i) => ({
              billingCycleId: jid("c7c1a001", 10 + i),
              periodKey: periodKey as string,
              frequency: frequency as string,
              periodStart: periodStart as string,
              propertyId: propertyId as string,
              invoices: invoices as number,
              billed: billed as string,
              collected: collected as string,
              collectedWithinDays: within as string,
              collectionRatePct: rate as string,
              withinDaysRatePct: kpi as string,
            }),
          )
        : [],
      total: {
        billed: juristic ? "8412600.00" : "0.00",
        collected: juristic ? "7268280.00" : "0.00",
        collectedWithinDays: juristic ? "6911000.00" : "0.00",
        collectionRatePct: juristic ? "86.40" : null,
        withinDaysRatePct: juristic ? "82.15" : null,
        invoices: juristic ? 312 : 0,
      },
    } as Schemas["CollectionRateDto"]);
  }),
];

export function resetJuristicWorld(): void {
  state.juristic = initialJuristicWorld();
}

export function juristicStateHandlers(): HttpHandler[] {
  return [
    http.post("*/__mock/owner/juristic/reset", () => {
      resetJuristicWorld();
      return json({ ok: true });
    }),
    http.get("*/__mock/owner/juristic", () => json(state.juristic)),
  ];
}
