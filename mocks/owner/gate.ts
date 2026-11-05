import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { authenticate, issueTokens, json, problem } from "../handlers/support";
import { state } from "../state";
import { J, JURISTIC_TENANT, type MockJuristicWorld } from "./juristic";
import { body, mutating, owner, paged, query, record, roleOf, validation } from "./support";

type Schemas = components["schemas"];

/*
 * The gate (JW4; api J4.1 + J4.2 at b3e89b83) for the juristic tenant's housing estate "หมู่บ้านสวนสน":
 * - gate "ป้อม 1 · ทางเข้าหลัก" with an enrolled tablet, a barrier and an LPR camera on the estate's edge gateway,
 *   a second gate "ประตูหลัง" without hardware;
 * - guards สมชาย ใจดี (PIN 1234), วิทยา แสงทอง (PIN 2468) and อนุชา (locked after wrong PINs);
 * - a visitor waiting for house 99/11 (72 s into a 3-minute window), one approved for 99/21, four cars inside (one
 *   past its overstay alert), house policies, a blacklisted plate, a contractor invite waiting for approval, a valid
 *   invite QR (`gpv1.mock-invite-9921`), registered cars.
 * The guard surface signs in with the tablet's device secret (cookie of the web BFF) and a PIN; its SSE stream replays
 * after `Last-Event-ID`. Controls (`gateControl`, see mocks/server.ts): reset, a house answers, an SOS, an LPR read,
 * the barrier state, drop the streams.
 */

const DAY = 86_400_000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const gid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const GATE = {
  main: gid("6a7e0b01", 1),
  back: gid("6a7e0b01", 2),
  tablet: gid("6a7e0b02", 1),
  barrier: gid("6a7e0b02", 2),
  lpr: gid("6a7e0b02", 3),
  edge: gid("6a7e0b03", 1),
  somchai: gid("6a7e0b04", 1),
  wittaya: gid("6a7e0b04", 2),
  anucha: gid("6a7e0b04", 3),
} as const;

/** The enrolled tablet's secret (the web BFF keeps it in its device cookie) and an always-valid enrolment code. */
export const MOCK_DEVICE_SECRET = "mock-device-secret-0001-abcdefghij";
export const MOCK_ENROL_CODE = "GATE-2569";
export const MOCK_INVITE_TOKEN = "gpv1.mock-invite-9921";

type MockGuard = Schemas["GateGuardDto"] & { pin: string; failed: number };

type MockDevice = Schemas["GateDeviceDto"] & { secret: string | null; code: string | null };

type MockVisit = Schemas["GuardVisitDetailDto"] & { propertyId: string };

interface GateEvent {
  id: string;
  type: string;
  ids: Record<string, string>;
}

interface GateStream {
  gateId: string;
  send: (event: GateEvent | { ready: true }) => void;
  close: () => void;
}

export interface MockGateWorld {
  gates: Schemas["GateDto"][];
  devices: MockDevice[];
  guards: MockGuard[];
  /** Open shifts by shift id. */
  shifts: Record<string, { guardId: string; deviceId: string; gateId: string; startedAt: string }>;
  visits: MockVisit[];
  policies: Record<string, Schemas["HousePolicyDto"]>;
  blacklist: Schemas["BlacklistDto"][];
  invites: (Schemas["VisitInviteDto"] & { token: string | null })[];
  vehicles: Schemas["ResidentVehicleDto"][];
  detections: Schemas["PlateDetectionDto"][];
  incidents: Schemas["IncidentDetailDto"][];
  events: GateEvent[];
  received: { op: string; body: unknown; idempotencyKey: string | null }[];
  /** Answers by Idempotency-Key (guard creates). */
  replays: Record<string, unknown>;
}

const PRIVACY: Schemas["PrivacyNoticeDto"] = {
  th: "เก็บป้ายทะเบียน ชื่อ และเลขบัตร 4 ตัวท้ายเพื่อความปลอดภัยของโครงการเท่านั้น",
  en: "Plate, name and the last 4 ID digits are kept for the estate's security only.",
  version: 1,
  retentionDays: 90,
};

function villageUnits() {
  return state.juristic.units.filter((u) => u.dto.propertyId === J.village);
}

function unitById(unitId: string | null | undefined) {
  return villageUnits().find((u) => u.dto.id === unitId) ?? null;
}

function unitByNo(unitNo: string) {
  return villageUnits().find((u) => u.dto.unitNo === unitNo) ?? null;
}

function buildingName(buildingId: string) {
  return state.juristic.buildings.find((b) => b.id === buildingId)?.name ?? "";
}

const DEFAULT_POLICY: Schemas["HousePolicyDto"] = {
  action: "guard_calls",
  custom: false,
  deliverySkipApproval: null,
  householdNote: null,
  timeoutSeconds: 180,
};

function policyOf(unitId: string): Schemas["HousePolicyDto"] {
  return state.gate.policies[unitId] ?? DEFAULT_POLICY;
}

function ownersOf(unitId: string): string[] {
  const parties = state.juristic.parties;
  return state.juristic.ownerships
    .filter((o) => o.unitId === unitId && o.validTo === null)
    .map((o) => parties.find((p) => p.id === o.partyId)?.displayName ?? "");
}

function guardUnit(u: ReturnType<typeof villageUnits>[number]): Schemas["GuardUnitDto"] {
  const lineLinked = state.juristic.ownerships.some(
    (o) => o.unitId === u.dto.id && state.juristic.parties.find((p) => p.id === o.partyId)?.lineLinked,
  );
  return {
    unitId: u.dto.id,
    unitNo: u.dto.unitNo,
    buildingId: u.dto.buildingId,
    buildingName: buildingName(u.dto.buildingId),
    lineLinked,
    policy: policyOf(u.dto.id),
  };
}

function makeVisit(
  n: number,
  input: Partial<MockVisit> & Pick<MockVisit, "kind" | "state" | "createdAt">,
  unit: { dto: { id: string; unitNo: string } } | null,
): MockVisit {
  return {
    id: gid("6a7e0b05", n),
    clientRef: gid("6a7e0b06", n),
    gateId: GATE.main,
    gateName: "ป้อม 1 · ทางเข้าหลัก",
    propertyId: J.village,
    unitId: unit?.dto.id ?? null,
    unitNo: unit?.dto.unitNo ?? null,
    plate: null,
    visitorName: null,
    idLast4: null,
    hasPhoto: false,
    photoUrl: null,
    note: null,
    callMeAt: null,
    callBackName: null,
    cancelledAt: null,
    decidedAt: null,
    decisionReason: null,
    enteredAt: null,
    entryBasis: null,
    exitedAt: null,
    exitedBy: null,
    recordedAt: null,
    respondBy: null,
    timeoutAction: null,
    events: [],
    ...input,
  };
}

const plate = (category: string, number: string, province = "กรุงเทพมหานคร"): Schemas["PlateDto"] => ({
  category,
  number,
  province,
});

