import type { components } from "../../src/lib/api/schema";
import { BUILDING_A, BUILDING_B, FLOORS, UNITS } from "../staff-world";
import { id, iso, day, PARTY } from "../owner/world";

type Schemas = components["schemas"];

/**
 * The R2 world of the mock API (F2 2.7, F4 4.4; api B5.1–B5.4): service categories, service requests and
 * their work orders, maintenance plans, locks with credentials and unlock events, announcements with read
 * receipts, parcels, facilities and bookings, building rules and contacts. One world for the owner and
 * the staff surfaces — the owner assigns a work order, the staff PWA completes it, the owner verifies.
 * Units, buildings and members are the owner / staff / platform worlds' (same ids).
 */

const HOUR = 3_600_000;
export const hours = (offset: number) => new Date(Date.now() + offset * HOUR).toISOString();

export const STAFF_USER = { id: "3b241101-e2bb-4255-8caf-4136c566a904", name: "Somsak Staff" } as const;
export const OWNER_USER = { id: "3b241101-e2bb-4255-8caf-4136c566a901", name: "สมชาย เจ้าของหอ" } as const;
export const TECHNICIAN = { id: PARTY.company, name: "บริษัท ตัวอย่างการค้า จำกัด" } as const;

export const R2 = {
  sr: {
    leakA201: id("5e700000", 1),
    powerA202: id("5e700000", 2),
    autoMeter: id("5e700000", 3),
    doneA302: id("5e700000", 4),
    closedOld: id("5e700000", 5),
  },
  wo: {
    powerA202: id("70000000", 1),
    preventive: id("70000000", 2),
    doneA302: id("70000000", 3),
  },
  plan: { doorLock: id("9a1a0000", 1), aircon: id("9a1a0000", 2) },
  lock: { a201: id("10c00000", 1), door: id("10c00000", 2), b101: id("10c00000", 3) },
  lockAsset: { a201: id("a1100000", 1), door: id("a1100000", 2), b101: id("a1100000", 3) },
  credential: {
    resident: id("c4ed0000", 1),
    staffWo: id("c4ed0000", 2),
    visitorOld: id("c4ed0000", 3),
    failed: id("c4ed0000", 4),
    doorResident: id("c4ed0000", 5),
  },
  announcement: { water: id("a7700000", 1), draft: id("a7700000", 2), old: id("a7700000", 3) },
  parcel: { waiting: id("9a4c0000", 1), notified: id("9a4c0000", 2), picked: id("9a4c0000", 3) },
  facility: { meeting: id("fac10000", 1), fitness: id("fac10000", 2) },
  booking: { requested: id("b00c0000", 1), confirmed: id("b00c0000", 2), past: id("b00c0000", 3) },
  rule: { v1: id("70100000", 1), v2: id("70100000", 2) },
  contact: { police: id("c0170000", 1), manager: id("c0170000", 2), plumber: id("c0170000", 3) },
  amenity: { airconA201: id("a1200000", 1) },
  photo: {
    leak: id("d0c00000", 71),
    before: id("d0c00000", 72),
    after: id("d0c00000", 73),
    parcel: id("d0c00000", 74),
  },
} as const;

/** The pick-up PIN of a parcel (shown in the resident's app only; the mock keeps it to check a hand-over). */
export const PARCEL_PIN = "482913";

export const CATEGORY_DEFAULTS: { key: string; nameTh: string; nameEn: string; slaHours: number }[] = [
  { key: "electrical", nameTh: "ไฟฟ้า", nameEn: "Electrical", slaHours: 24 },
  { key: "plumbing", nameTh: "ประปา", nameEn: "Plumbing", slaHours: 24 },
  { key: "aircon", nameTh: "เครื่องปรับอากาศ", nameEn: "Air conditioning", slaHours: 48 },
  { key: "appliance", nameTh: "เครื่องใช้ไฟฟ้า", nameEn: "Appliance", slaHours: 72 },
  { key: "structure", nameTh: "โครงสร้าง ประตู หน้าต่าง", nameEn: "Structure", slaHours: 120 },
  { key: "pest", nameTh: "แมลงและสัตว์รบกวน", nameEn: "Pest control", slaHours: 72 },
  { key: "cleaning", nameTh: "ทำความสะอาด", nameEn: "Cleaning", slaHours: 48 },
  { key: "other", nameTh: "อื่น ๆ", nameEn: "Other", slaHours: 72 },
];

