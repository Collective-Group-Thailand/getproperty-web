import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { period } from "../staff-world";
import {
  body,
  etagged,
  idempotent,
  json,
  mutating,
  notFound,
  noContent,
  owner,
  paged,
  problem,
  query,
  stale,
  validation,
} from "./support";
import { iso, type OwnerUnit } from "./world";

type Schemas = components["schemas"];

/**
 * Asset core of the owner surface (F2 2.1): properties, buildings, floors, units, the unit board,
 * unit profiles, the two-step Excel import (D-170), utility accounts, settings and owner files.
 */

const w = () => state.owner;
const UNIT_NO = /^[A-Za-z0-9\-_./]{1,20}$/;

function unitResponse(unit: OwnerUnit): Schemas["UnitDto"] {
  const dto: Partial<OwnerUnit> = { ...unit };
  delete dto.lesseePartyId;
  return dto as Schemas["UnitDto"];
}

function recount() {
  for (const building of w().buildings) {
    building.unitCount = w().units.filter((unit) => unit.buildingId === building.id).length;
  }
  for (const floor of w().floors) floor.unitCount = w().units.filter((unit) => unit.floorId === floor.id).length;
}

/** Worst meter health of a unit, from the staff world's meters (B3.4). */
function unitMeters(unitId: string): Schemas["BoardMeterDto"][] {
  return state.staff.meters
    .filter((meter) => !meter.retired && meter.unit !== null && unitIdOf(meter.unit) === unitId)
    .map((meter) => ({ code: meter.code, utility: meter.utility, health: meter.iot ? meter.iot.health : "no_device" }));
}

const STAFF_UNIT_IDS: Record<string, string> = {
  a201: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7d",
  a202: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c7e",
  a301: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6c80",
  b101: "6d9f3b2a-7c4e-4f8b-8a1d-2e3f4a5b6d01",
};
const unitIdOf = (key: string) => STAFF_UNIT_IDS[key];

const HEALTH_ORDER = ["silent", "stale", "unknown", "no_device", "ok"];

function balanceOf(unitId: string): string | null {
  const open = w().invoices.filter(
    (invoice) => invoice.unitId === unitId && ["issued", "partially_paid", "overdue"].includes(invoice.status),
  );
  if (open.length === 0) return "0.00";
  let satang = 0;
  for (const invoice of open) {
    const [whole, fraction = "00"] = invoice.balance.split(".");
    satang += Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
  }
  return `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, "0")}`;
}

function boardOf(buildingId: string): Schemas["BoardDto"] {
  const building = w().buildings.find((candidate) => candidate.id === buildingId)!;
  const units = w().units.filter((unit) => unit.buildingId === buildingId);
  const floors = w()
    .floors.filter((floor) => floor.buildingId === buildingId)
    .sort((a, b) => b.level - a.level);
  const card = (unit: OwnerUnit): Schemas["BoardUnitDto"] => {
    const lease = w().leases.find(
      (candidate) =>
        candidate.unitId === unit.id &&
        ["active", "notice_given", "ending", "pending_signature"].includes(candidate.status),
    );
    const party = unit.lesseePartyId ? w().parties.find((candidate) => candidate.id === unit.lesseePartyId) : undefined;
    const meters = unitMeters(unit.id);
    const worst = meters
      .map((meter) => meter.health ?? "unknown")
      .sort((a, b) => HEALTH_ORDER.indexOf(a) - HEALTH_ORDER.indexOf(b))[0];
    return {
      id: unit.id,
      unitNo: unit.unitNo,
      status: unit.status,
      statusReason: unit.statusReason,
      type: unit.type,
      baseRent: unit.baseRent,
      profileName: unit.unitProfileName,
      balance: unit.status === "occupied" || lease ? balanceOf(unit.id) : null,
      leaseId: lease?.id ?? null,
      leaseStatus: lease?.status ?? null,
      leaseEndDate: lease?.endDate ?? null,
      lessee: party ? { partyId: party.id, displayName: party.displayName } : null,
      meterHealth: worst ?? null,
      meters,
    };
  };
  const summary = {
    total: units.length,
    vacant: units.filter((unit) => unit.status === "vacant").length,
    reserved: units.filter((unit) => unit.status === "reserved").length,
    occupied: units.filter((unit) => unit.status === "occupied").length,
    maintenance: units.filter((unit) => unit.status === "maintenance").length,
    inactive: units.filter((unit) => unit.status === "inactive").length,
  };
  const active = summary.total - summary.inactive;
  return {
    building: { id: building.id, code: building.code, name: building.name },
    generatedAt: iso(),
    summary: { ...summary, occupancyPct: active ? ((summary.occupied / active) * 100).toFixed(1) : "0.0" },
    floors: [
      ...floors.map((floor) => ({
        id: floor.id,
        level: floor.level,
        name: floor.name,
        units: units
          .filter((unit) => unit.floorId === floor.id)
          .sort((a, b) => a.unitNo.localeCompare(b.unitNo))
          .map(card),
      })),
      ...(units.some((unit) => !unit.floorId)
        ? [{ id: null, level: null, name: "", units: units.filter((unit) => !unit.floorId).map(card) }]
        : []),
    ],
  };
}