export function initialGateWorld(juristic: MockJuristicWorld = state.juristic): MockGateWorld {
  const unitByNo = (unitNo: string) =>
    juristic.units.find((u) => u.dto.propertyId === J.village && u.dto.unitNo === unitNo) ?? null;
  const visit = (
    n: number,
    input: Partial<MockVisit> & Pick<MockVisit, "kind" | "state" | "createdAt">,
    unitNo: string | null,
  ) => makeVisit(n, input, unitNo ? unitByNo(unitNo) : null);
  const gates: Schemas["GateDto"][] = [
    {
      id: GATE.main,
      propertyId: J.village,
      name: "ป้อม 1 · ทางเข้าหลัก",
      kind: "main",
      state: "active",
      barrier: true,
      lpr: true,
      devices: 3,
      createdAt: at(-120 * DAY),
    },
    {
      id: GATE.back,
      propertyId: J.village,
      name: "ประตูหลัง",
      kind: "side",
      state: "active",
      barrier: false,
      lpr: false,
      devices: 0,
      createdAt: at(-120 * DAY),
    },
  ];
  const device = (
    id: string,
    kind: Schemas["GateDeviceKind"],
    name: string,
    extra: Partial<MockDevice> = {},
  ): MockDevice => ({
    id,
    gateId: GATE.main,
    kind,
    name,
    state: "active",
    channel: null,
    edgeDeviceId: null,
    pulseMs: null,
    hwState: null,
    hwStateAt: null,
    enrolExpiresAt: null,
    enrolledAt: at(-100 * DAY),
    lastSeenAt: at(-30_000),
    revokedAt: null,
    secret: null,
    code: null,
    ...extra,
  });
  const devices = [
    device(GATE.tablet, "guard_tablet", "แท็บเล็ตป้อมหน้า", { secret: MOCK_DEVICE_SECRET }),
    device(GATE.barrier, "barrier", "ไม้กั้นขาเข้า", {
      edgeDeviceId: GATE.edge,
      channel: "relay1",
      pulseMs: 800,
      hwState: "closed",
      hwStateAt: at(-120_000),
    }),
    device(GATE.lpr, "lpr", "กล้อง LPR 01", { edgeDeviceId: GATE.edge, channel: "cam1" }),
  ];
  const guard = (id: string, displayName: string, pin: string, extra: Partial<MockGuard> = {}): MockGuard => ({
    id,
    propertyId: J.village,
    displayName,
    state: "active",
    lockedUntil: null,
    onShiftAtGateId: null,
    pinSetAt: at(-60 * DAY),
    createdAt: at(-90 * DAY),
    pin,
    failed: 0,
    ...extra,
  });
  const guards = [
    guard(GATE.somchai, "สมชาย ใจดี", "1234"),
    guard(GATE.wittaya, "วิทยา แสงทอง", "2468"),
    guard(GATE.anucha, "อนุชา ทองดี", "1357", { lockedUntil: at(12 * 60_000) }),
  ];

  const policies: MockGateWorld["policies"] = {};
  const u11 = unitByNo("99/11");
  const u21 = unitByNo("99/21");
  const u13 = unitByNo("99/13");
  if (u11) policies[u11.dto.id] = { ...DEFAULT_POLICY, custom: true, householdNote: "มีสุนัข กดกริ่งแล้วรอสักครู่" };
  if (u21) policies[u21.dto.id] = { ...DEFAULT_POLICY, custom: true, action: "allow_and_log", timeoutSeconds: 120 };
  if (u13) policies[u13.dto.id] = { ...DEFAULT_POLICY, custom: true, action: "deny", deliverySkipApproval: true };

  const visits: MockVisit[] = [
    visit(
      1,
      {
        kind: "guest",
        state: "requested",
        createdAt: at(-72_000),
        respondBy: at(108_000),
        timeoutAction: "guard_calls",
        plate: plate("3กท", "8812"),
        visitorName: "คุณอนันต์",
      },
      "99/11",
    ),
    visit(
      2,
      {
        kind: "guest",
        state: "approved",
        createdAt: at(-150_000),
        respondBy: at(-30_000),
        timeoutAction: "allow_and_log",
        decidedAt: at(-40_000),
        entryBasis: "approval",
        plate: plate("2ขพ", "4410"),
      },
      "99/21",
    ),
    visit(
      3,
      {
        kind: "delivery",
        state: "entered",
        createdAt: at(-16 * 60_000),
        enteredAt: at(-16 * 60_000),
        entryBasis: "delivery_drop_point",
        plate: plate("6กย", "9102"),
      },
      "99/13",
    ),
    visit(
      4,
      {
        kind: "guest",
        state: "entered",
        createdAt: at(-51 * 60_000),
        enteredAt: at(-51 * 60_000),
        entryBasis: "approval",
        plate: plate("ฎฮ", "1109"),
      },
      "99/14",
    ),
    visit(
      5,
      {
        kind: "contractor",
        state: "entered",
        createdAt: at(-26 * 3600_000),
        enteredAt: at(-26 * 3600_000),
        entryBasis: "invite",
        plate: plate("บท", "3200", "นนทบุรี"),
      },
      "99/22",
    ),
    visit(
      6,
      {
        kind: "delivery",
        state: "entered",
        createdAt: at(-3 * 3600_000),
        enteredAt: at(-3 * 3600_000),
        entryBasis: "approval",
        plate: plate("5ขค", "7714"),
        visitorName: "Flash Express",
      },
      "99/11",
    ),
    visit(
      7,
      {
        kind: "guest",
        state: "exited",
        createdAt: at(-5 * 3600_000),
        enteredAt: at(-5 * 3600_000),
        exitedAt: at(-4 * 3600_000),
        exitedBy: "guard",
        entryBasis: "approval",
        plate: plate("1กข", "4521"),
        idLast4: "4821",
      },
      "99/12",
    ),
  ];

  return {
    gates,
    devices,
    guards,
    shifts: {},
    visits,
    policies,
    blacklist: [
      {
        id: gid("6a7e0b07", 1),
        propertyId: J.village,
        plate: plate("9กก", "9999"),
        reason: "ขับรถเร็วในโครงการซ้ำหลายครั้ง (มติกรรมการ 3/2569)",
        createdAt: at(-40 * DAY),
        revokedAt: null,
      },
    ],
    invites: [
      {
        id: gid("6a7e0b08", 1),
        unitId: u21?.dto.id ?? "",
        unitNo: "99/21",
        usage: "single",
        visitorKind: "guest",
        visitorName: "คุณมณี",
        plate: null,
        state: "active",
        maxUses: 1,
        uses: 0,
        note: null,
        rejectReason: null,
        validFrom: at(-DAY),
        validTo: at(DAY),
        createdAt: at(-DAY),
        token: MOCK_INVITE_TOKEN,
      },
      {
        id: gid("6a7e0b08", 2),
        unitId: u11?.dto.id ?? "",
        unitNo: "99/11",
        usage: "multi",
        visitorKind: "contractor",
        visitorName: "ช่างไฟ บจก. ไทยวัฒนา",
        plate: plate("ผข", "5521", "ปทุมธานี"),
        state: "pending_approval",
        maxUses: 10,
        uses: 0,
        note: "ซ่อมระบบไฟฟ้าในบ้าน 5 วัน",
        rejectReason: null,
        validFrom: at(DAY),
        validTo: at(6 * DAY),
        createdAt: at(-3600_000),
        token: null,
      },
    ],
    vehicles: [
      {
        id: gid("6a7e0b09", 1),
        unitId: u11?.dto.id ?? "",
        plate: plate("1กข", "1234"),
        label: "รถเก๋งสีขาว",
        createdAt: at(-200 * DAY),
      },
      {
        id: gid("6a7e0b09", 2),
        unitId: u21?.dto.id ?? "",
        plate: plate("กข", "7788", "ชลบุรี"),
        label: null,
        createdAt: at(-80 * DAY),
      },
    ],
    detections: [],
    incidents: [
      {
        id: gid("6a7e0b0a", 1),
        kind: "medical",
        state: "resolved",
        source: "resident_sos",
        propertyId: J.village,
        propertyName: "หมู่บ้านสวนสน",
        gate: { id: GATE.main, name: "ป้อม 1 · ทางเข้าหลัก" },
        unit: u13 ? { id: u13.dto.id, unitNo: "99/13" } : null,
        note: "ผู้สูงอายุหกล้มในห้องน้ำ",
        hasPhoto: false,
        visitCount: 2,
        createdAt: at(-9 * DAY),
        acknowledgedAt: at(-9 * DAY + 60_000),
        resolvedAt: at(-9 * DAY + 40 * 60_000),
        cancelledAt: null,
        events: [
          { id: gid("6a7e0b0b", 1), kind: "raised", actorKind: "resident", occurredAt: at(-9 * DAY) },
          { id: gid("6a7e0b0b", 2), kind: "acknowledged", actorKind: "guard", occurredAt: at(-9 * DAY + 60_000) },
          { id: gid("6a7e0b0b", 3), kind: "resolved", actorKind: "guard", occurredAt: at(-9 * DAY + 40 * 60_000) },
        ],
        visits: [],
      },
    ],
    events: [],
    received: [],
    replays: {},
  };
}

const g = () => state.gate;

// ── guard auth ─────────────────────────────────────────────────────────────────────────────────────────────────────

type GuardOk = { guard: MockGuard; gateId: string; deviceId: string; shiftId: string };