export const categoryId = (key: string) => id("ca7e0000", CATEGORY_DEFAULTS.findIndex((c) => c.key === key) + 1);

export type MockRequest = Schemas["ServiceRequestDto"] & {
  timeline: Schemas["ServiceTimelineEntryDto"][];
};

export type MockWorkOrder = Omit<Schemas["WorkOrderDto"], "nextActions"> & {
  /** Codes issued to the assignee for the visit (D-211), revealed by `…/access`. */
  access: Schemas["RevealedCredentialDto"][];
  /** Waiting for parts (the request's `waiting_parts`); `wait-parts` / `resume` toggle it. */
  waitingParts: boolean;
};

export type MockLock = Schemas["LockDto"] & {
  credentials: Schemas["CredentialDto"][];
  events: Schemas["AccessEventDto"][];
};

export interface R2World {
  categories: Schemas["ServiceCategoryDto"][];
  requests: MockRequest[];
  workOrders: MockWorkOrder[];
  plans: Schemas["MaintenancePlanDto"][];
  locks: MockLock[];
  announcements: Schemas["AnnouncementDto"][];
  reads: Record<string, Schemas["AnnouncementReadDto"][]>;
  parcels: Schemas["ParcelDto"][];
  pins: Record<string, string>;
  facilities: Schemas["FacilityDto"][];
  bookings: Schemas["BookingDto"][];
  rules: Schemas["BuildingRuleDto"][];
  acks: Record<string, Schemas["RuleAckDto"][]>;
  contacts: Schemas["ContactDto"][];
  amenities: Schemas["AmenityDto"][];
  replies: Map<string, { status: number; body: unknown; fingerprint: string }>;
  received: { op: string; idempotencyKey: string | null; body: unknown }[];
}

function categories(): Schemas["ServiceCategoryDto"][] {
  return CATEGORY_DEFAULTS.map((category, index) => ({
    id: categoryId(category.key),
    key: category.key,
    nameTh: category.nameTh,
    nameEn: category.nameEn,
    // The sample tenant answers air conditioning faster than the platform default (a tenant override).
    slaHours: category.key === "aircon" ? 24 : category.slaHours,
    sortOrder: index + 1,
    isActive: true,
    source: category.key === "aircon" ? "tenant" : "platform",
  }));
}

export function categoryRef(categoryIdValue: string, list: Schemas["ServiceCategoryDto"][]) {
  const category = list.find((candidate) => candidate.id === categoryIdValue) ?? list[0]!;
  return { id: category.id, key: category.key, nameTh: category.nameTh, nameEn: category.nameEn };
}

function request(
  list: Schemas["ServiceCategoryDto"][],
  partial: Pick<MockRequest, "id" | "ref" | "status" | "description"> &
    Partial<Omit<MockRequest, "category">> & { category: string },
): MockRequest {
  const { category, ...rest } = partial;
  return {
    assetItemId: null,
    autoReason: null,
    buildingId: BUILDING_A,
    cancelReason: null,
    cancelledAt: null,
    closedAt: null,
    createdAt: hours(-3),
    doneAt: null,
    inWarranty: false,
    nextActions: [],
    photoIds: [],
    priority: "normal",
    rating: null,
    ratingComment: null,
    reporterKind: "resident",
    requesterName: null,
    requesterPartyId: null,
    slaBreached: false,
    slaDueAt: null,
    slaHours: list.find((candidate) => candidate.key === category)?.slaHours ?? 72,
    triagedAt: null,
    unitId: null,
    unitNo: null,
    version: 1,
    warrantyResolution: null,
    workOrders: [],
    timeline: [],
    ...rest,
    category: categoryRef(categoryId(category), list),
  };
}