function patternUnitNo(pattern: string, building: Schemas["BuildingDto"], level: number, sequence: number): string {
  return pattern
    .replaceAll("{building}", building.code)
    .replaceAll("{ff}", String(level).padStart(2, "0"))
    .replaceAll("{floor}", String(level))
    .replace(/\{(n+)\}/g, (_, ns: string) => String(sequence).padStart(ns.length, "0"));
}

// ---------------------------------------------------------------------------------------------------
// The fake xlsx parser: the "file" is a CSV-like text the e2e suite uploads (`unitNo,floor,type,rent,area,profile,notes`).

function parseImport(buildingId: string, text: string, createFloors: boolean): Schemas["UnitImportPreviewDto"] {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  const data = rows[0]?.toLowerCase().startsWith("unitno") ? rows.slice(1) : rows;
  const floorsToCreate = new Set<number>();
  const seen = new Set<string>();
  const result: Schemas["ImportRowDto"][] = data.map((row, index) => {
    const [unitNo = "", floor = "", type = "room", rent = "", area = "", profile = "", notes = ""] = row
      .split(",")
      .map((cell) => cell.trim());
    const errors: Schemas["ImportRowErrorDto"][] = [];
    if (!UNIT_NO.test(unitNo)) errors.push({ column: "unitNo", code: "invalid", message: "เลขห้องไม่ถูกต้อง" });
    if (seen.has(unitNo)) errors.push({ column: "unitNo", code: "duplicate", message: "เลขห้องซ้ำในไฟล์" });
    seen.add(unitNo);
    const level = floor === "" ? null : Number(floor);
    if (floor !== "" && !Number.isInteger(level))
      errors.push({ column: "floor", code: "invalid", message: "ชั้นต้องเป็นตัวเลข" });
    if (rent && !/^\d+(\.\d{1,2})?$/.test(rent))
      errors.push({ column: "baseRent", code: "invalid", message: "ค่าเช่าต้องเป็นจำนวนเงิน" });
    if (!["room", "condo_unit", "house", "shop", "parking"].includes(type))
      errors.push({ column: "type", code: "invalid", message: "ประเภทห้องไม่ถูกต้อง" });
    const floorExists = level === null || w().floors.some((f) => f.buildingId === buildingId && f.level === level);
    if (!floorExists) {
      if (createFloors) floorsToCreate.add(level!);
      else errors.push({ column: "floor", code: "floor_missing", message: "ยังไม่มีชั้นนี้ในอาคาร" });
    }
    const existing = w().units.find((unit) => unit.buildingId === buildingId && unit.unitNo === unitNo);
    const baseRent = rent ? Number(rent).toFixed(2) : null;
    const action: Schemas["ImportAction"] = errors.length
      ? "error"
      : !existing
        ? "create"
        : existing.baseRent === baseRent && (existing.notes ?? "") === notes
          ? "unchanged"
          : "update";
    return {
      row: index + 2,
      unitNo,
      floorLevel: level,
      type: (["room", "condo_unit", "house", "shop", "parking"].includes(type) ? type : "room") as Schemas["UnitType"],
      baseRent,
      areaSqm: area ? Number(area).toFixed(2) : null,
      unitProfile: profile || null,
      notes: notes || null,
      createsFloor: !floorExists && createFloors,
      action,
      errors,
    };
  });
  return {
    buildingId,
    fileId: "",
    previewToken: "",
    rows: result,
    summary: {
      create: result.filter((row) => row.action === "create").length,
      update: result.filter((row) => row.action === "update").length,
      unchanged: result.filter((row) => row.action === "unchanged").length,
      error: result.filter((row) => row.action === "error").length,
      floorsToCreate: [...floorsToCreate].sort((a, b) => a - b),
    },
  };
}