function guardCall(request: Request, op: string): GuardOk | Response {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const grant = state.access.get(token);
  if (!grant || grant.expiresAt < Date.now()) return problem(op, "auth.unauthenticated");
  if (grant.audience !== "guard") return problem(op, "auth.wrong_audience");
  const shift = g().shifts[grant.userKey];
  const guard = shift && g().guards.find((candidate) => candidate.id === shift.guardId && candidate.state === "active");
  const device =
    shift && g().devices.find((candidate) => candidate.id === shift.deviceId && candidate.state === "active");
  if (!shift || !guard || !device) return problem(op, "auth.unauthenticated");
  return { guard, gateId: shift.gateId, deviceId: shift.deviceId, shiftId: grant.userKey };
}

function deviceOf(input: { deviceId?: string; deviceSecret?: string }): MockDevice | null {
  return (
    g().devices.find(
      (d) =>
        d.id === input.deviceId && d.kind === "guard_tablet" && d.state === "active" && d.secret === input.deviceSecret,
    ) ?? null
  );
}

// ── stream ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const streams = new Set<GateStream>();

/** An event on the gate stream (ids only, like the API) — kept for `Last-Event-ID` replay. */
export function gateEmit(type: string, ids: Record<string, string>, gateId: string = GATE.main): GateEvent {
  const event = { id: crypto.randomUUID(), type, ids };
  g().events.push(event);
  if (g().events.length > 500) g().events.shift();
  for (const stream of streams) if (stream.gateId === gateId || type.startsWith("gate.incident.")) stream.send(event);
  return event;
}

export function dropGateStreams(): number {
  const count = streams.size;
  for (const stream of [...streams]) stream.close();
  return count;
}

function visitEvent(v: MockVisit, kind: Schemas["VisitEventKind"], actorKind: Schemas["VisitActorKind"], type: string) {
  const event = gateEmit(type, { visitId: v.id });
  v.events.push({ id: event.id, kind, actorKind, occurredAt: new Date().toISOString(), payload: {} });
}

// ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────

function listDto(v: MockVisit): Schemas["GuardVisitDto"] {
  const { events: _events, callBackName: _callBack, photoUrl: _photo, propertyId: _property, ...rest } = v;
  void _events;
  void _callBack;
  void _photo;
  void _property;
  return rest;
}

const samePlate = (a: Schemas["PlateDto"], b: { category: string; number: string }) =>
  a.category === b.category && a.number === b.number;

function remember(op: string, request: Request, payload: unknown) {
  g().received.push({ op, body: payload, idempotencyKey: request.headers.get("idempotency-key") });
  if (g().received.length > 300) g().received.shift();
}

function guardIncident(i: Schemas["IncidentDetailDto"]): Schemas["IncidentDto"] {
  const { events: _events, visits: _visits, ...rest } = i;
  void _events;
  void _visits;
  return rest;
}

export function raiseIncident(input: {
  kind: Schemas["IncidentKind"];
  source: Schemas["IncidentSource"];
  unitNo?: string | null;
  note?: string | null;
}): Schemas["IncidentDetailDto"] {
  const unit = input.unitNo ? unitByNo(input.unitNo) : null;
  const inside = g().visits.filter((v) => v.state === "entered");
  const incident: Schemas["IncidentDetailDto"] = {
    id: crypto.randomUUID(),
    kind: input.kind,
    state: "open",
    source: input.source,
    propertyId: J.village,
    propertyName: "หมู่บ้านสวนสน",
    gate: input.source === "guard" ? { id: GATE.main, name: "ป้อม 1 · ทางเข้าหลัก" } : null,
    unit: unit ? { id: unit.dto.id, unitNo: unit.dto.unitNo } : null,
    note: input.note ?? null,
    hasPhoto: false,
    visitCount: inside.length,
    createdAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    events: [
      {
        id: crypto.randomUUID(),
        kind: "raised",
        actorKind: input.source === "guard" ? "guard" : "resident",
        occurredAt: new Date().toISOString(),
      },
    ],
    visits: inside.map((v) => ({
      id: v.id,
      kind: v.kind,
      state: v.state,
      plate: v.plate ? `${v.plate.category} ${v.plate.number}` : null,
      unitNo: v.unitNo,
      visitorName: v.visitorName,
      gateName: v.gateName,
      enteredAt: v.enteredAt,
      exitedAt: v.exitedAt,
    })),
  };
  g().incidents.unshift(incident);
  gateEmit("gate.incident.raised", { incidentId: incident.id });
  return incident;
}

/** A house answers in LIFF (approve / deny / call-me), the first answer wins (D-327). */
export function houseAnswers(visitId: string | null, answer: "approve" | "deny" | "call-me"): MockVisit | null {
  const v = visitId
    ? g().visits.find((candidate) => candidate.id === visitId)
    : [...g().visits].reverse().find((candidate) => candidate.state === "requested");
  if (!v || v.state !== "requested") return null;
  if (answer === "call-me") {
    v.callMeAt = new Date().toISOString();
    v.callBackName = ownersOf(v.unitId ?? "")[0] ?? "เจ้าของบ้าน";
    visitEvent(v, "answered", "resident", "gate.visit.answered");
    return v;
  }
  v.state = answer === "approve" ? "approved" : "denied";
  v.decidedAt = new Date().toISOString();
  if (answer === "approve") v.entryBasis = "approval";
  visitEvent(v, "answered", "resident", "gate.visit.answered");
  return v;
}

export function plateRead(input: {
  category: string;
  number: string;
  province?: string | null;
  confidence?: string;
  match?: Schemas["PlateMatch"];
}): Schemas["PlateDetectionDto"] {
  const detection: Schemas["PlateDetectionDto"] = {
    id: crypto.randomUUID(),
    gateId: GATE.main,
    plate: { category: input.category, number: input.number, province: input.province ?? null },
    confidence: input.confidence ?? "0.82",
    match: input.match ?? "none",
    state: "pending",
    unit: null,
    visitId: null,
    imageRef: null,
    detectedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };
  g().detections.unshift(detection);
  gateEmit("gate.plate_detected", { detectionId: detection.id });
  return detection;
}

export function setBarrier(hwState: Schemas["GateHwState"]): void {
  const barrier = g().devices.find((d) => d.kind === "barrier" && d.state === "active");
  if (!barrier) return;
  barrier.hwState = hwState;
  barrier.hwStateAt = new Date().toISOString();
  gateEmit("gate.barrier_state", { gateId: GATE.main });
}

/** Timeouts as the API's `gate-visits` job does (every 15 s there; on read here). */
function sweep() {
  const now = Date.now();
  for (const v of g().visits) {
    if (v.state === "requested" && v.respondBy && Date.parse(v.respondBy) <= now) {
      v.state = "timed_out";
      visitEvent(v, "policy_applied", "system", "gate.visit.timed_out");
    }
  }
}

// ── guard handlers ─────────────────────────────────────────────────────────────────────────────────────────────────