function workOrder(partial: Pick<MockWorkOrder, "id" | "title" | "status" | "kind"> & Partial<MockWorkOrder>) {
  const base: MockWorkOrder = {
    acceptedAt: null,
    afterPhotoIds: [],
    assetItemId: null,
    assignedAt: null,
    assignee: null,
    beforePhotoIds: [],
    buildingId: BUILDING_A,
    cancelReason: null,
    cancelledAt: null,
    checkedInAt: null,
    completedAt: null,
    completionNote: null,
    costLines: [],
    costTotal: "0.00",
    createdAt: hours(-2),
    description: null,
    maintenancePlanId: null,
    priority: "normal",
    scheduledAt: null,
    scheduledUntil: null,
    serviceRequestId: null,
    unitId: null,
    unitNo: null,
    verifiedAt: null,
    version: 1,
    access: [],
    waitingParts: false,
    ...partial,
  };
  return base;
}

function credential(
  partial: Pick<Schemas["CredentialDto"], "id" | "lockId" | "lockName"> & Partial<Schemas["CredentialDto"]>,
) {
  return {
    createdAt: iso(-30),
    holderKind: "resident",
    holderName: "",
    holderPartyId: null,
    holderUserId: null,
    leaseId: null,
    revokeReason: null,
    revokedAt: null,
    status: "active",
    type: "pin",
    unitId: null,
    unitNo: null,
    validFrom: iso(-30),
    validTo: null,
    vendorError: null,
    workOrderId: null,
    ...partial,
  } satisfies Schemas["CredentialDto"];
}

function lock(partial: Pick<MockLock, "id" | "name" | "scope" | "assetItemId"> & Partial<MockLock>): MockLock {
  return {
    batteryCheckedAt: hours(-1),
    batteryLow: false,
    batteryPct: 82,
    buildingId: BUILDING_A,
    deviceId: id("de510000", Number(partial.id.slice(-2))),
    isActive: true,
    lastLogSyncAt: hours(-1),
    online: true,
    serial: `TT-${partial.id.slice(-4)}`,
    unitId: null,
    unitNo: null,
    vendor: "ttlock",
    vendorLockId: `vendor-${partial.id.slice(-4)}`,
    version: 1,
    credentials: [],
    events: [],
    ...partial,
  };
}

function event(lockId: string, n: number, partial: Partial<Schemas["AccessEventDto"]>): Schemas["AccessEventDto"] {
  return {
    id: id("e7e00000", Number(lockId.slice(-2)) * 100 + n),
    lockId,
    time: hours(-n * 5),
    result: "success",
    source: "pin",
    credentialId: null,
    unitId: null,
    ...partial,
  };
}