function fileText(fileId: string): string | null {
  const stored = state.staff.files.get(fileId);
  if (!stored?.bytes) return null;
  return new TextDecoder().decode(stored.bytes);
}

export const assetHandlers: HttpHandler[] = [
  // Properties
  http.get("*/v1/owner/properties", ({ request }) => {
    const ok = owner(request, "owner.properties.list");
    if (ok instanceof Response) return ok;
    return json(ok.own ? w().properties : []);
  }),
  http.post("*/v1/owner/properties", async ({ request }) => {
    const op = "owner.properties.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["PropertyCreateDto"]>(request);
    if (!input.name || !input.code || !/^[A-Za-z0-9_-]{1,20}$/.test(input.code))
      return validation(op, "code", "letters, digits, - and _ (max 20)");
    if (w().properties.some((property) => property.code === input.code)) return problem(op, "asset.duplicate");
    const property: Schemas["PropertyDto"] = {
      id: crypto.randomUUID(),
      code: input.code,
      name: input.name,
      address: input.address ?? null,
      provinceCode: input.provinceCode ?? null,
      status: "active",
      createdAt: iso(),
      version: 1,
    };
    w().properties.push(property);
    return json(property, 201);
  }),
  http.get("*/v1/owner/properties/:propertyId", ({ request, params }) => {
    const op = "owner.properties.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const property = ok.own ? w().properties.find((candidate) => candidate.id === params.propertyId) : undefined;
    return property ? etagged(property) : notFound(op);
  }),

  // Buildings
  http.get("*/v1/owner/buildings", ({ request }) => {
    const ok = owner(request, "owner.buildings.list");
    if (ok instanceof Response) return ok;
    const propertyId = query(request).get("propertyId");
    return json(ok.own ? w().buildings.filter((building) => !propertyId || building.propertyId === propertyId) : []);
  }),
  http.post("*/v1/owner/buildings", async ({ request }) => {
    const op = "owner.buildings.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["BuildingCreateDto"]>(request);
    if (!input.name || !input.code) return validation(op, "code", "code and name are required");
    if (!w().properties.some((property) => property.id === input.propertyId)) return notFound(op);
    if (w().buildings.some((b) => b.propertyId === input.propertyId && b.code === input.code))
      return problem(op, "asset.duplicate");
    const building: Schemas["BuildingDto"] = {
      id: crypto.randomUUID(),
      access: "operator",
      code: input.code,
      name: input.name,
      type: input.type,
      propertyId: input.propertyId,
      floorsCount: input.floorsCount ?? null,
      operatorTenantId: ok.tenantId,
      ownerTenantId: ok.tenantId,
      status: "active",
      unitCount: 0,
      version: 1,
    };
    w().buildings.push(building);
    return json(building, 201);
  }),
  http.get("*/v1/owner/buildings/:buildingId", ({ request, params }) => {
    const op = "owner.buildings.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const building = ok.own ? w().buildings.find((candidate) => candidate.id === params.buildingId) : undefined;
    return building ? etagged(building) : notFound(op);
  }),
  http.patch("*/v1/owner/buildings/:buildingId", async ({ request, params }) => {
    const op = "owner.buildings.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const building = ok.own ? w().buildings.find((candidate) => candidate.id === params.buildingId) : undefined;
    if (!building) return notFound(op);
    if (!request.headers.get("if-match")) return problem(op, "concurrency.precondition_required");
    if (stale(request, building)) return problem(op, "concurrency.stale");
    Object.assign(building, await body<Schemas["BuildingUpdateDto"]>(request));
    building.version += 1;
    return etagged(building);
  }),
  http.get("*/v1/owner/buildings/:buildingId/board", ({ request, params }) => {
    const op = "owner.unitBoard.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const building = ok.own ? w().buildings.find((candidate) => candidate.id === params.buildingId) : undefined;
    return building ? json(boardOf(building.id)) : notFound(op);
  }),

  // Floors
  http.get("*/v1/owner/buildings/:buildingId/floors", ({ request, params }) => {
    const op = "owner.floors.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    return json(
      w()
        .floors.filter((floor) => floor.buildingId === params.buildingId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }),
  http.post("*/v1/owner/buildings/:buildingId/floors", async ({ request, params }) => {
    const op = "owner.floors.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    const input = await body<Schemas["FloorCreateDto"]>(request);
    if (!input.name || !Number.isInteger(input.level)) return validation(op, "level", "level and name are required");
    if (w().floors.some((floor) => floor.buildingId === params.buildingId && floor.level === input.level))
      return problem(op, "asset.duplicate");
    const floor: Schemas["FloorDto"] = {
      id: crypto.randomUUID(),
      buildingId: String(params.buildingId),
      level: input.level,
      name: input.name,
      sortOrder: input.sortOrder ?? input.level,
      unitCount: 0,
    };
    w().floors.push(floor);
    return json(floor, 201);
  }),

  // Units
  http.get("*/v1/owner/units", ({ request }) => {
    const ok = owner(request, "owner.units.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    let units = ok.own ? w().units : [];
    units = units.filter(
      (unit) =>
        (!params.get("buildingId") || unit.buildingId === params.get("buildingId")) &&
        (!params.get("floorId") || unit.floorId === params.get("floorId")) &&
        (!params.get("status") || unit.status === params.get("status")) &&
        (!q || unit.unitNo.toLowerCase().includes(q)),
    );
    const sort = params.get("sort") ?? "unitNo";
    const order = params.get("order") === "desc" ? -1 : 1;
    units = [...units].sort((a, b) => {
      const key = sort as keyof OwnerUnit;
      return String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "th", { numeric: true }) * order;
    });
    const page = paged(units.map(unitResponse), request);
    return json(page);
  }),
  http.get("*/v1/owner/units/count", ({ request }) => {
    const ok = owner(request, "owner.units.count");
    if (ok instanceof Response) return ok;
    const units = ok.own ? w().units : [];
    const by = (status: Schemas["UnitStatus"]) => units.filter((unit) => unit.status === status).length;
    return json({
      billable: units.filter((unit) => unit.status !== "inactive").length,
      inactive: by("inactive"),
      byStatus: {
        vacant: by("vacant"),
        reserved: by("reserved"),
        occupied: by("occupied"),
        maintenance: by("maintenance"),
        inactive: by("inactive"),
      },
      countedAt: iso(),
    } satisfies Schemas["UnitCountDto"]);
  }),
  http.post("*/v1/owner/units", async ({ request }) => {
    const op = "owner.units.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["UnitCreateDto"]>(request);
    const building = w().buildings.find((candidate) => candidate.id === input.buildingId);
    if (!ok.own || !building) return notFound(op);
    if (!UNIT_NO.test(input.unitNo ?? "")) return validation(op, "unitNo", "letters, digits, - _ . / (max 20)");
    if (w().units.some((unit) => unit.buildingId === building.id && unit.unitNo === input.unitNo))
      return problem(op, "asset.duplicate");
    const floor = w().floors.find((candidate) => candidate.id === input.floorId);
    const profile = w().profiles.find((candidate) => candidate.id === input.unitProfileId);
    const unit: OwnerUnit = {
      id: crypto.randomUUID(),
      unitNo: input.unitNo,
      buildingId: building.id,
      propertyId: building.propertyId,
      floorId: floor?.id ?? null,
      floorLevel: floor?.level ?? null,
      type: input.type ?? "room",
      status: "vacant",
      statusReason: null,
      statusChangedAt: iso(),
      areaSqm: input.areaSqm ?? profile?.areaSqm ?? null,
      baseRent: input.baseRent ?? profile?.defaultRent ?? null,
      currency: "THB",
      currentLeaseId: null,
      notes: input.notes ?? null,
      ownershipRatio: null,
      unitProfileId: profile?.id ?? null,
      unitProfileName: profile?.name ?? null,
      version: 1,
      nextActions: ["set-status"],
      lesseePartyId: null,
    };
    w().units.push(unit);
    recount();
    return etagged(unitResponse(unit), 201);
  }),
  http.post("*/v1/owner/buildings/:buildingId/units/bulk", async ({ request, params }) => {
    const op = "owner.units.bulkCreate";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const building = ok.own ? w().buildings.find((candidate) => candidate.id === params.buildingId) : undefined;
    if (!building) return notFound(op);
    const input = await body<Schemas["UnitBulkCreateDto"]>(request);
    if (!input.floorIds?.length) return validation(op, "floorIds", "choose at least one floor");
    if (!Number.isInteger(input.countPerFloor) || input.countPerFloor < 1 || input.countPerFloor > 200)
      return validation(op, "countPerFloor", "1–200 units per floor");
    const pattern = input.pattern ?? "{building}-{floor}{nn}";
    const profile = w().profiles.find((candidate) => candidate.id === input.unitProfileId);
    const created: OwnerUnit[] = [];
    for (const floorId of input.floorIds) {
      const floor = w().floors.find((candidate) => candidate.id === floorId && candidate.buildingId === building.id);
      if (!floor) return validation(op, "floorIds", "unknown floor");
      for (let n = 0; n < input.countPerFloor; n += 1) {
        const unitNo = patternUnitNo(pattern, building, floor.level, (input.start ?? 1) + n);
        if (
          w().units.some((unit) => unit.buildingId === building.id && unit.unitNo === unitNo) ||
          created.some((unit) => unit.unitNo === unitNo)
        )
          return problem(op, "asset.duplicate", { detail: `ห้อง ${unitNo} มีอยู่แล้ว` });
        created.push({
          id: crypto.randomUUID(),
          unitNo,
          buildingId: building.id,
          propertyId: building.propertyId,
          floorId: floor.id,
          floorLevel: floor.level,
          type: input.type ?? "room",
          status: "vacant",
          statusReason: null,
          statusChangedAt: iso(),
          areaSqm: input.areaSqm ?? profile?.areaSqm ?? null,
          baseRent: input.baseRent ?? profile?.defaultRent ?? null,
          currency: "THB",
          currentLeaseId: null,
          notes: null,
          ownershipRatio: null,
          unitProfileId: profile?.id ?? null,
          unitProfileName: profile?.name ?? null,
          version: 1,
          nextActions: ["set-status"],
          lesseePartyId: null,
        });
      }
    }
    w().units.push(...created);
    recount();
    return json(created.map(unitResponse), 201);
  }),
  http.get("*/v1/owner/units/:unitId", ({ request, params }) => {
    const op = "owner.units.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const unit = ok.own ? w().units.find((candidate) => candidate.id === params.unitId) : undefined;
    return unit ? etagged(unitResponse(unit)) : notFound(op);
  }),
  http.patch("*/v1/owner/units/:unitId", async ({ request, params }) => {
    const op = "owner.units.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const unit = ok.own ? w().units.find((candidate) => candidate.id === params.unitId) : undefined;
    if (!unit) return notFound(op);
    if (!request.headers.get("if-match")) return problem(op, "concurrency.precondition_required");
    if (stale(request, unit)) return problem(op, "concurrency.stale");
    const input = await body<Schemas["UnitUpdateDto"]>(request);
    if (input.unitNo !== undefined && !UNIT_NO.test(input.unitNo))
      return validation(op, "unitNo", "invalid unit number");
    Object.assign(unit, input);
    if (input.unitProfileId !== undefined) {
      unit.unitProfileName = w().profiles.find((profile) => profile.id === input.unitProfileId)?.name ?? null;
    }
    unit.version += 1;
    return etagged(unitResponse(unit));
  }),
  http.post("*/v1/owner/units/:unitId/actions/set-status", async ({ request, params }) => {
    const op = "owner.units.setStatus";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const unit = ok.own ? w().units.find((candidate) => candidate.id === params.unitId) : undefined;
    if (!unit) return notFound(op);
    const input = await body<Schemas["UnitStatusChangeDto"]>(request);
    if (!input.reason?.trim()) return validation(op, "reason", "a reason is required");
    // D-171: vacant ↔ inactive | maintenance only.
    const allowed =
      unit.status === "vacant"
        ? ["inactive", "maintenance"]
        : ["inactive", "maintenance"].includes(unit.status)
          ? ["vacant"]
          : [];
    if (!allowed.includes(input.status)) return problem(op, "unit.invalid_status_transition");
    unit.status = input.status;
    unit.statusReason = input.reason;
    unit.statusChangedAt = iso();
    unit.version += 1;
    return json(unitResponse(unit));
  }),
  http.get("*/v1/owner/units/:unitId/meters", ({ request, params }) => {
    const op = "owner.meters.listForUnit";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const unit = ok.own ? w().units.find((candidate) => candidate.id === params.unitId) : undefined;
    if (!unit) return notFound(op);
    return json(
      state.staff.meters
        .filter((meter) => !meter.retired && meter.unit && unitIdOf(meter.unit) === unit.id)
        .map((meter): Schemas["MeterDto"] => ({
          id: meter.assignmentId,
          assetItemId: meter.assetItemId,
          code: meter.code,
          name: meter.name,
          utility: meter.utility,
          purpose: "unit",
          serial: meter.serial,
          initialReading: meter.initialReading,
          multiplier: "1",
          unitId: unit.id,
          unitNo: unit.unitNo,
          commonAreaLabel: null,
          validFrom: iso(-400),
          validTo: null,
        })),
    );
  }),

  // Unit profiles
  http.get("*/v1/owner/buildings/:buildingId/unit-profiles", ({ request, params }) => {
    const op = "owner.unitProfiles.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    return json(w().profiles.filter((profile) => profile.buildingId === params.buildingId));
  }),
  http.post("*/v1/owner/buildings/:buildingId/unit-profiles", async ({ request, params }) => {
    const op = "owner.unitProfiles.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    const input = await body<Schemas["UnitProfileCreateDto"]>(request);
    if (!input.name?.trim()) return validation(op, "name", "a name is required");
    if (!/^\d+(\.\d{1,2})?$/.test(input.defaultRent ?? ""))
      return validation(op, "defaultRent", "an amount like 4500.00");
    for (const [index, lineDefault] of (input.defaultLeaseLines ?? []).entries()) {
      if (!/^\d+(\.\d{1,2})?$/.test(lineDefault.amount))
        return validation(op, `defaultLeaseLines[${index}].amount`, "an amount like 300.00");
    }
    if (w().profiles.some((profile) => profile.buildingId === params.buildingId && profile.name === input.name))
      return problem(op, "asset.duplicate");
    const profile: Schemas["UnitProfileDto"] = {
      id: crypto.randomUUID(),
      buildingId: String(params.buildingId),
      name: input.name,
      areaSqm: input.areaSqm ?? null,
      defaultRent: Number(input.defaultRent).toFixed(2),
      defaultDepositMonths: input.defaultDepositMonths ?? "1",
      defaultAdvanceRentMonths: input.defaultAdvanceRentMonths ?? "1",
      defaultLeaseLines: (input.defaultLeaseLines ?? []).map((l) => ({ ...l, amount: Number(l.amount).toFixed(2) })),
      inspectionTemplateId: null,
      version: 1,
    };
    w().profiles.push(profile);
    return etagged(profile, 201);
  }),
  http.patch("*/v1/owner/unit-profiles/:unitProfileId", async ({ request, params }) => {
    const op = "owner.unitProfiles.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const profile = ok.own ? w().profiles.find((candidate) => candidate.id === params.unitProfileId) : undefined;
    if (!profile) return notFound(op);
    if (!request.headers.get("if-match")) return problem(op, "concurrency.precondition_required");
    if (stale(request, profile)) return problem(op, "concurrency.stale");
    const input = await body<Schemas["UnitProfileUpdateDto"]>(request);
    if (input.defaultRent !== undefined && !/^\d+(\.\d{1,2})?$/.test(input.defaultRent))
      return validation(op, "defaultRent", "an amount like 4500.00");
    Object.assign(profile, input);
    profile.version += 1;
    for (const unit of w().units) if (unit.unitProfileId === profile.id) unit.unitProfileName = profile.name;
    return etagged(profile);
  }),
  http.delete("*/v1/owner/unit-profiles/:unitProfileId", ({ request, params }) => {
    const op = "owner.unitProfiles.remove";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const index = ok.own ? w().profiles.findIndex((candidate) => candidate.id === params.unitProfileId) : -1;
    if (index < 0) return notFound(op);
    w().profiles.splice(index, 1);
    return noContent();
  }),

  // Excel import (D-170)
  http.get("*/v1/owner/buildings/:buildingId/unit-imports/template", ({ request, params }) => {
    const op = "owner.unitImports.template";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    return new Response("unitNo,floor,type,baseRent,areaSqm,unitProfile,notes\n", {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="units-template.xlsx"',
      },
    });
  }),
  http.get("*/v1/owner/buildings/:buildingId/units/export", ({ request, params }) => {
    const op = "owner.unitImports.export";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    const rows = w()
      .units.filter((unit) => unit.buildingId === params.buildingId)
      .map((unit) =>
        [
          unit.unitNo,
          unit.floorLevel ?? "",
          unit.type,
          unit.baseRent ?? "",
          unit.areaSqm ?? "",
          unit.unitProfileName ?? "",
          unit.notes ?? "",
        ].join(","),
      );
    return new Response(`unitNo,floor,type,baseRent,areaSqm,unitProfile,notes\n${rows.join("\n")}\n`, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="units.xlsx"',
      },
    });
  }),
  http.post("*/v1/owner/buildings/:buildingId/unit-imports/actions/preview", async ({ request, params }) => {
    const op = "owner.unitImports.preview";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    const input = await body<Schemas["UnitImportPreviewRequestDto"]>(request);
    const text = fileText(input.fileId);
    if (text === null) return problem(op, "document.not_uploaded");
    const preview = parseImport(String(params.buildingId), text, input.createFloors ?? false);
    preview.fileId = input.fileId;
    preview.previewToken = `pv-${crypto.randomUUID().slice(0, 8)}`;
    w().imports.set(preview.previewToken, { buildingId: String(params.buildingId), fileId: input.fileId, preview });
    return json(preview);
  }),
  http.post("*/v1/owner/buildings/:buildingId/unit-imports/actions/commit", async ({ request, params }) => {
    const op = "owner.unitImports.commit";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["UnitImportCommitDto"];
      const plan = w().imports.get(input.previewToken);
      if (!plan || plan.fileId !== input.fileId || plan.buildingId !== params.buildingId)
        return problem(op, "import.preview_stale");
      if (plan.preview.summary.error > 0) return problem(op, "import.invalid_rows");
      const building = w().buildings.find((b) => b.id === params.buildingId)!;
      for (const level of plan.preview.summary.floorsToCreate) {
        w().floors.push({
          id: crypto.randomUUID(),
          buildingId: building.id,
          level,
          name: `ชั้น ${level}`,
          sortOrder: level,
          unitCount: 0,
        });
      }
      for (const row of plan.preview.rows) {
        const floor = w().floors.find((f) => f.buildingId === building.id && f.level === row.floorLevel);
        const existing = w().units.find((unit) => unit.buildingId === building.id && unit.unitNo === row.unitNo);
        if (row.action === "update" && existing) {
          Object.assign(existing, {
            baseRent: row.baseRent,
            areaSqm: row.areaSqm,
            notes: row.notes,
            version: existing.version + 1,
          });
        } else if (row.action === "create") {
          w().units.push({
            id: crypto.randomUUID(),
            unitNo: row.unitNo,
            buildingId: building.id,
            propertyId: building.propertyId,
            floorId: floor?.id ?? null,
            floorLevel: floor?.level ?? null,
            type: row.type,
            status: "vacant",
            statusReason: null,
            statusChangedAt: iso(),
            areaSqm: row.areaSqm,
            baseRent: row.baseRent,
            currency: "THB",
            currentLeaseId: null,
            notes: row.notes,
            ownershipRatio: null,
            unitProfileId: w().profiles.find((profile) => profile.name === row.unitProfile)?.id ?? null,
            unitProfileName: row.unitProfile,
            version: 1,
            nextActions: ["set-status"],
            lesseePartyId: null,
          });
        }
      }
      recount();
      w().imports.delete(input.previewToken);
      return { status: 200, body: plan.preview };
    });
  }),

  // Utility accounts
  http.get("*/v1/owner/buildings/:buildingId/utility-accounts", ({ request, params }) => {
    const op = "owner.utilityAccounts.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    return json(w().utilityAccounts.filter((account) => account.buildingId === params.buildingId));
  }),
  http.post("*/v1/owner/buildings/:buildingId/utility-accounts", async ({ request, params }) => {
    const op = "owner.utilityAccounts.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((b) => b.id === params.buildingId)) return notFound(op);
    const input = await body<Schemas["UtilityAccountCreateDto"]>(request);
    if (!input.customerNo?.trim() || !input.label?.trim())
      return validation(op, "customerNo", "customer number and label are required");
    const providers = input.utility === "electric" ? ["mea", "pea"] : ["mwa", "pwa"];
    if (!providers.includes(input.provider)) return validation(op, "provider", "provider does not supply this utility");
    if (w().utilityAccounts.some((a) => a.buildingId === params.buildingId && a.customerNo === input.customerNo))
      return problem(op, "asset.duplicate");
    const account: Schemas["UtilityAccountDto"] = {
      id: crypto.randomUUID(),
      buildingId: String(params.buildingId),
      utility: input.utility,
      provider: input.provider,
      customerNo: input.customerNo,
      label: input.label,
      meterNo: input.meterNo ?? null,
    };
    w().utilityAccounts.push(account);
    return json(account, 201);
  }),
  http.delete("*/v1/owner/utility-accounts/:utilityAccountId", ({ request, params }) => {
    const op = "owner.utilityAccounts.remove";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const index = ok.own ? w().utilityAccounts.findIndex((a) => a.id === params.utilityAccountId) : -1;
    if (index < 0) return notFound(op);
    w().utilityAccounts.splice(index, 1);
    return noContent();
  }),

  // Settings: mocks/owner/settings.ts (F2 2.6)

  // Owner reading round (the dashboard's "readings before the cut-off")
  http.get("*/v1/owner/reading-rounds/current", ({ request }) => {
    const ok = owner(request, "owner.meterReadings.currentRound");
    if (ok instanceof Response) return ok;
    const buildingId = query(request).get("buildingId");
    const p = period();
    const rounds = ok.own
      ? w()
          .buildings.filter((building) => !buildingId || building.id === buildingId)
          .filter((building) => building.id !== w().buildings[2]?.id)
          .map((building): Schemas["RoundBuildingDto"] => {
            const meters = state.staff.meters.filter(
              (meter) =>
                !meter.retired &&
                meter.unit &&
                meter.unit.startsWith(building.code.toLowerCase()) &&
                (meter.iot === null || meter.iot.health !== "ok"),
            );
            const read = new Set(state.staff.readings.map((reading) => reading.assetItemId));
            const remaining = meters.filter((meter) => !read.has(meter.assetItemId));
            return {
              buildingId: building.id,
              buildingName: building.name,
              batchId: null,
              periodKey: p.periodKey,
              cutoffAt: p.cutoffAt,
              windowStart: p.windowStart,
              remaining: remaining.length,
              total: meters.length,
              read: meters.length - remaining.length,
              floors: [
                {
                  floorId: null,
                  floorName: null,
                  level: null,
                  items: remaining.map((meter) => ({
                    assetItemId: meter.assetItemId,
                    meterAssignmentId: meter.assignmentId,
                    code: meter.code,
                    utility: meter.utility,
                    purpose: "unit",
                    unitId: meter.unit ? (unitIdOf(meter.unit) ?? null) : null,
                    unitNo: meter.code.slice(2),
                    iot: meter.iot !== null,
                    health: meter.iot?.health ?? null,
                    lastReading: meter.last
                      ? {
                          id: meter.last.id,
                          register: meter.last.register,
                          readAt: meter.last.readAt,
                          source: meter.last.source,
                          photoDocumentId: meter.last.photo,
                        }
                      : null,
                  })),
                },
              ],
            };
          })
      : [];
    return json(rounds);
  }),
];