const guardHandlers: HttpHandler[] = [
  http.post("*/v1/auth/guard/devices/enrol", async ({ request }) => {
    const op = "auth.guard.enrol";
    const input = await body<Schemas["GuardEnrolDto"]>(request);
    const code = (input.code ?? "").trim().toUpperCase();
    const pending = g().devices.find((d) => d.kind === "guard_tablet" && d.state === "pending" && d.code === code);
    if (code !== MOCK_ENROL_CODE && !pending) return problem(op, "gate.enrol_code_invalid");
    const secret = `mock-secret-${crypto.randomUUID()}`;
    let device = pending ?? g().devices.find((d) => d.id === GATE.tablet)!;
    if (pending) {
      pending.state = "active";
      pending.code = null;
      pending.enrolledAt = new Date().toISOString();
      pending.enrolExpiresAt = null;
    } else {
      device = { ...device, state: "active", revokedAt: null };
      g().devices = g().devices.map((d) => (d.id === device.id ? device : d));
    }
    device.secret = secret;
    if (input.name) device.name = input.name;
    const gate = g().gates.find((candidate) => candidate.id === device.gateId)!;
    return json({
      deviceId: device.id,
      deviceSecret: secret,
      gateId: gate.id,
      gateName: gate.name,
      propertyId: gate.propertyId,
      propertyName: "หมู่บ้านสวนสน",
      tenantId: JURISTIC_TENANT,
      tenantName: "นิติบุคคล เดอะ ริเวอร์ไซด์",
    } satisfies Schemas["GuardEnrolledDto"]);
  }),

  http.post("*/v1/auth/guard/roster", async ({ request }) => {
    const device = deviceOf(await body(request));
    if (!device) return problem("auth.guard.roster", "gate.device_unknown");
    const gate = g().gates.find((candidate) => candidate.id === device.gateId)!;
    return json({
      gateName: gate.name,
      propertyName: "หมู่บ้านสวนสน",
      guards: g()
        .guards.filter((guard) => guard.state === "active" && guard.propertyId === gate.propertyId)
        .map((guard) => ({
          guardId: guard.id,
          displayName: guard.displayName,
          locked: Boolean(guard.lockedUntil && Date.parse(guard.lockedUntil) > Date.now()),
        })),
    } satisfies Schemas["GuardRosterDto"]);
  }),

  http.post("*/v1/auth/guard/sign-in", async ({ request }) => {
    const op = "auth.guard.signIn";
    const input = await body<Schemas["GuardSignInDto"]>(request);
    const device = deviceOf(input);
    if (!device) return problem(op, "gate.device_unknown");
    const guard = g().guards.find((candidate) => candidate.id === input.guardId && candidate.state === "active");
    if (guard?.lockedUntil && Date.parse(guard.lockedUntil) > Date.now()) {
      return problem(op, "gate.pin_locked", { lockedUntil: guard.lockedUntil });
    }
    if (!guard || guard.pin !== input.pin) {
      if (guard) {
        guard.failed += 1;
        if (guard.failed >= 5) {
          guard.failed = 0;
          guard.lockedUntil = at(15 * 60_000);
          return problem(op, "gate.pin_locked", { lockedUntil: guard.lockedUntil });
        }
      }
      return problem(op, "gate.pin_invalid");
    }
    guard.failed = 0;
    guard.lockedUntil = null;
    for (const [id, shift] of Object.entries(g().shifts)) if (shift.guardId === guard.id) delete g().shifts[id];
    const shiftId = crypto.randomUUID();
    g().shifts[shiftId] = {
      guardId: guard.id,
      deviceId: device.id,
      gateId: device.gateId,
      startedAt: new Date().toISOString(),
    };
    guard.onShiftAtGateId = device.gateId;
    return json({
      ...issueTokens("guard", shiftId),
      subject: {
        id: guard.id,
        type: "user",
        audience: "guard",
        roles: ["guard"],
        permissions: [],
        scopes: [`shift:${shiftId}`],
      },
    });
  }),

  http.get("*/v1/guard/me", ({ request }) => {
    const ok = guardCall(request, "guard.me.get");
    if (ok instanceof Response) return ok;
    const gate = g().gates.find((candidate) => candidate.id === ok.gateId)!;
    const device = g().devices.find((candidate) => candidate.id === ok.deviceId)!;
    return json({
      gateId: gate.id,
      gateName: gate.name,
      gateDeviceId: device.id,
      gateDeviceName: device.name,
      guardId: ok.guard.id,
      guardName: ok.guard.displayName,
      propertyId: gate.propertyId,
      propertyName: "หมู่บ้านสวนสน",
      shiftId: ok.shiftId,
      startedAt: g().shifts[ok.shiftId]!.startedAt,
      privacyNotice: PRIVACY,
    } satisfies Schemas["GuardMeDto"]);
  }),

  http.post("*/v1/guard/shift/actions/end", ({ request }) => {
    const ok = guardCall(request, "guard.shift.end");
    if (ok instanceof Response) return ok;
    delete g().shifts[ok.shiftId];
    ok.guard.onShiftAtGateId = null;
    return new Response(null, { status: 204 });
  }),

  http.get("*/v1/guard/privacy-notice", ({ request }) => {
    const ok = guardCall(request, "guard.privacyNotice.get");
    if (ok instanceof Response) return ok;
    return json(PRIVACY);
  }),

  http.get("*/v1/guard/units", ({ request }) => {
    const ok = guardCall(request, "guard.units.list");
    if (ok instanceof Response) return ok;
    const q = (query(request).get("q") ?? "").trim().toLowerCase();
    const limit = Number(query(request).get("limit")) || 20;
    const rows = villageUnits().filter((u) => {
      if (!q) return true;
      // The API matches the house number only (no names at the gate, D-315).
      return u.dto.unitNo.toLowerCase().includes(q);
    });
    return json(rows.slice(0, limit).map(guardUnit));
  }),

  http.get("*/v1/guard/visits/changes", ({ request }) => {
    const ok = guardCall(request, "guard.visits.changes");
    if (ok instanceof Response) return ok;
    sweep();
    const after = Date.parse(query(request).get("after") ?? "") || 0;
    return json(
      g()
        .visits.flatMap((v) => v.events.map((event) => ({ ...event, visitId: v.id })))
        .filter((event) => Date.parse(event.occurredAt) > after)
        .map((event) => ({ id: event.id, kind: event.kind, occurredAt: event.occurredAt, visitId: event.visitId })),
    );
  }),

  http.get("*/v1/guard/visits", ({ request }) => {
    const ok = guardCall(request, "guard.visits.list");
    if (ok instanceof Response) return ok;
    sweep();
    const view = query(request).get("view") ?? "waiting";
    const mine = g().visits.filter((v) => v.gateId === ok.gateId);
    const rows =
      view === "inside"
        ? mine.filter((v) => v.state === "entered")
        : view === "today"
          ? mine.filter((v) => Date.now() - Date.parse(v.createdAt) < DAY)
          : mine.filter((v) => ["requested", "approved", "denied", "timed_out"].includes(v.state));
    return json(rows.map(listDto));
  }),

  http.get("*/v1/guard/visits/:visitId", ({ request, params }) => {
    const ok = guardCall(request, "guard.visits.get");
    if (ok instanceof Response) return ok;
    const v = g().visits.find((candidate) => candidate.id === params.visitId && candidate.gateId === ok.gateId);
    if (!v) return problem("guard.visits.get", "http.not_found");
    const { propertyId: _property, ...rest } = v;
    void _property;
    return json(rest);
  }),

  http.post("*/v1/guard/visits", async ({ request }) => {
    const op = "guard.visits.create";
    const ok = guardCall(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["VisitCreateDto"]>(request);
    remember(op, request, input);
    const existing = g().visits.find((v) => v.clientRef === input.clientRef && v.gateId === ok.gateId);
    if (existing) return json({ ...listDto(existing), replayed: true }, 201);
    if (input.kind !== "other" && !input.unitId) return validation(op, "unitId", "required");
    if (input.idLast4 && !/^\d{4}$/.test(input.idLast4)) return validation(op, "idLast4", "four digits");
    const unit = unitById(input.unitId);
    if (input.unitId && !unit) return problem(op, "http.not_found");
    const policy = unit ? policyOf(unit.dto.id) : DEFAULT_POLICY;
    const now = new Date().toISOString();
    const base = makeVisit(0, { kind: input.kind, state: "requested", createdAt: now }, unit);
    const v: MockVisit = {
      ...base,
      id: crypto.randomUUID(),
      clientRef: input.clientRef,
      gateId: ok.gateId,
      plate: input.plate ?? null,
      visitorName: input.visitorName ?? null,
      idLast4: input.idLast4 ?? null,
      note: input.note ?? null,
    };
    const blacklisted = input.plate && g().blacklist.some((b) => !b.revokedAt && samePlate(b.plate, input.plate!));
    const remembered =
      input.plate && unit && g().vehicles.some((r) => r.unitId === unit.dto.id && samePlate(r.plate, input.plate!));
    if (blacklisted) {
      Object.assign(v, { state: "denied", decidedAt: now, decisionReason: "blacklisted" });
    } else if (input.enteredOffline) {
      Object.assign(v, {
        state: "entered",
        enteredAt: input.recordedAt ?? now,
        recordedAt: input.recordedAt ?? now,
        entryBasis: "offline",
      });
    } else if (remembered) {
      Object.assign(v, { state: "entered", enteredAt: now, entryBasis: "remembered_vehicle" });
    } else if (input.kind === "delivery" && policy.deliverySkipApproval) {
      Object.assign(v, { state: "entered", enteredAt: now, entryBasis: "delivery_drop_point" });
    } else {
      Object.assign(v, {
        respondBy: at(policy.timeoutSeconds * 1000),
        timeoutAction: policy.action,
      });
    }
    g().visits.push(v);
    visitEvent(v, "created", "guard", v.state === "requested" ? "gate.visit.requested" : "gate.visit.recorded");
    return json({ ...listDto(v), replayed: false } satisfies Schemas["VisitCreatedDto"], 201);
  }),

  ...(["enter", "exit", "cancel"] as const).map((action) =>
    http.post(`*/v1/guard/visits/:visitId/actions/${action}`, async ({ request, params }) => {
      const op = `guard.visits.${action}`;
      const ok = guardCall(request, op);
      if (ok instanceof Response) return ok;
      sweep();
      const v = g().visits.find((candidate) => candidate.id === params.visitId && candidate.gateId === ok.gateId);
      if (!v) return problem(op, "http.not_found");
      const input = action === "exit" ? {} : await body<Schemas["VisitReasonDto"]>(request);
      remember(op, request, input);
      const now = new Date().toISOString();
      if (action === "enter") {
        const allowed =
          v.state === "approved" ||
          (v.state === "timed_out" && v.timeoutAction !== "deny") ||
          (v.state === "requested" && (input.reason ?? "").trim().length >= 5);
        if (v.state === "requested" && !(input.reason ?? "").trim()) return problem(op, "visit.awaiting_answer");
        if (!allowed) return problem(op, "visit.invalid_state");
        if (v.state === "requested") v.entryBasis = "guard_override";
        if (v.state === "timed_out") v.entryBasis = "policy";
        v.state = "entered";
        v.enteredAt = now;
        visitEvent(v, "entered", "guard", "gate.visit.entered");
      } else if (action === "exit") {
        if (v.state !== "entered") return problem(op, "visit.invalid_state");
        v.state = "exited";
        v.exitedAt = now;
        v.exitedBy = "guard";
        visitEvent(v, "exited", "guard", "gate.visit.exited");
      } else {
        if (!["requested", "approved", "timed_out", "denied"].includes(v.state))
          return problem(op, "visit.invalid_state");
        v.state = "cancelled";
        v.cancelledAt = now;
        visitEvent(v, "cancelled", "guard", "gate.visit.cancelled");
      }
      return json(listDto(v));
    }),
  ),

  http.post("*/v1/guard/visits/:visitId/photo", async ({ request, params }) => {
    const op = "guard.visits.photo";
    const ok = guardCall(request, op);
    if (ok instanceof Response) return ok;
    const v = g().visits.find((candidate) => candidate.id === params.visitId && candidate.gateId === ok.gateId);
    if (!v) return problem(op, "http.not_found");
    const input = await body<Schemas["VisitPhotoDto"]>(request);
    remember(op, request, {
      mimeType: input.mimeType,
      bytes: Math.floor(((input.contentBase64 ?? "").length * 3) / 4),
    });
    v.hasPhoto = true;
    visitEvent(v, "photo_added", "guard", "gate.visit.photo_added");
    return json(listDto(v));
  }),

  http.post("*/v1/guard/invites/actions/scan", async ({ request }) => {
    const op = "guard.invites.scan";
    const ok = guardCall(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["InviteScanDto"]>(request);
    remember(op, request, input);
    const existing = g().visits.find((v) => v.clientRef === input.clientRef);
    if (existing) return json({ ...listDto(existing), replayed: true }, 201);
    const invite = g().invites.find((candidate) => candidate.token === input.token);
    if (!invite) return problem(op, "http.not_found");
    if (invite.state !== "active") return problem(op, "visit_invite.not_active");
    if (invite.uses >= invite.maxUses) return problem(op, "visit_invite.used_up");
    if (invite.plate && input.plate && !samePlate(invite.plate, input.plate))
      return problem(op, "visit_invite.plate_mismatch");
    invite.uses += 1;
    const now = new Date().toISOString();
    const base = makeVisit(
      0,
      { kind: invite.visitorKind, state: "entered", createdAt: now },
      invite.unitNo ? unitByNo(invite.unitNo) : null,
    );
    const v: MockVisit = {
      ...base,
      id: crypto.randomUUID(),
      clientRef: input.clientRef,
      gateId: ok.gateId,
      plate: input.plate ?? invite.plate,
      visitorName: invite.visitorName,
      enteredAt: now,
      entryBasis: "invite",
    };
    g().visits.push(v);
    visitEvent(v, "entered", "guard", "gate.visit.entered");
    return json({ ...listDto(v), replayed: false }, 201);
  }),

  http.post("*/v1/guard/gates/:gateId/actions/open", async ({ request, params }) => {
    const op = "guard.gates.open";
    const ok = guardCall(request, op);
    if (ok instanceof Response) return ok;
    if (params.gateId !== ok.gateId) return problem(op, "http.not_found");
    const input = await body<Schemas["GuardGateOpenDto"]>(request);
    remember(op, request, input);
    const barriers = g().devices.filter((d) => d.gateId === ok.gateId && d.kind === "barrier" && d.state === "active");
    if (barriers.length === 0) return problem(op, "gate.no_barrier");
    const gate = g().gates.find((candidate) => candidate.id === ok.gateId)!;
    const last = (gate as { lastOpenAt?: number }).lastOpenAt ?? 0;
    if (Date.now() - last < 3000) {
      const limited = problem(op, "gate.open_rate_limited");
      limited.headers.set("retry-after", "3");
      return limited;
    }
    (gate as { lastOpenAt?: number }).lastOpenAt = Date.now();
    if (input.visitId) {
      const v = g().visits.find((candidate) => candidate.id === input.visitId);
      if (v)
        v.events.push({
          id: crypto.randomUUID(),
          kind: "gate_opened",
          actorKind: "guard",
          occurredAt: new Date().toISOString(),
          payload: {},
        });
    }
    gateEmit("gate.open_requested", { gateId: ok.gateId });
    setTimeout(() => setBarrier("open"), 300);
    setTimeout(() => setBarrier("closed"), 6000);
    return json(
      {
        gateId: ok.gateId,
        commands: barriers.map((b) => ({ commandId: crypto.randomUUID(), gateDeviceId: b.id, expiresAt: at(30_000) })),
      } satisfies Schemas["GateOpenResultDto"],
      202,
    );
  }),

  http.get("*/v1/guard/hardware", ({ request }) => {
    const ok = guardCall(request, "guard.hardware.list");
    if (ok instanceof Response) return ok;
    return json(
      g()
        .devices.filter((d) => d.gateId === ok.gateId && d.kind !== "guard_tablet" && d.state === "active")
        .map((d) => ({
          id: d.id,
          kind: d.kind as Schemas["GateHardwareKind"],
          name: d.name,
          hwState: d.hwState,
          hwStateAt: d.hwStateAt,
          lastSeenAt: d.lastSeenAt,
        })),
    );
  }),

  http.get("*/v1/guard/plate-detections", ({ request }) => {
    const ok = guardCall(request, "guard.plateDetections.list");
    if (ok instanceof Response) return ok;
    const view = query(request).get("view") ?? "pending";
    return json(g().detections.filter((d) => d.gateId === ok.gateId && (view === "recent" || d.state === "pending")));
  }),

  ...(["claim", "dismiss"] as const).map((action) =>
    http.post(`*/v1/guard/plate-detections/:detectionId/actions/${action}`, ({ request, params }) => {
      const op = `guard.plateDetections.${action}`;
      const ok = guardCall(request, op);
      if (ok instanceof Response) return ok;
      const detection = g().detections.find((d) => d.id === params.detectionId && d.gateId === ok.gateId);
      if (!detection) return problem(op, "http.not_found");
      if (detection.state !== "pending") return problem(op, "plate_detection.invalid_state");
      detection.state = action === "claim" ? "claimed" : "dismissed";
      gateEmit("gate.plate_detection.changed", { detectionId: detection.id });
      return json(detection);
    }),
  ),

  http.get("*/v1/guard/incidents", ({ request }) => {
    const ok = guardCall(request, "guard.incidents.list");
    if (ok instanceof Response) return ok;
    const view = query(request).get("view") ?? "active";
    return json(
      g()
        .incidents.filter((i) =>
          view === "recent"
            ? Date.now() - Date.parse(i.createdAt) < DAY
            : i.state === "open" || i.state === "acknowledged",
        )
        .map(guardIncident),
    );
  }),

  http.post("*/v1/guard/incidents", async ({ request }) => {
    const op = "guard.incidents.create";
    const ok = guardCall(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["GuardIncidentCreateDto"]>(request);
    remember(op, request, input);
    const unit = input.unitId ? unitById(input.unitId) : null;
    const incident = raiseIncident({ kind: input.kind, source: "guard", unitNo: unit?.dto.unitNo, note: input.note });
    return json(guardIncident(incident), 201);
  }),

  http.get("*/v1/guard/incidents/:incidentId", ({ request, params }) => {
    const ok = guardCall(request, "guard.incidents.get");
    if (ok instanceof Response) return ok;
    const incident = g().incidents.find((i) => i.id === params.incidentId);
    if (!incident) return problem("guard.incidents.get", "http.not_found");
    const { visits: _visits, ...rest } = incident;
    void _visits;
    return json(rest);
  }),

  ...(["acknowledge", "resolve"] as const).map((action) =>
    http.post(`*/v1/guard/incidents/:incidentId/actions/${action}`, async ({ request, params }) => {
      const op = `guard.incidents.${action}`;
      const ok = guardCall(request, op);
      if (ok instanceof Response) return ok;
      const incident = g().incidents.find((i) => i.id === params.incidentId);
      if (!incident) return problem(op, "http.not_found");
      remember(op, request, await body(request));
      return decideIncident(incident, action, "guard", op);
    }),
  ),

  http.get("*/v1/guard/events", ({ request }) => {
    const ok = guardCall(request, "guard.events.stream");
    if (ok instanceof Response) return ok;
    const lastId = request.headers.get("last-event-id") ?? query(request).get("lastEventId");
    const encoder = new TextEncoder();
    let stream: GateStream | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const bodyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (text: string) => {
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            // the tablet went away
          }
        };
        const send = (event: GateEvent | { ready: true }) =>
          "ready" in event
            ? write(`event: ready\ndata: {}\n\n`)
            : write(
                `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify({ type: event.type, ids: event.ids })}\n\n`,
              );
        const close = () => {
          clearInterval(heartbeat);
          if (stream) streams.delete(stream);
          try {
            controller.close();
          } catch {
            // already closed
          }
        };
        stream = { gateId: ok.gateId, send, close };
        streams.add(stream);
        if (lastId) {
          const index = g().events.findIndex((event) => event.id === lastId);
          if (index >= 0) for (const event of g().events.slice(index + 1)) send(event);
        }
        send({ ready: true });
        heartbeat = setInterval(() => write(`event: heartbeat\ndata: {}\n\n`), 25_000);
        request.signal.addEventListener("abort", close);
      },
      cancel() {
        clearInterval(heartbeat);
        if (stream) streams.delete(stream);
      },
    });
    return new Response(bodyStream, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" },
    });
  }),
];