export function initialR2World(): R2World {
  const list = categories();
  const unitA201 = UNITS.a201;
  const unitA202 = UNITS.a202;
  const unitA301 = UNITS.a301;

  const requests: MockRequest[] = [
    request(list, {
      id: R2.sr.leakA201,
      ref: "SR-2610-0001",
      status: "new",
      category: "plumbing",
      description: "ก๊อกน้ำอ่างล้างหน้ารั่ว น้ำหยดตลอดเวลา",
      unitId: unitA201.id,
      unitNo: unitA201.no,
      requesterName: "สมศักดิ์ ใจดี",
      requesterPartyId: PARTY.somsak,
      createdAt: hours(-4),
      slaDueAt: hours(20),
      photoIds: [R2.photo.leak],
      nextActions: ["triage", "create-work-order", "cancel"],
      timeline: [{ at: hours(-4), event: "reported", from: null, to: "new" }],
    }),
    request(list, {
      id: R2.sr.powerA202,
      ref: "SR-2610-0002",
      status: "assigned",
      category: "electrical",
      priority: "high",
      description: "ปลั๊กไฟข้างเตียงไม่มีไฟ",
      unitId: unitA202.id,
      unitNo: unitA202.no,
      requesterName: "มาลี ศรีสุข",
      requesterPartyId: PARTY.malee,
      createdAt: hours(-30),
      triagedAt: hours(-29),
      slaDueAt: hours(-6),
      slaBreached: true,
      nextActions: ["triage", "create-work-order", "cancel"],
      workOrders: [],
      timeline: [
        { at: hours(-30), event: "reported", from: null, to: "new" },
        { at: hours(-29), event: "triage", from: "new", to: "triaged" },
        { at: hours(-28), event: "assign", from: "triaged", to: "assigned" },
        { at: hours(-8), event: "sla.warning", from: null, to: "assigned" },
        { at: hours(-6), event: "sla.breached", from: null, to: "assigned" },
      ],
    }),
    request(list, {
      id: R2.sr.autoMeter,
      ref: "SR-2610-0003",
      status: "new",
      category: "electrical",
      description: "มิเตอร์ไม่ส่งข้อมูลตามกำหนด",
      reporterKind: "system",
      autoReason: "meter_stale",
      assetItemId: id("a1000000", 90),
      createdAt: hours(-23),
      slaDueAt: hours(1),
      nextActions: ["triage", "create-work-order", "cancel"],
      timeline: [{ at: hours(-23), event: "reported", from: null, to: "new" }],
    }),
    request(list, {
      id: R2.sr.doneA302,
      ref: "SR-2610-0004",
      status: "done",
      category: "aircon",
      description: "แอร์ไม่เย็น มีน้ำหยด",
      unitId: id("6d9f0000", 302),
      unitNo: "A-302",
      requesterName: "อนันต์ พากเพียร",
      requesterPartyId: PARTY.anan,
      createdAt: hours(-50),
      triagedAt: hours(-49),
      doneAt: hours(-2),
      slaDueAt: null,
      nextActions: ["close", "cancel", "rate"],
      timeline: [
        { at: hours(-50), event: "reported", from: null, to: "new" },
        { at: hours(-49), event: "triage", from: "new", to: "triaged" },
        { at: hours(-48), event: "assign", from: "triaged", to: "assigned" },
        { at: hours(-5), event: "start", from: "assigned", to: "in_progress" },
        { at: hours(-2), event: "complete", from: "in_progress", to: "done" },
      ],
    }),
    request(list, {
      id: R2.sr.closedOld,
      ref: "SR-2609-0031",
      status: "closed",
      category: "cleaning",
      description: "ท่อระบายน้ำระเบียงตัน",
      unitId: unitA301.id,
      unitNo: unitA301.no,
      createdAt: iso(-20),
      closedAt: iso(-18),
      rating: 5,
      nextActions: ["reopen"],
      timeline: [
        { at: iso(-20), event: "reported", from: null, to: "new" },
        { at: iso(-18), event: "close", from: "done", to: "closed" },
      ],
    }),
  ];

  const workOrders: MockWorkOrder[] = [
    workOrder({
      id: R2.wo.powerA202,
      title: "ตรวจปลั๊กไฟข้างเตียง A-202",
      status: "assigned",
      kind: "repair",
      priority: "high",
      serviceRequestId: R2.sr.powerA202,
      unitId: unitA202.id,
      unitNo: unitA202.no,
      assignee: { id: STAFF_USER.id, type: "user", displayName: STAFF_USER.name },
      assignedAt: hours(-28),
      scheduledAt: hours(1),
      scheduledUntil: hours(5),
      description: "ปลั๊กไฟข้างเตียงไม่มีไฟ ตรวจเบรกเกอร์และสายไฟ",
      access: [],
    }),
    workOrder({
      id: R2.wo.preventive,
      title: "ตรวจสภาพกลอนประตูหลัก (ทุก 90 วัน)",
      status: "open",
      kind: "preventive",
      assetItemId: R2.lockAsset.door,
      maintenancePlanId: R2.plan.doorLock,
      scheduledAt: hours(72),
    }),
    workOrder({
      id: R2.wo.doneA302,
      title: "ล้างแอร์และเติมน้ำยา A-302",
      status: "done",
      kind: "repair",
      serviceRequestId: R2.sr.doneA302,
      unitId: id("6d9f0000", 302),
      unitNo: "A-302",
      assignee: { id: TECHNICIAN.id, type: "party", displayName: TECHNICIAN.name },
      assignedAt: hours(-48),
      acceptedAt: hours(-47),
      checkedInAt: hours(-5),
      completedAt: hours(-2),
      completionNote: "ล้างคอยล์เย็น เติมน้ำยา R32 ทดสอบแล้วเย็นปกติ",
      beforePhotoIds: [R2.photo.before],
      afterPhotoIds: [R2.photo.after],
      costLines: [
        {
          id: id("c0570000", 1),
          kind: "labour",
          description: "ค่าแรงล้างแอร์",
          quantity: "1",
          unitPrice: "600.00",
          amount: "600.00",
          receiptDocumentId: null,
          vendorPartyId: null,
        },
        {
          id: id("c0570000", 2),
          kind: "part",
          description: "น้ำยา R32",
          quantity: "1",
          unitPrice: "450.00",
          amount: "450.00",
          receiptDocumentId: null,
          vendorPartyId: null,
        },
      ],
      costTotal: "1050.00",
    }),
  ];
  // The request shows its work orders (summary).
  for (const wo of workOrders) {
    const sr = requests.find((candidate) => candidate.id === wo.serviceRequestId);
    if (sr) sr.workOrders.push(summaryOf(wo));
  }

  const lockA201 = lock({
    id: R2.lock.a201,
    assetItemId: R2.lockAsset.a201,
    name: "กลอนห้อง A-201",
    scope: "unit",
    unitId: unitA201.id,
    unitNo: unitA201.no,
  });
  lockA201.credentials = [
    credential({
      id: R2.credential.resident,
      lockId: lockA201.id,
      lockName: lockA201.name,
      holderKind: "resident",
      holderName: "สมศักดิ์ ใจดี",
      holderPartyId: PARTY.somsak,
      leaseId: id("1ea50000", 1),
      unitId: unitA201.id,
      unitNo: unitA201.no,
      validFrom: iso(-350),
    }),
    credential({
      id: R2.credential.visitorOld,
      lockId: lockA201.id,
      lockName: lockA201.name,
      holderKind: "visitor",
      holderName: "ช่างแอร์ (ผู้มาติดต่อ)",
      status: "expired",
      validFrom: iso(-12),
      validTo: iso(-11),
    }),
    credential({
      id: R2.credential.failed,
      lockId: lockA201.id,
      lockName: lockA201.name,
      holderKind: "visitor",
      holderName: "ญาติผู้เช่า",
      status: "failed",
      vendorError: "TTLock: gateway offline (code -3008)",
      validFrom: iso(-1),
      validTo: iso(2),
    }),
  ];
  lockA201.events = [
    event(lockA201.id, 1, { credentialId: R2.credential.resident, unitId: unitA201.id }),
    event(lockA201.id, 2, { result: "denied", source: "pin" }),
    event(lockA201.id, 3, { source: "app", credentialId: R2.credential.resident, unitId: unitA201.id }),
  ];
  const door = lock({
    id: R2.lock.door,
    assetItemId: R2.lockAsset.door,
    name: "ประตูทางเข้าอาคาร A",
    scope: "building_door",
    batteryPct: 15,
    batteryLow: true,
    vendor: "tuya",
  });
  door.credentials = [
    credential({
      id: R2.credential.doorResident,
      lockId: door.id,
      lockName: door.name,
      holderKind: "resident",
      holderName: "สมศักดิ์ ใจดี",
      holderPartyId: PARTY.somsak,
      leaseId: id("1ea50000", 1),
      unitId: unitA201.id,
      unitNo: unitA201.no,
      validFrom: iso(-350),
    }),
    credential({
      id: R2.credential.staffWo,
      lockId: door.id,
      lockName: door.name,
      holderKind: "staff",
      holderName: STAFF_USER.name,
      holderUserId: STAFF_USER.id,
      workOrderId: R2.wo.powerA202,
      validFrom: hours(1),
      validTo: hours(5),
    }),
  ];
  door.events = [event(door.id, 1, {}), event(door.id, 2, { source: "card" })];
  const b101 = lock({
    id: R2.lock.b101,
    assetItemId: R2.lockAsset.b101,
    name: "กลอนห้อง B-101",
    scope: "unit",
    buildingId: BUILDING_B,
    unitId: UNITS.b101.id,
    unitNo: UNITS.b101.no,
    online: false,
  });
  // The staff code of the assigned work order, revealed to its assignee (D-211).
  workOrders[0]!.access = [{ ...door.credentials[1]!, pin: "730215" }];

  const announcements: Schemas["AnnouncementDto"][] = [
    {
      id: R2.announcement.water,
      buildingId: BUILDING_A,
      title: "งดจ่ายน้ำชั่วคราว วันเสาร์นี้",
      bodyTh: "การประปาจะซ่อมท่อเมนหน้าอาคาร งดจ่ายน้ำวันเสาร์ 09:00–12:00 น. โปรดสำรองน้ำไว้ใช้",
      translations: {
        en: {
          title: "Water off this Saturday",
          body: "The water authority repairs the main pipe: no water 09:00–12:00.",
        },
      },
      audienceFilter: {},
      pinned: true,
      publishedAt: iso(-1),
      expiresAt: iso(5),
      archivedAt: null,
      createdAt: iso(-1),
      readCount: 2,
      version: 2,
    },
    {
      id: R2.announcement.draft,
      buildingId: BUILDING_A,
      title: "ทำความสะอาดถังเก็บน้ำ",
      bodyTh: "ทำความสะอาดถังเก็บน้ำบนดาดฟ้า ชั้น 3 อาจมีเสียงดังช่วงบ่าย",
      translations: {},
      audienceFilter: { floorIds: [FLOORS.a3.floorId] },
      pinned: false,
      publishedAt: null,
      expiresAt: null,
      archivedAt: null,
      createdAt: hours(-5),
      readCount: 0,
      version: 1,
    },
    {
      id: R2.announcement.old,
      buildingId: null,
      title: "วันหยุดสำนักงานช่วงสงกรานต์",
      bodyTh: "สำนักงานปิด 13–15 เมษายน ติดต่อเหตุฉุกเฉินที่เบอร์ผู้ดูแลอาคาร",
      translations: {},
      audienceFilter: {},
      pinned: false,
      publishedAt: iso(-190),
      expiresAt: null,
      archivedAt: iso(-170),
      createdAt: iso(-190),
      readCount: 5,
      version: 3,
    },
  ];

  const parcels: Schemas["ParcelDto"][] = [
    {
      id: R2.parcel.waiting,
      buildingId: BUILDING_A,
      unitId: unitA201.id,
      unitNo: unitA201.no,
      recipientPartyId: PARTY.somsak,
      carrier: "Kerry",
      trackingNo: "KER123456789TH",
      notes: null,
      photoDocumentId: R2.photo.parcel,
      status: "notified",
      receivedAt: hours(-6),
      notifiedAt: hours(-6),
      pickedUpAt: null,
      pickupConfirmedBy: null,
      returnedAt: null,
      returnReason: null,
    },
    {
      id: R2.parcel.notified,
      buildingId: BUILDING_A,
      unitId: unitA202.id,
      unitNo: unitA202.no,
      recipientPartyId: null,
      carrier: "ไปรษณีย์ไทย",
      trackingNo: "EF582934716TH",
      notes: "กล่องใหญ่ วางหลังเคาน์เตอร์",
      photoDocumentId: R2.photo.parcel,
      status: "notified",
      receivedAt: hours(-26),
      notifiedAt: hours(-26),
      pickedUpAt: null,
      pickupConfirmedBy: null,
      returnedAt: null,
      returnReason: null,
    },
    {
      id: R2.parcel.picked,
      buildingId: BUILDING_A,
      unitId: unitA301.id,
      unitNo: unitA301.no,
      recipientPartyId: null,
      carrier: "Flash",
      trackingNo: null,
      notes: null,
      photoDocumentId: R2.photo.parcel,
      status: "picked_up",
      receivedAt: iso(-3),
      notifiedAt: iso(-3),
      pickedUpAt: iso(-2),
      pickupConfirmedBy: "resident_pin",
      returnedAt: null,
      returnReason: null,
    },
  ];

  const policy = (requiresApproval: boolean): Schemas["BookingPolicyDto"] => ({
    slotMinutes: 60,
    openFrom: "08:00",
    openTo: "22:00",
    maxDurationMinutes: 120,
    maxAdvanceDays: 14,
    maxPerUnitPerWeek: 2,
    requiresApproval,
  });
  const slot = (dayOffset: number, hour: number, length = 1) => {
    const date = day(dayOffset);
    return {
      startsAt: new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+07:00`).toISOString(),
      endsAt: new Date(`${date}T${String(hour + length).padStart(2, "0")}:00:00+07:00`).toISOString(),
    };
  };

  return {
    categories: list,
    requests,
    workOrders,
    plans: [
      {
        id: R2.plan.doorLock,
        assetItemId: R2.lockAsset.door,
        assetItemName: "ประตูทางเข้าอาคาร A",
        buildingId: BUILDING_A,
        title: "ตรวจสภาพกลอนประตูหลัก",
        description: "ทดสอบแบตเตอรี่ ล็อก และบานพับ",
        intervalDays: 90,
        leadDays: 7,
        nextDueOn: day(3),
        isActive: true,
        categoryId: categoryId("structure"),
        assigneeUserId: STAFF_USER.id,
        assigneePartyId: null,
        lastWorkOrderId: R2.wo.preventive,
        version: 1,
      },
      {
        id: R2.plan.aircon,
        assetItemId: R2.amenity.airconA201,
        assetItemName: "แอร์ห้อง A-201",
        buildingId: BUILDING_A,
        title: "ล้างแอร์ประจำปี",
        description: null,
        intervalDays: 180,
        leadDays: 14,
        nextDueOn: day(-2),
        isActive: true,
        categoryId: categoryId("aircon"),
        assigneeUserId: null,
        assigneePartyId: TECHNICIAN.id,
        lastWorkOrderId: null,
        version: 1,
      },
    ],
    locks: [lockA201, door, b101],
    announcements,
    reads: {
      [R2.announcement.water]: [
        { partyId: PARTY.somsak, name: "สมศักดิ์ ใจดี", readAt: hours(-20) },
        { partyId: PARTY.anan, name: "อนันต์ พากเพียร", readAt: hours(-10) },
      ],
    },
    parcels,
    pins: { [R2.parcel.waiting]: PARCEL_PIN, [R2.parcel.notified]: "119044" },
    facilities: [
      {
        id: R2.facility.meeting,
        buildingId: BUILDING_A,
        name: "ห้องประชุมชั้น 1",
        kind: "meeting_room",
        capacity: 8,
        isActive: true,
        bookingPolicy: policy(true),
      },
      {
        id: R2.facility.fitness,
        buildingId: BUILDING_A,
        name: "ฟิตเนส",
        kind: "fitness",
        capacity: 6,
        isActive: true,
        bookingPolicy: policy(false),
      },
    ],
    bookings: [
      {
        id: R2.booking.requested,
        facilityId: R2.facility.meeting,
        facilityName: "ห้องประชุมชั้น 1",
        unitId: unitA201.id,
        unitNo: unitA201.no,
        ...slot(1, 10, 2),
        status: "requested",
        note: "ประชุมกลุ่มเรียน",
        cancelReason: null,
      },
      {
        id: R2.booking.confirmed,
        facilityId: R2.facility.meeting,
        facilityName: "ห้องประชุมชั้น 1",
        unitId: unitA202.id,
        unitNo: unitA202.no,
        ...slot(0, 18),
        status: "confirmed",
        note: null,
        cancelReason: null,
      },
      {
        id: R2.booking.past,
        facilityId: R2.facility.meeting,
        facilityName: "ห้องประชุมชั้น 1",
        unitId: unitA301.id,
        unitNo: unitA301.no,
        ...slot(-1, 9),
        status: "confirmed",
        note: null,
        cancelReason: null,
      },
    ],
    rules: [
      {
        id: R2.rule.v1,
        buildingId: BUILDING_A,
        version: 1,
        title: "ระเบียบการอยู่อาศัย อาคาร A",
        bodyTh: "1. งดส่งเสียงดังหลัง 22:00 น.\n2. ห้ามสูบบุหรี่ในอาคาร\n3. ทิ้งขยะตามจุดที่กำหนด",
        translations: {},
        effectiveFrom: day(-200),
        publishedAt: iso(-200),
        acknowledgements: 2,
      },
    ],
    acks: {
      [R2.rule.v1]: [
        { partyId: PARTY.somsak, name: "สมศักดิ์ ใจดี", leaseId: id("1ea50000", 1), ackedAt: iso(-199) },
        { partyId: PARTY.anan, name: "อนันต์ พากเพียร", leaseId: null, ackedAt: iso(-100) },
      ],
    },
    contacts: [
      {
        id: R2.contact.police,
        buildingId: null,
        kind: "emergency",
        name: "เหตุด่วนเหตุร้าย",
        phone: "191",
        lineId: null,
        notes: null,
        sortOrder: 1,
      },
      {
        id: R2.contact.manager,
        buildingId: BUILDING_A,
        kind: "building",
        name: "ผู้ดูแลอาคาร A",
        phone: "+66810000004",
        lineId: "@sample-a",
        notes: "08:00–20:00 ทุกวัน",
        sortOrder: 2,
      },
      {
        id: R2.contact.plumber,
        buildingId: null,
        kind: "vendor",
        name: "ช่างประปาประจำ",
        phone: "+66890000123",
        lineId: null,
        notes: null,
        sortOrder: 3,
      },
    ],
    amenities: [
      {
        id: R2.amenity.airconA201,
        unitId: unitA201.id,
        category: "hvac",
        name: "แอร์ห้อง A-201",
        manufacturer: "Daikin",
        model: "FTKF12",
        serial: "DK-A201",
        location: "ห้องนอน",
        installDate: day(-700),
        warrantyUntil: day(30),
        status: "active",
      },
    ],
    replies: new Map(),
    received: [],
  };
}

export function summaryOf(wo: MockWorkOrder): Schemas["WorkOrderSummaryDto"] {
  return {
    id: wo.id,
    title: wo.title,
    kind: wo.kind,
    status: wo.status,
    scheduledAt: wo.scheduledAt,
    completedAt: wo.completedAt,
    assigneeUserId: wo.assignee?.type === "user" ? wo.assignee.id : null,
    assigneePartyId: wo.assignee?.type === "party" ? wo.assignee.id : null,
  };
}

export { BUILDING_A, BUILDING_B };
