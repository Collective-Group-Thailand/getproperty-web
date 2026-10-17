import type { components } from "../src/lib/api/schema";
import type { StaffBuilding, StaffMeterPoint } from "../src/lib/api/pending";

type Schemas = components["schemas"];

/**
 * The staff PWA's world in the mock API (F4): two buildings of the sample tenant with floors, units,
 * electric and water meters (manual and IoT), last readings, inspections (a signed move-in, a move-out
 * to do, a move-in to do) and devices (a gateway online, a gateway and a meter device waiting to be
 * installed). Typed against the generated contract (and the contract-request shapes in
 * `src/lib/api/pending.ts`), so a contract change breaks the mocks at compile time.
 */

export const BUILDING_A = "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c";
export const BUILDING_B = "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b7d";

const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const FLOORS = {
  a2: { floorId: id("f1000000", 2), floorName: "ชั้น 2", level: 2, buildingId: BUILDING_A },
  a3: { floorId: id("f1000000", 3), floorName: "ชั้น 3", level: 3, buildingId: BUILDING_A },
  b1: { floorId: id("f2000000", 1), floorName: "ชั้น 1", level: 1, buildingId: BUILDING_B },
} as const;

export const UNITS = {
  a201: { id: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7d", no: "A-201", floor: FLOORS.a2 },
  a202: { id: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7e", no: "A-202", floor: FLOORS.a2 },
  a301: { id: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c80", no: "A-301", floor: FLOORS.a3 },
  b101: { id: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6d01", no: "B-101", floor: FLOORS.b1 },
} as const;
type UnitKey = keyof typeof UNITS;

export interface MockMeter {
  assetItemId: string;
  assignmentId: string;
  unit: UnitKey | null;
  utility: Schemas["Utility"];
  code: string;
  name: string;
  serial: string | null;
  initialReading: string;
  /** Last accepted reading before the round (register, photo document). */
  last: { id: string; register: string; readAt: string; source: Schemas["ReadingSource"]; photo: string | null } | null;
  /** Read by a gateway — listed in the round only while unhealthy. */
  iot: { health: Schemas["MeterHealth"] } | null;
  retired?: boolean;
}

export const PHOTO_LAST_A201 = id("d0c00000", 1);

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export function initialMeters(): MockMeter[] {
  return [
    {
      assetItemId: id("a1000000", 1),
      assignmentId: id("aa000000", 1),
      unit: "a201",
      utility: "electric",
      code: "E-A-201",
      name: "มิเตอร์ไฟ A-201",
      serial: "SN-E-201",
      initialReading: "0.000",
      last: {
        id: id("e0000000", 1),
        register: "12300.000",
        readAt: daysAgo(30),
        source: "ocr",
        photo: PHOTO_LAST_A201,
      },
      iot: null,
    },
    {
      assetItemId: id("a1000000", 2),
      assignmentId: id("aa000000", 2),
      unit: "a201",
      utility: "water",
      code: "W-A-201",
      name: "มิเตอร์น้ำ A-201",
      serial: null,
      initialReading: "0.000",
      last: { id: id("e0000000", 2), register: "845.200", readAt: daysAgo(30), source: "manual", photo: null },
      iot: null,
    },
    {
      assetItemId: id("a1000000", 3),
      assignmentId: id("aa000000", 3),
      unit: "a202",
      utility: "electric",
      code: "E-A-202",
      name: "มิเตอร์ไฟ A-202",
      serial: "SN-E-202",
      initialReading: "0.000",
      last: { id: id("e0000000", 3), register: "8800.500", readAt: daysAgo(31), source: "ocr", photo: null },
      iot: null,
    },
    {
      assetItemId: id("a1000000", 4),
      assignmentId: id("aa000000", 4),
      unit: "a301",
      utility: "electric",
      code: "E-A-301",
      name: "มิเตอร์ไฟ A-301",
      serial: "SN-E-301",
      initialReading: "0.000",
      last: { id: id("e0000000", 4), register: "4410.000", readAt: daysAgo(1), source: "iot", photo: null },
      iot: { health: "stale" },
    },
    {
      assetItemId: id("a1000000", 5),
      assignmentId: id("aa000000", 5),
      unit: "a301",
      utility: "water",
      code: "W-A-301",
      name: "มิเตอร์น้ำ A-301",
      serial: null,
      initialReading: "0.000",
      last: null,
      iot: null,
    },
    {
      assetItemId: id("a1000000", 6),
      assignmentId: id("aa000000", 6),
      unit: "b101",
      utility: "electric",
      code: "E-B-101",
      name: "มิเตอร์ไฟ B-101",
      serial: null,
      initialReading: "0.000",
      last: { id: id("e0000000", 6), register: "100.000", readAt: daysAgo(29), source: "manual", photo: null },
      iot: null,
    },
    {
      assetItemId: id("a1000000", 7),
      assignmentId: id("aa000000", 7),
      unit: "b101",
      utility: "water",
      code: "W-B-101",
      name: "มิเตอร์น้ำ B-101",
      serial: null,
      initialReading: "0.000",
      last: { id: id("e0000000", 7), register: "52.000", readAt: daysAgo(29), source: "manual", photo: null },
      iot: null,
    },
  ];
}

export const BUILDINGS: StaffBuilding[] = [
  { id: BUILDING_A, code: "A", name: "อาคาร A", floorsCount: 2, unitCount: 3 },
  { id: BUILDING_B, code: "B", name: "อาคาร B", floorsCount: 1, unitCount: 1 },
];

export function unitOf(meter: MockMeter) {
  return meter.unit ? UNITS[meter.unit] : null;
}

export function buildingOf(meter: MockMeter): string {
  return unitOf(meter)?.floor.buildingId ?? BUILDING_A;
}

/**
 * The billing period of the mock: the round window is open whatever the day the suite runs — the
 * cut-off three days from the mock's start, the window the seven days before it.
 */
const STARTED = Date.now();
export function period(): { periodKey: string; cutoffAt: string; windowStart: string } {
  const cutoff = new Date(STARTED + 3 * 86_400_000);
  const key = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    periodKey: key,
    cutoffAt: cutoff.toISOString(),
    windowStart: new Date(cutoff.getTime() - 7 * 86_400_000).toISOString(),
  };
}

// ---------------------------------------------------------------------------------------------------
// Inspections

export const LEASE_A201 = id("1ea50000", 1);
export const LEASE_A202 = id("1ea50000", 2);
export const INSPECTION_MOVE_IN_A201 = id("15e00000", 1);
export const INSPECTION_MOVE_OUT_A201 = id("15e00000", 2);
export const INSPECTION_MOVE_IN_A202 = id("15e00000", 3);
export const PHOTO_MOVE_IN_WALLS = id("d0c00000", 11);
export const PHOTO_MOVE_IN_DOOR = id("d0c00000", 12);

const TEMPLATE: { itemKey: string; label: string; area: string | null }[] = [
  { itemKey: "walls", label: "ผนังและสี", area: "room" },
  { itemKey: "floor", label: "พื้น", area: "room" },
  { itemKey: "door_lock", label: "ประตูและกุญแจ", area: "room" },
  { itemKey: "bathroom", label: "ห้องน้ำและสุขภัณฑ์", area: "bathroom" },
  { itemKey: "asset:aircon", label: "เครื่องปรับอากาศ", area: "room" },
  { itemKey: "meter:electric", label: "มิเตอร์ไฟฟ้า", area: null },
];

function items(prefix: number, filled: boolean): Schemas["InspectionItemDto"][] {
  return TEMPLATE.map((line, index) => ({
    id: id(`17e${prefix}0000`, index + 1),
    itemKey: line.itemKey,
    label: line.label,
    area: line.area,
    condition: filled ? (line.itemKey === "walls" ? "fair" : "good") : null,
    notes: filled && line.itemKey === "walls" ? "รอยตะปูเล็กน้อยข้างหน้าต่าง" : null,
    photoDocumentIds:
      filled && line.itemKey === "walls"
        ? [PHOTO_MOVE_IN_WALLS]
        : filled && line.itemKey === "door_lock"
          ? [PHOTO_MOVE_IN_DOOR]
          : [],
    meterRegister: filled && line.itemKey === "meter:electric" ? "9800.000" : null,
  }));
}

export function initialInspections(): Schemas["InspectionDto"][] {
  return [
    {
      id: INSPECTION_MOVE_IN_A201,
      type: "move_in",
      status: "signed",
      unitId: UNITS.a201.id,
      unitNo: UNITS.a201.no,
      leaseId: LEASE_A201,
      scheduledFor: daysAgo(365),
      startedAt: daysAgo(365),
      completedAt: daysAgo(365),
      reportNumber: "INS-2025-00012",
      staffSigned: true,
      residentSigned: true,
      notes: null,
      items: items(1, true),
      nextActions: [],
      version: 4,
    },
    {
      id: INSPECTION_MOVE_OUT_A201,
      type: "move_out",
      status: "scheduled",
      unitId: UNITS.a201.id,
      unitNo: UNITS.a201.no,
      leaseId: LEASE_A201,
      scheduledFor: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      reportNumber: null,
      staffSigned: false,
      residentSigned: false,
      notes: null,
      items: items(2, false),
      nextActions: ["complete"],
      version: 1,
    },
    {
      id: INSPECTION_MOVE_IN_A202,
      type: "move_in",
      status: "scheduled",
      unitId: UNITS.a202.id,
      unitNo: UNITS.a202.no,
      leaseId: LEASE_A202,
      scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
      startedAt: null,
      completedAt: null,
      reportNumber: null,
      staffSigned: false,
      residentSigned: false,
      notes: null,
      items: items(3, false),
      nextActions: ["complete"],
      version: 1,
    },
  ];
}

// ---------------------------------------------------------------------------------------------------
// Devices

export const GATEWAY_ONLINE = "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e5f";
export const GATEWAY_NEW = "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e60";
export const METER_DEVICE_NEW = "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e70";
export const METER_DEVICE_ONLINE = "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e71";
export const GATEWAY_B_ONLINE = "2f6c1d7e-9a3b-4c5d-8e7f-0a1b2c3d4e61";

function device(
  partial: Partial<Schemas["FleetDeviceDto"]> & Pick<Schemas["FleetDeviceDto"], "id" | "serial" | "kind">,
) {
  return {
    model: partial.kind === "gateway" ? "rpi-cm4" : "SDM120",
    vendor: partial.kind === "gateway" ? "Raspberry Pi" : "Eastron",
    driver: partial.kind === "gateway" ? null : "eastron_sdm120",
    ownership: "platform_haas",
    status: "assigned",
    tenantId: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11",
    buildingId: BUILDING_A,
    assetItemId: null,
    gatewayDeviceId: null,
    firmwareVersion: null,
    arch: null,
    otaRing: "all",
    lastSeenAt: null,
    configAppliedVersion: null,
    meters: 0,
    health: null,
    nextActions: [],
    version: 1,
    ...partial,
  } satisfies Schemas["FleetDeviceDto"];
}

export function initialDevices(): Schemas["FleetDeviceDto"][] {
  return [
    device({
      id: GATEWAY_ONLINE,
      serial: "GP-GW-000123",
      kind: "gateway",
      status: "online",
      firmwareVersion: "0.3.0",
      arch: "arm64",
      lastSeenAt: new Date().toISOString(),
      configAppliedVersion: 4,
      meters: 1,
      health: {
        lastHeartbeatAt: new Date().toISOString(),
        agentVersion: "0.3.0",
        configVersion: 4,
        bufferedReadings: 0,
        link: "ethernet",
        rssi: null,
        missedHeartbeats: 0,
        ingestLagMs: 850,
      },
      nextActions: ["read-now", "restart", "identify", "upload-logs"],
    }),
    device({
      id: GATEWAY_B_ONLINE,
      serial: "GP-GW-000125",
      kind: "gateway",
      buildingId: BUILDING_B,
      status: "online",
      firmwareVersion: "0.3.0",
      arch: "arm64",
      lastSeenAt: new Date().toISOString(),
      configAppliedVersion: 2,
      health: {
        lastHeartbeatAt: new Date().toISOString(),
        agentVersion: "0.3.0",
        configVersion: 2,
        bufferedReadings: 0,
        link: "wifi",
        rssi: -61,
        missedHeartbeats: 0,
        ingestLagMs: 900,
      },
      nextActions: ["read-now", "restart", "identify", "upload-logs"],
    }),
    device({ id: GATEWAY_NEW, serial: "GP-GW-000124", kind: "gateway", buildingId: BUILDING_B }),
    device({
      id: METER_DEVICE_ONLINE,
      serial: "SDM120-0041",
      kind: "electric_meter",
      status: "online",
      assetItemId: id("a1000000", 4),
      gatewayDeviceId: GATEWAY_ONLINE,
    }),
    device({ id: METER_DEVICE_NEW, serial: "SDM120-0042", kind: "electric_meter", buildingId: BUILDING_B }),
  ];
}

export interface MockChannel {
  id: string;
  meterAssetItemId: string;
  meterDeviceId: string | null;
  gatewayDeviceId: string;
  busId: string;
  busType: Schemas["BusType"];
  address: number | null;
  pin: number | null;
  driver: string;
  validFrom: string;
  validTo: string | null;
  unboundReason: string | null;
}

export function initialChannels(): MockChannel[] {
  return [
    {
      id: id("c4a00000", 1),
      meterAssetItemId: id("a1000000", 4),
      meterDeviceId: METER_DEVICE_ONLINE,
      gatewayDeviceId: GATEWAY_ONLINE,
      busId: "bus1",
      busType: "modbus_rtu",
      address: 11,
      pin: null,
      driver: "eastron_sdm120",
      validFrom: daysAgo(90),
      validTo: null,
      unboundReason: null,
    },
  ];
}

/** The meter points of a building with their open channel (contract request shape). */
export function meterPoints(
  meters: MockMeter[],
  channels: MockChannel[],
  devices: Schemas["FleetDeviceDto"][],
  buildingId: string,
): StaffMeterPoint[] {
  return meters
    .filter((meter) => !meter.retired && buildingOf(meter) === buildingId)
    .map((meter) => {
      const unit = unitOf(meter);
      const channel = channels.find((c) => c.meterAssetItemId === meter.assetItemId && c.validTo === null);
      const meterDevice = channel?.meterDeviceId ? devices.find((d) => d.id === channel.meterDeviceId) : undefined;
      return {
        id: meter.assignmentId,
        assetItemId: meter.assetItemId,
        unitId: unit?.id ?? null,
        unitNo: unit?.no ?? null,
        floorName: unit?.floor.floorName ?? null,
        purpose: "unit",
        utility: meter.utility,
        code: meter.code,
        commonAreaLabel: null,
        name: meter.name,
        serial: meter.serial,
        initialReading: meter.initialReading,
        multiplier: "1.000000",
        validFrom: daysAgo(400),
        validTo: null,
        lastRegister: meter.last?.register ?? null,
        channel: channel
          ? {
              channelId: channel.id,
              gatewayDeviceId: channel.gatewayDeviceId,
              meterDeviceId: channel.meterDeviceId,
              meterDeviceSerial: meterDevice?.serial ?? null,
              busId: channel.busId,
              busType: channel.busType,
              address: channel.address,
              pin: channel.pin,
            }
          : null,
      } satisfies StaffMeterPoint;
    });
}