function decideIncident(
  incident: Schemas["IncidentDetailDto"],
  action: "acknowledge" | "resolve",
  actorKind: Schemas["VisitActorKind"],
  op: string,
) {
  const now = new Date().toISOString();
  if (action === "acknowledge") {
    if (incident.state !== "open") return problem(op, "incident.invalid_state");
    incident.state = "acknowledged";
    incident.acknowledgedAt = now;
  } else {
    if (incident.state !== "open" && incident.state !== "acknowledged") return problem(op, "incident.invalid_state");
    incident.state = "resolved";
    incident.resolvedAt = now;
  }
  incident.events.push({
    id: crypto.randomUUID(),
    kind: action === "acknowledge" ? "acknowledged" : "resolved",
    actorKind,
    occurredAt: now,
  });
  gateEmit(`gate.incident.${action === "acknowledge" ? "acknowledged" : "resolved"}`, { incidentId: incident.id });
  return json(guardIncident(incident));
}

// ── owner handlers ─────────────────────────────────────────────────────────────────────────────────────────────────

function gateOwner(request: Request, op: string, write = false) {
  const ok = write ? mutating(request, op) : owner(request, op);
  if (ok instanceof Response) return ok;
  if (ok.tenantId !== JURISTIC_TENANT) return problem(op, "http.not_found");
  return ok;
}

function needsManage(ok: Exclude<ReturnType<typeof gateOwner>, Response>, op: string): Response | null {
  const role = roleOf(ok);
  return role === "owner" || role === "manager" ? null : problem(op, "auth.forbidden");
}

function reasonOk(request: Request, op: string): Response | null {
  const reason = (query(request).get("reason") ?? "").trim();
  return reason.length >= 5 && reason.length <= 500 ? null : validation(op, "reason", "5–500 characters");
}

function ownerDevice(d: MockDevice): Schemas["GateDeviceDto"] {
  const { secret: _secret, code: _code, ...rest } = d;
  void _secret;
  void _code;
  return rest;
}

const ownerHandlers: HttpHandler[] = [
  // The estate's edge gateway (the one the barrier and the LPR camera hang on), for the attach form.
  http.get("*/v1/owner/devices", ({ request }) => {
    const ok = owner(request, "owner.devices.list");
    if (ok instanceof Response || ok.tenantId !== JURISTIC_TENANT || query(request).get("kind") !== "gateway")
      return undefined;
    const gateway = {
      id: GATE.edge,
      kind: "gateway",
      serial: "GW-SS-0001",
      model: "getproperty Edge G2",
      vendor: "Collective",
      status: "online",
      ownership: "platform_haas",
      buildingId: J.soi1,
      tenantId: JURISTIC_TENANT,
      assetItemId: null,
      arch: "arm64",
      driver: null,
      firmwareVersion: "1.3.0",
      configAppliedVersion: 4,
      gatewayDeviceId: null,
      health: null,
      lastSeenAt: at(-60_000),
      meters: 0,
      mqttWsFallback: false,
      nextActions: [],
      otaRing: "stable",
      version: 1,
    } as unknown as Schemas["FleetDeviceDto"];
    return json(paged([gateway], request));
  }),
  http.get("*/v1/owner/gates", ({ request }) => {
    const ok = gateOwner(request, "owner.gates.list");
    if (ok instanceof Response) return ok;
    const propertyId = query(request).get("propertyId");
    return json(g().gates.filter((gate) => !propertyId || gate.propertyId === propertyId));
  }),
  http.post("*/v1/owner/gates", async ({ request }) => {
    const op = "owner.gates.create";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const denied = needsManage(ok, op);
    if (denied) return denied;
    const input = await body<Schemas["GateCreateDto"]>(request);
    record(op, request, input);
    if (!input.name?.trim()) return validation(op, "name", "required");
    const gate: Schemas["GateDto"] = {
      id: crypto.randomUUID(),
      propertyId: input.propertyId,
      name: input.name.trim(),
      kind: input.kind ?? "main",
      state: "active",
      barrier: false,
      lpr: false,
      devices: 0,
      createdAt: new Date().toISOString(),
    };
    g().gates.push(gate);
    return json(gate, 201);
  }),
  http.get("*/v1/owner/gates/:gateId", ({ request, params }) => {
    const ok = gateOwner(request, "owner.gates.get");
    if (ok instanceof Response) return ok;
    const gate = g().gates.find((candidate) => candidate.id === params.gateId);
    return gate ? json(gate) : problem("owner.gates.get", "http.not_found");
  }),
  http.patch("*/v1/owner/gates/:gateId", async ({ request, params }) => {
    const op = "owner.gates.update";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const gate = g().gates.find((candidate) => candidate.id === params.gateId);
    if (!gate) return problem(op, "http.not_found");
    const input = await body<Schemas["GateUpdateDto"]>(request);
    record(op, request, input);
    Object.assign(gate, input);
    return json(gate);
  }),
  http.get("*/v1/owner/gates/:gateId/devices", ({ request, params }) => {
    const ok = gateOwner(request, "owner.gates.devices");
    if (ok instanceof Response) return ok;
    return json(
      g()
        .devices.filter((d) => d.gateId === params.gateId)
        .map(ownerDevice),
    );
  }),
  http.post("*/v1/owner/gates/:gateId/devices", async ({ request, params }) => {
    const op = "owner.gates.addDevice";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["GateDeviceCreateDto"]>(request);
    record(op, request, input);
    if (!input.name?.trim()) return validation(op, "name", "required");
    const code = `GP-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const device: MockDevice = {
      id: crypto.randomUUID(),
      gateId: String(params.gateId),
      kind: "guard_tablet",
      name: input.name.trim(),
      state: "pending",
      channel: null,
      edgeDeviceId: null,
      pulseMs: null,
      hwState: null,
      hwStateAt: null,
      enrolExpiresAt: at(24 * 3600_000),
      enrolledAt: null,
      lastSeenAt: null,
      revokedAt: null,
      secret: null,
      code,
    };
    g().devices.push(device);
    return json({ ...ownerDevice(device), enrolCode: code } satisfies Schemas["GateDeviceCreatedDto"], 201);
  }),
  http.post("*/v1/owner/gates/:gateId/devices/:deviceId/actions/revoke", async ({ request, params }) => {
    const op = "owner.gates.revokeDevice";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["RevokeReasonDto"]>(request);
    record(op, request, input);
    if ((input.reason ?? "").trim().length < 3) return validation(op, "reason", "3–240 characters");
    const device = g().devices.find((d) => d.id === params.deviceId && d.gateId === params.gateId);
    if (!device) return problem(op, "http.not_found");
    device.state = "revoked";
    device.revokedAt = new Date().toISOString();
    device.secret = null;
    for (const [id, shift] of Object.entries(g().shifts)) if (shift.deviceId === device.id) delete g().shifts[id];
    return json(ownerDevice(device));
  }),
  http.post("*/v1/owner/gates/:gateId/edge-devices", async ({ request, params }) => {
    const op = "owner.gates.attachEdgeDevice";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["EdgeDeviceAttachDto"]>(request);
    record(op, request, input);
    if (!input.name?.trim()) return validation(op, "name", "required");
    if (!/^[A-Za-z0-9_.:-]{1,32}$/.test(input.channel ?? "")) return validation(op, "channel", "pattern");
    if (
      g().devices.some(
        (d) => d.state === "active" && d.edgeDeviceId === input.edgeDeviceId && d.channel === input.channel,
      )
    ) {
      return problem(op, "gate.channel_taken");
    }
    const device: MockDevice = {
      id: crypto.randomUUID(),
      gateId: String(params.gateId),
      kind: input.kind,
      name: input.name.trim(),
      state: "active",
      channel: input.channel,
      edgeDeviceId: input.edgeDeviceId,
      pulseMs: input.kind === "barrier" ? (input.pulseMs ?? 800) : null,
      hwState: null,
      hwStateAt: null,
      enrolExpiresAt: null,
      enrolledAt: new Date().toISOString(),
      lastSeenAt: null,
      revokedAt: null,
      secret: null,
      code: null,
    };
    g().devices.push(device);
    const gate = g().gates.find((candidate) => candidate.id === params.gateId);
    if (gate) gate[input.kind === "barrier" ? "barrier" : "lpr"] = true;
    return json(ownerDevice(device), 201);
  }),
  http.post("*/v1/owner/gates/:gateId/edge-devices/:gateDeviceId/actions/detach", async ({ request, params }) => {
    const op = "owner.gates.detachEdgeDevice";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["RevokeReasonDto"]>(request);
    record(op, request, input);
    if ((input.reason ?? "").trim().length < 3) return validation(op, "reason", "3–240 characters");
    const device = g().devices.find((d) => d.id === params.gateDeviceId && d.gateId === params.gateId);
    if (!device) return problem(op, "http.not_found");
    device.state = "revoked";
    device.revokedAt = new Date().toISOString();
    return json(ownerDevice(device));
  }),

  http.get("*/v1/owner/gate-guards", ({ request }) => {
    const ok = gateOwner(request, "owner.gateGuards.list");
    if (ok instanceof Response) return ok;
    return json(g().guards.map(({ pin: _pin, failed: _failed, ...rest }) => (void _pin, void _failed, rest)));
  }),
  http.post("*/v1/owner/gate-guards", async ({ request }) => {
    const op = "owner.gateGuards.create";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["GuardCreateDto"]>(request);
    record(op, request, { ...input, pin: "••••" });
    if (!input.displayName?.trim()) return validation(op, "displayName", "required");
    if (!/^\d{4,6}$/.test(input.pin ?? "")) return validation(op, "pin", "4–6 digits");
    const guard: MockGuard = {
      id: crypto.randomUUID(),
      propertyId: input.propertyId,
      displayName: input.displayName.trim(),
      state: "active",
      lockedUntil: null,
      onShiftAtGateId: null,
      pinSetAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      pin: input.pin,
      failed: 0,
    };
    g().guards.push(guard);
    const { pin: _pin, failed: _failed, ...dto } = guard;
    void _pin;
    void _failed;
    return json(dto, 201);
  }),
  http.patch("*/v1/owner/gate-guards/:guardId", async ({ request, params }) => {
    const op = "owner.gateGuards.update";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const guard = g().guards.find((candidate) => candidate.id === params.guardId);
    if (!guard) return problem(op, "http.not_found");
    const input = await body<Schemas["GuardUpdateDto"]>(request);
    record(op, request, input);
    if (input.displayName) guard.displayName = input.displayName.trim();
    const { pin: _pin, failed: _failed, ...dto } = guard;
    void _pin;
    void _failed;
    return json(dto);
  }),
  ...(["reset-pin", "revoke"] as const).map((action) =>
    http.post(`*/v1/owner/gate-guards/:guardId/actions/${action}`, async ({ request, params }) => {
      const op = action === "reset-pin" ? "owner.gateGuards.resetPin" : "owner.gateGuards.revoke";
      const ok = gateOwner(request, op, true);
      if (ok instanceof Response) return ok;
      const guard = g().guards.find((candidate) => candidate.id === params.guardId);
      if (!guard) return problem(op, "http.not_found");
      const input = await body<{ pin?: string; reason?: string }>(request);
      record(op, request, action === "reset-pin" ? { pin: "••••" } : input);
      if (action === "reset-pin") {
        if (!/^\d{4,6}$/.test(input.pin ?? "")) return validation(op, "pin", "4–6 digits");
        guard.pin = input.pin!;
        guard.pinSetAt = new Date().toISOString();
        guard.lockedUntil = null;
        guard.failed = 0;
      } else {
        if ((input.reason ?? "").trim().length < 3) return validation(op, "reason", "3–240 characters");
        guard.state = "revoked";
        for (const [id, shift] of Object.entries(g().shifts)) if (shift.guardId === guard.id) delete g().shifts[id];
      }
      const { pin: _pin, failed: _failed, ...dto } = guard;
      void _pin;
      void _failed;
      return json(dto);
    }),
  ),

  http.get("*/v1/owner/gate-policies/units/:unitId", ({ request, params }) => {
    const ok = gateOwner(request, "owner.gatePolicies.get");
    if (ok instanceof Response) return ok;
    if (!unitById(String(params.unitId))) return problem("owner.gatePolicies.get", "http.not_found");
    return json(policyOf(String(params.unitId)));
  }),
  http.put("*/v1/owner/gate-policies/units/:unitId", async ({ request, params }) => {
    const op = "owner.gatePolicies.set";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    if (!unitById(String(params.unitId))) return problem(op, "http.not_found");
    const input = await body<Schemas["HousePolicyUpdateDto"]>(request);
    record(op, request, input);
    if (input.timeoutSeconds !== undefined && (input.timeoutSeconds < 60 || input.timeoutSeconds > 900)) {
      return validation(op, "timeoutSeconds", "60–900");
    }
    const next = { ...policyOf(String(params.unitId)), ...input, custom: true } as Schemas["HousePolicyDto"];
    g().policies[String(params.unitId)] = next;
    return json(next);
  }),

  http.get("*/v1/owner/gate-blacklist", ({ request }) => {
    const ok = gateOwner(request, "owner.gateBlacklist.list");
    if (ok instanceof Response) return ok;
    return json(g().blacklist);
  }),
  http.post("*/v1/owner/gate-blacklist", async ({ request }) => {
    const op = "owner.gateBlacklist.add";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["BlacklistCreateDto"]>(request);
    record(op, request, input);
    if ((input.reason ?? "").trim().length < 5) return validation(op, "reason", "5–500 characters");
    if (g().blacklist.some((b) => !b.revokedAt && samePlate(b.plate, input.plate)))
      return problem(op, "gate.blacklist_exists");
    const entry: Schemas["BlacklistDto"] = {
      id: crypto.randomUUID(),
      propertyId: input.propertyId,
      plate: input.plate,
      reason: input.reason.trim(),
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    g().blacklist.unshift(entry);
    return json(entry, 201);
  }),
  http.post("*/v1/owner/gate-blacklist/:entryId/actions/revoke", async ({ request, params }) => {
    const op = "owner.gateBlacklist.revoke";
    const ok = gateOwner(request, op, true);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["BlacklistRevokeDto"]>(request);
    record(op, request, input);
    if ((input.reason ?? "").trim().length < 5) return validation(op, "reason", "5–500 characters");
    const entry = g().blacklist.find((b) => b.id === params.entryId);
    if (!entry) return problem(op, "http.not_found");
    entry.revokedAt = new Date().toISOString();
    return json(entry);
  }),

  http.get("*/v1/owner/gate-invites", ({ request }) => {
    const ok = gateOwner(request, "owner.gateInvites.list");
    if (ok instanceof Response) return ok;
    const stateFilter = query(request).get("state");
    return json(
      g()
        .invites.filter((i) => !stateFilter || i.state === stateFilter)
        .map(({ token: _token, ...rest }) => (void _token, rest)),
    );
  }),
  ...(["approve", "reject"] as const).map((action) =>
    http.post(`*/v1/owner/gate-invites/:inviteId/actions/${action}`, async ({ request, params }) => {
      const op = `owner.gateInvites.${action}`;
      const ok = gateOwner(request, op, true);
      if (ok instanceof Response) return ok;
      const invite = g().invites.find((i) => i.id === params.inviteId);
      if (!invite) return problem(op, "http.not_found");
      const input = action === "reject" ? await body<Schemas["InviteDecisionDto"]>(request) : {};
      record(op, request, input);
      if (invite.state !== "pending_approval") return problem(op, "visit_invite.not_active");
      if (action === "approve") {
        invite.state = "active";
        invite.token = `gpv1.mock-${invite.id.slice(0, 8)}`;
      } else {
        invite.state = "rejected";
        invite.rejectReason = (input as Schemas["InviteDecisionDto"]).reason ?? null;
      }
      const { token: _token, ...rest } = invite;
      void _token;
      return json(rest);
    }),
  ),

  http.get("*/v1/owner/gate-visits", ({ request }) => {
    const op = "owner.gateVisits.list";
    const ok = gateOwner(request, op);
    if (ok instanceof Response) return ok;
    const bad = reasonOk(request, op);
    if (bad) return bad;
    remember("owner.gateVisits.read", request, { reason: query(request).get("reason") });
    sweep();
    const params = query(request);
    const q = (params.get("q") ?? "").trim();
    const from = params.get("from");
    const to = params.get("to");
    const rows = [...g().visits]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .filter((v) => !params.get("gateId") || v.gateId === params.get("gateId"))
      .filter((v) => !params.get("state") || v.state === params.get("state"))
      .filter((v) => !params.get("unitId") || v.unitId === params.get("unitId"))
      .filter((v) => !from || v.createdAt.slice(0, 10) >= from)
      .filter((v) => !to || v.createdAt.slice(0, 10) <= to)
      .filter(
        (v) =>
          !q ||
          [v.plate ? `${v.plate.category} ${v.plate.number}` : "", v.unitNo ?? "", v.visitorName ?? ""]
            .join(" ")
            .includes(q),
      )
      .map(listDto);
    return json(paged(rows, request));
  }),
  http.get("*/v1/owner/gate-visits/:visitId", ({ request, params }) => {
    const op = "owner.gateVisits.get";
    const ok = gateOwner(request, op);
    if (ok instanceof Response) return ok;
    const bad = reasonOk(request, op);
    if (bad) return bad;
    const v = g().visits.find((candidate) => candidate.id === params.visitId);
    if (!v) return problem(op, "http.not_found");
    const { propertyId: _property, callBackName: _cb, photoUrl: _photo, ...rest } = v;
    void _property;
    void _cb;
    void _photo;
    return json(rest satisfies Schemas["VisitLogDetailDto"]);
  }),

  http.get("*/v1/owner/incidents", ({ request }) => {
    const op = "owner.incidents.list";
    const ok = gateOwner(request, op);
    if (ok instanceof Response) return ok;
    const bad = reasonOk(request, op);
    if (bad) return bad;
    const stateFilter = query(request).get("state");
    return json(
      paged(
        g()
          .incidents.filter((i) => !stateFilter || i.state === stateFilter)
          .map(guardIncident),
        request,
      ),
    );
  }),
  http.get("*/v1/owner/incidents/:incidentId", ({ request, params }) => {
    const op = "owner.incidents.get";
    const ok = gateOwner(request, op);
    if (ok instanceof Response) return ok;
    const bad = reasonOk(request, op);
    if (bad) return bad;
    const incident = g().incidents.find((i) => i.id === params.incidentId);
    return incident ? json(incident) : problem(op, "http.not_found");
  }),
  ...(["acknowledge", "resolve"] as const).map((action) =>
    http.post(`*/v1/owner/incidents/:incidentId/actions/${action}`, async ({ request, params }) => {
      const op = `owner.incidents.${action}`;
      const ok = gateOwner(request, op, true);
      if (ok instanceof Response) return ok;
      const incident = g().incidents.find((i) => i.id === params.incidentId);
      if (!incident) return problem(op, "http.not_found");
      record(op, request, await body(request));
      return decideIncident(incident, action, "operator", op);
    }),
  ),

  http.get("*/v1/owner/gate-vehicles", ({ request }) => {
    const ok = gateOwner(request, "owner.gateVehicles.list");
    if (ok instanceof Response) return ok;
    const unitId = query(request).get("unitId");
    return json(g().vehicles.filter((v) => !unitId || v.unitId === unitId));
  }),
];

export const gateHandlers: HttpHandler[] = [...guardHandlers, ...ownerHandlers];

export function resetGateWorld(): void {
  dropGateStreams();
  state.gate = initialGateWorld();
}

/** Synchronous controls for the e2e suite and the screenshot runs (`/__mock/gate/*`, mocks/server.ts). */
export function gateControl(url: URL, method: string): { status: number; body: unknown } | null {
  if (!url.pathname.startsWith("/__mock/gate")) return null;
  const p = url.searchParams;
  switch (`${method} ${url.pathname}`) {
    case "POST /__mock/gate/reset":
      resetGateWorld();
      return { status: 200, body: { ok: true } };
    case "GET /__mock/gate":
      return {
        status: 200,
        body: {
          visits: g().visits,
          incidents: g().incidents,
          detections: g().detections,
          received: g().received,
          streams: streams.size,
          shifts: g().shifts,
        },
      };
    case "POST /__mock/gate/answer": {
      const answer = (p.get("answer") ?? "approve") as "approve" | "deny" | "call-me";
      const v = houseAnswers(p.get("visit"), answer);
      return v
        ? { status: 200, body: { id: v.id, state: v.state } }
        : { status: 404, body: { error: "no waiting visit" } };
    }
    case "POST /__mock/gate/sos": {
      const incident = raiseIncident({
        kind: (p.get("kind") ?? "fire") as Schemas["IncidentKind"],
        source: "resident_sos",
        unitNo: p.get("unit") ?? "99/12",
        note: p.get("note"),
      });
      return { status: 200, body: { id: incident.id } };
    }
    case "POST /__mock/gate/lpr": {
      const detection = plateRead({
        category: p.get("category") ?? "4กพ",
        number: p.get("number") ?? "2290",
        province: p.get("province") ?? "กรุงเทพมหานคร",
        confidence: p.get("confidence") ?? "0.82",
        match: (p.get("match") ?? "none") as Schemas["PlateMatch"],
      });
      return { status: 200, body: { id: detection.id } };
    }
    case "POST /__mock/gate/barrier":
      setBarrier((p.get("state") ?? "open") as Schemas["GateHwState"]);
      return { status: 200, body: { ok: true } };
    case "POST /__mock/gate/overstay": {
      const v =
        g().visits.find((candidate) => candidate.id === p.get("visit")) ??
        g().visits.find((c) => c.kind === "contractor" && c.state === "entered");
      if (!v) return { status: 404, body: { error: "no visit" } };
      visitEvent(v, "overstayed", "system", "gate.visit.overstayed");
      return { status: 200, body: { id: v.id } };
    }
    case "POST /__mock/gate/streams/drop":
      return { status: 200, body: { dropped: dropGateStreams() } };
    default:
      return { status: 404, body: { error: "unknown gate control" } };
  }
}

// Owner access to a tenant other than the juristic one never reaches here (gateOwner answers 404).
void authenticate;
