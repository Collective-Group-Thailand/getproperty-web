import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { OPERATION_PROBLEMS } from "../generated/problems";
import { TENANTS, type OperatorPersona } from "../fixtures";
import { BUILDING_A, BUILDINGS, buildingOf, FLOORS, period, unitOf, type MockMeter } from "../staff-world";
import { state } from "../state";
import { tenantContext } from "./context";
import { emit } from "./realtime";
import { authenticate, json, problem } from "./support";

type Schemas = components["schemas"];

/**
 * The staff surface's stateful handlers (F4): the reading round and `POST /v1/staff/meter-readings`
 * with idempotent replays and a fake OCR, presigned photo uploads (`/__upload/<id>` on this server),
 * inspections with `If-Match`, devices (provision, install, swap, remove, commands). Behaviour follows
 * the contract's descriptions and decisions D-023, D-033, D-035, D-131, D-187; every problem is one the
 * operation documents (`problem()` refuses others).
 */

export type Ok = { persona: OperatorPersona; tenantId: string; readOnly: boolean };

export function operator(request: Request, operationId: string): Ok | Response {
  const auth = authenticate(request, "operator");
  if (!auth.ok) return problem(operationId, auth.code);
  if (auth.audience !== "operator") return problem(operationId, "auth.wrong_audience");
  const context = tenantContext(request, auth.persona);
  if (!context.ok) return problem(operationId, context.code);
  if (!context.tenant) return problem(operationId, "tenant.context_required");
  const tenant = TENANTS[context.tenant];
  return { persona: auth.persona, tenantId: tenant.profile.id, readOnly: tenant.subscription.readOnly };
}

function mutating(request: Request, operationId: string): Ok | Response {
  const ok = operator(request, operationId);
  if (ok instanceof Response) return ok;
  if (ok.readOnly && OPERATION_PROBLEMS[operationId]?.["tenant.read_only"])
    return problem(operationId, "tenant.read_only");
  return ok;
}

const SAMPLE_TENANT = TENANTS.sample.profile.id;
const now = () => new Date().toISOString();
const DECIMAL_3 = /^\d{1,9}(\.\d{1,3})?$/;

function validation(operationId: string, path: string, message: string) {
  return problem(operationId, "validation.failed", { errors: [{ path, code: "invalid", message }] });
}

/** The sample tenant owns the staff world; another tenant sees an empty one (cross-tenant → 404). */
export function inWorld(ok: Ok): boolean {
  return ok.tenantId === SAMPLE_TENANT;
}

/**
 * Idempotency (contract §3): the first answer for a key is replayed verbatim with
 * `Idempotent-Replayed: true`; the same key with another body is `idempotency.key_reused`.
 */
async function idempotent(
  request: Request,
  operationId: string,
  handle: (body: Record<string, unknown>) => Promise<{ status: number; body: unknown } | Response>,
): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  const raw = await request.text();
  if (!key) return problem(operationId, "idempotency.key_required");
  const scoped = `${operationId}:${key}`;
  const previous = state.staff.replies.get(scoped);
  if (previous) {
    if (previous.fingerprint !== raw) return problem(operationId, "idempotency.key_reused");
    return json(previous.body, previous.status, { "idempotent-replayed": "true" });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return problem(operationId, "http.bad_request");
  }
  const answer = await handle(body);
  if (answer instanceof Response) return answer;
  state.staff.replies.set(scoped, { ...answer, fingerprint: raw });
  return json(answer.body, answer.status);
}

// ---------------------------------------------------------------------------------------------------
// Reading round and readings

function meterById(assetItemId: string): MockMeter | undefined {
  return state.staff.meters.find((meter) => meter.assetItemId === assetItemId && !meter.retired);
}

function latestRegister(meter: MockMeter): string | null {
  const own = state.staff.readings.filter((r) => r.assetItemId === meter.assetItemId && r.reviewState === "accepted");
  return own.at(-1)?.register ?? meter.last?.register ?? null;
}

function readThisRound(meter: MockMeter): boolean {
  return state.staff.readings.some(
    (r) => r.assetItemId === meter.assetItemId && r.reviewState !== "rejected" && !r.isInstall,
  );
}

function roundOf(buildingId: string): Schemas["RoundBuildingDto"] {
  const building = BUILDINGS.find((b) => b.id === buildingId)!;
  const floors = Object.values(FLOORS).filter((floor) => floor.buildingId === buildingId);
  const p = period();
  const batch = state.staff.readings.find((r) => buildingOf(meterById(r.assetItemId)!) === buildingId)?.readingBatchId;
  const roundFloors = floors
    .map((floor) => ({
      floorId: floor.floorId,
      floorName: floor.floorName,
      level: floor.level,
      items: state.staff.meters
        .filter((meter) => !meter.retired && unitOf(meter)?.floor.floorId === floor.floorId)
        .filter((meter) => (meter.iot === null || meter.iot.health !== "ok") && !readThisRound(meter))
        .map((meter): Schemas["RoundItemDto"] => ({
          assetItemId: meter.assetItemId,
          meterAssignmentId: meter.assignmentId,
          code: meter.code,
          utility: meter.utility,
          purpose: "unit",
          unitId: unitOf(meter)?.id ?? null,
          unitNo: unitOf(meter)?.no ?? null,
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
    }))
    .filter((floor) => floor.items.length > 0);
  return {
    buildingId,
    buildingName: building.name,
    periodKey: p.periodKey,
    cutoffAt: p.cutoffAt,
    windowStart: p.windowStart,
    batchId: batch ?? null,
    remaining: roundFloors.reduce((sum, floor) => sum + floor.items.length, 0),
    floors: roundFloors,
  };
}

function fixed3(value: number): string {
  return value.toFixed(3);
}

const readingHandlers: HttpHandler[] = [
  http.get("*/v1/staff/reading-rounds/current", ({ request }) => {
    const ok = operator(request, "staff.meterReadings.currentRound");
    if (ok instanceof Response) return ok;
    if (!inWorld(ok)) return json([]);
    const buildingId = new URL(request.url).searchParams.get("buildingId");
    if (buildingId && !BUILDINGS.some((b) => b.id === buildingId))
      return problem("staff.meterReadings.currentRound", "http.not_found");
    return json((buildingId ? [buildingId] : BUILDINGS.map((b) => b.id)).map(roundOf));
  }),

  http.post("*/v1/staff/meter-readings", async ({ request }) => {
    const op = "staff.meterReadings.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, async (body) => {
      const meter = typeof body.assetItemId === "string" && inWorld(ok) ? meterById(body.assetItemId) : undefined;
      if (!meter) return problem(op, "http.not_found");
      const typed = body.typedValue ?? null;
      if (typed !== null && (typeof typed !== "string" || !DECIMAL_3.test(typed)))
        return validation(op, "typedValue", "typedValue must be a decimal with at most 3 decimals");
      const photoId = (body.photoDocumentId as string | null | undefined) ?? null;
      if (!photoId && state.staff.requirePhoto) return problem(op, "reading.photo_required");
      if (photoId) {
        const photo = state.staff.files.get(photoId);
        if (!photo) return problem(op, "http.not_found");
        if (photo.file.uploadState === "presigned") return problem(op, "document.not_uploaded");
        if (photo.file.kind !== "meter_photo") return problem(op, "document.type_not_allowed");
      }
      const previous = latestRegister(meter);
      const ocrValue =
        !photoId || state.staff.ocr === "unreadable"
          ? null
          : ((typed as string | null) ?? fixed3(Number(previous ?? meter.initialReading) + 42.125));
      const value = (typed as string | null) ?? ocrValue;
      if (value === null) return problem(op, "reading.unreadable");
      const consumption = previous === null ? null : Number(value) - Number(previous);
      const review = consumption !== null && (consumption < 0 || consumption > 1000);
      const reading: Schemas["MeterReadingDto"] = {
        id: crypto.randomUUID(),
        assetItemId: meter.assetItemId,
        meterAssignmentId: meter.assignmentId,
        meterCode: meter.code,
        utility: meter.utility,
        unitId: unitOf(meter)?.id ?? null,
        register: fixed3(Number(value)),
        unit: meter.utility === "electric" ? "kwh" : "m3",
        readAt: typeof body.readAt === "string" ? body.readAt : now(),
        source: typed !== null ? "manual" : "ocr",
        via: "staff_pwa",
        confidence: typed !== null ? "0.950" : "0.900",
        reviewState: review ? "pending_review" : "accepted",
        consumption: consumption === null ? null : fixed3(consumption),
        isRollover: false,
        isInstall: false,
        isFinal: false,
        evidenceDocumentId: photoId,
        ocrRawValue: ocrValue,
        ocrConfidence: ocrValue === null ? null : "0.950",
        typedValue: typed as string | null,
        reviewId: review ? crypto.randomUUID() : null,
        supersededByReadingId: null,
        readingBatchId: roundOf(buildingOf(meter)).batchId ?? crypto.randomUUID(),
        note: typeof body.note === "string" ? body.note : null,
      };
      const key = request.headers.get("idempotency-key")!;
      state.staff.readings.push({ ...reading, idempotencyKey: key });
      state.readings.set(key, { idempotencyKey: key, body, at: now() });
      emit("reading.recorded", { aggregateType: "meter_reading", aggregateId: reading.id }, "staff");
      return { status: 201, body: reading };
    });
  }),

  http.get("*/v1/staff/meters/:assetItemId/readings", ({ request, params }) => {
    const ok = operator(request, "staff.meterReadings.listForMeter");
    if (ok instanceof Response) return ok;
    const meter = inWorld(ok) ? meterById(String(params.assetItemId)) : undefined;
    if (!meter) return problem("staff.meterReadings.listForMeter", "http.not_found");
    const data = state.staff.readings.filter((r) => r.assetItemId === meter.assetItemId).reverse();
    return json({ data, meta: { page: 1, perPage: 25, total: data.length } });
  }),
];

// ---------------------------------------------------------------------------------------------------
// Files: presign → PUT to this server → complete

const PHOTO_KINDS = new Set<Schemas["UploadKind"]>(["meter_photo", "inspection_photo", "service_photo"]);

const fileHandlers: HttpHandler[] = [
  http.post("*/v1/staff/files/presign", async ({ request }) => {
    const op = "staff.files.presign";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas["FilePresignDto"]>;
    if (!body.kind || !body.fileName || !body.mimeType || !body.sizeBytes || !body.sha256 || !body.scopeType)
      return validation(op, "body", "kind, scopeType, fileName, mimeType, sizeBytes and sha256 are required");
    if (PHOTO_KINDS.has(body.kind) && !/^image\/(jpeg|png|webp)$/.test(body.mimeType))
      return problem(op, "document.type_not_allowed");
    const origin = new URL(request.url).origin;
    const file: Schemas["FileDto"] = {
      id: crypto.randomUUID(),
      kind: body.kind,
      scopeType: body.scopeType,
      scopeId: body.scopeId ?? null,
      buildingId: BUILDING_A,
      title: body.title ?? null,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      width: null,
      height: null,
      retentionClass: body.kind,
      scanStatus: "pending",
      uploadState: "presigned",
      createdAt: now(),
    };
    state.staff.files.set(file.id, { file, bytes: null });
    return json(
      {
        file,
        uploadUrl: `${origin}/__upload/${file.id}`,
        headers: { "Content-Type": body.mimeType },
        multipart: null,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      } satisfies Schemas["FilePresignedDto"],
      201,
    );
  }),

  http.post("*/v1/staff/files/:fileId/actions/complete", ({ request, params }) => {
    const op = "staff.files.complete";
    const ok = operator(request, op);
    if (ok instanceof Response) return ok;
    const stored = state.staff.files.get(String(params.fileId));
    if (!stored) return problem(op, "http.not_found");
    if (!stored.bytes) return problem(op, "document.not_uploaded");
    if (stored.bytes.byteLength !== stored.file.sizeBytes) return problem(op, "document.size_mismatch");
    stored.file = { ...stored.file, uploadState: "verified", scanStatus: "clean" };
    return json(stored.file);
  }),

  http.get("*/v1/staff/files/:fileId", ({ request, params }) => {
    const op = "staff.files.get";
    const ok = operator(request, op);
    if (ok instanceof Response) return ok;
    const fileId = String(params.fileId);
    const origin = new URL(request.url).origin;
    const stored = state.staff.files.get(fileId);
    // Seeded evidence (last readings, move-in photos) has no upload: served as a placeholder image.
    const file: Schemas["FileDto"] = stored?.file ?? {
      id: fileId,
      kind: "meter_photo",
      scopeType: "unit",
      scopeId: null,
      buildingId: BUILDING_A,
      title: null,
      mimeType: "image/svg+xml",
      sizeBytes: 1,
      width: 300,
      height: 200,
      retentionClass: "meter_photo",
      scanStatus: "clean",
      uploadState: "verified",
      createdAt: now(),
    };
    if (stored && stored.file.uploadState === "presigned") return problem(op, "document.not_uploaded");
    return json({
      file,
      url: `${origin}/__files/${fileId}`,
      thumbnailUrl: `${origin}/__files/${fileId}`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    } satisfies Schemas["FileDownloadDto"]);
  }),
];

/** `PUT /__upload/<fileId>` — what the browser's presigned PUT does to object storage (mocks/server.ts). */
export function storeUpload(fileId: string, bytes: Uint8Array, contentType: string | null): number {
  const stored = state.staff.files.get(fileId);
  if (!stored) return 404;
  if (contentType && contentType !== stored.file.mimeType) return 403;
  stored.bytes = bytes;
  stored.file = { ...stored.file, uploadState: "uploaded" };
  return 200;
}

/** `GET /__files/<fileId>` — the signed download: the uploaded bytes, or a placeholder picture. */
export function readUpload(fileId: string): { body: Uint8Array | string; contentType: string } {
  const stored = state.staff.files.get(fileId);
  if (stored?.bytes) return { body: stored.bytes, contentType: stored.file.mimeType };
  return {
    contentType: "image/svg+xml",
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="#1f2a2e"/><rect x="40" y="70" width="220" height="60" rx="6" fill="#e9efe9"/><text x="150" y="112" font-family="monospace" font-size="34" text-anchor="middle" fill="#111">12300.0</text></svg>`,
  };
}

// ---------------------------------------------------------------------------------------------------
// Inspections (D-023): If-Match on PATCH, complete with signatures

const etagOf = (inspection: Schemas["InspectionDto"]) => `"insp-${inspection.id.slice(-6)}-${inspection.version}"`;

function inspectionResponse(inspection: Schemas["InspectionDto"], status = 200) {
  return json(inspection, status, { etag: etagOf(inspection) });
}

const inspectionHandlers: HttpHandler[] = [
  http.get("*/v1/staff/inspections", ({ request }) => {
    const ok = operator(request, "staff.inspections.list");
    if (ok instanceof Response) return ok;
    const params = new URL(request.url).searchParams;
    const data = (inWorld(ok) ? state.staff.inspections : []).filter(
      (inspection) =>
        (!params.get("leaseId") || inspection.leaseId === params.get("leaseId")) &&
        (!params.get("unitId") || inspection.unitId === params.get("unitId")) &&
        (!params.get("type") || inspection.type === params.get("type")) &&
        (!params.get("status") || inspection.status === params.get("status")),
    );
    return json({ data, meta: { page: 1, perPage: 25, total: data.length } });
  }),

  http.get("*/v1/staff/inspections/:inspectionId", ({ request, params }) => {
    const ok = operator(request, "staff.inspections.get");
    if (ok instanceof Response) return ok;
    const inspection = inWorld(ok) ? state.staff.inspections.find((i) => i.id === params.inspectionId) : undefined;
    return inspection ? inspectionResponse(inspection) : problem("staff.inspections.get", "http.not_found");
  }),

  http.patch("*/v1/staff/inspections/:inspectionId/items", async ({ request, params }) => {
    const op = "staff.inspections.updateItems";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const index = inWorld(ok) ? state.staff.inspections.findIndex((i) => i.id === params.inspectionId) : -1;
    if (index < 0) return problem(op, "http.not_found");
    const inspection = state.staff.inspections[index]!;
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) return problem(op, "concurrency.precondition_required");
    if (ifMatch !== etagOf(inspection)) return problem(op, "concurrency.stale");
    if (inspection.status === "completed" || inspection.status === "signed")
      return problem(op, "inspection.invalid_state");
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas["InspectionItemsUpdateDto"]>;
    if (!Array.isArray(body.items)) return validation(op, "items", "items is required");
    const items = inspection.items.map((item) => ({ ...item }));
    for (const patch of body.items) {
      const item = items.find((candidate) => candidate.itemKey === patch.itemKey);
      if (!item) return validation(op, "items.itemKey", `unknown item ${patch.itemKey}`);
      if (patch.condition !== undefined) item.condition = patch.condition;
      if (patch.notes !== undefined) item.notes = patch.notes;
      if (patch.meterRegister !== undefined) item.meterRegister = patch.meterRegister;
      if (patch.photoDocumentIds !== undefined) {
        for (const photoId of patch.photoDocumentIds) {
          if (!state.staff.files.has(photoId))
            return validation(op, "items.photoDocumentIds", `unknown file ${photoId}`);
        }
        item.photoDocumentIds = patch.photoDocumentIds;
      }
    }
    const updated: Schemas["InspectionDto"] = {
      ...inspection,
      items,
      status: "in_progress",
      startedAt: inspection.startedAt ?? now(),
      version: inspection.version + 1,
    };
    state.staff.inspections[index] = updated;
    return inspectionResponse(updated);
  }),

  http.post("*/v1/staff/inspections/:inspectionId/actions/complete", async ({ request, params }) => {
    const op = "staff.inspections.complete";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, async (body) => {
      const index = inWorld(ok) ? state.staff.inspections.findIndex((i) => i.id === params.inspectionId) : -1;
      if (index < 0) return problem(op, "http.not_found");
      const inspection = state.staff.inspections[index]!;
      if (inspection.status === "completed" || inspection.status === "signed")
        return problem(op, "inspection.invalid_state");
      const missing = inspection.items.filter((item) => item.condition === null);
      if (missing.length > 0) {
        return problem(op, "validation.failed", {
          errors: missing.map((item) => ({
            path: `items.${item.itemKey}.condition`,
            code: "required",
            message: "condition required",
          })),
        });
      }
      for (const field of ["staffSignaturePng", "residentSignaturePng"] as const) {
        const value = body[field];
        if (value === undefined || value === null) continue;
        if (typeof value !== "string" || !value.startsWith("iVBOR") || (value.length * 3) / 4 > 200 * 1024)
          return problem(op, "lease.signature_invalid");
      }
      const updated: Schemas["InspectionDto"] = {
        ...inspection,
        status: body.residentSignaturePng ? "signed" : "completed",
        completedAt: now(),
        staffSigned: Boolean(body.staffSignaturePng),
        residentSigned: Boolean(body.residentSignaturePng),
        notes: typeof body.notes === "string" ? body.notes : inspection.notes,
        reportNumber: `INS-2026-${String(100 + index).padStart(5, "0")}`,
        nextActions: [],
        version: inspection.version + 1,
      };
      state.staff.inspections[index] = updated;
      return { status: 200, body: updated };
    });
  }),
];

// ---------------------------------------------------------------------------------------------------
// Devices (D-033, D-131, D-183)

function deviceIndex(ok: Ok, deviceId: string): number {
  return inWorld(ok) ? state.staff.devices.findIndex((device) => device.id === deviceId) : -1;
}

function channelDto(channel: (typeof state.staff.channels)[number]): Schemas["MeterChannelDto"] {
  const meter = state.staff.meters.find((m) => m.assetItemId === channel.meterAssetItemId);
  return {
    id: channel.id,
    meterAssetItemId: channel.meterAssetItemId,
    meterName: meter?.name ?? channel.meterAssetItemId,
    unitId: meter ? (unitOf(meter)?.id ?? null) : null,
    meterDeviceId: channel.meterDeviceId,
    gatewayDeviceId: channel.gatewayDeviceId,
    busId: channel.busId,
    busType: channel.busType,
    address: channel.address,
    pin: channel.pin,
    driver: channel.driver,
    registerMap: "driver_default",
    validFrom: channel.validFrom,
    validTo: channel.validTo,
    unboundReason: channel.unboundReason,
  };
}

function installReading(
  meter: MockMeter,
  register: string,
  photo: string,
  flags: { install?: boolean; final?: boolean },
) {
  const reading: Schemas["MeterReadingDto"] & { idempotencyKey: string } = {
    id: crypto.randomUUID(),
    assetItemId: meter.assetItemId,
    meterAssignmentId: meter.assignmentId,
    meterCode: meter.code,
    utility: meter.utility,
    unitId: unitOf(meter)?.id ?? null,
    register,
    unit: meter.utility === "electric" ? "kwh" : "m3",
    readAt: now(),
    source: "manual",
    via: "staff_pwa",
    confidence: "0.950",
    reviewState: "accepted",
    consumption: null,
    isRollover: false,
    isInstall: Boolean(flags.install),
    isFinal: Boolean(flags.final),
    evidenceDocumentId: photo,
    ocrRawValue: null,
    ocrConfidence: null,
    typedValue: register,
    reviewId: null,
    supersededByReadingId: null,
    readingBatchId: null,
    note: null,
    idempotencyKey: "",
  };
  state.staff.readings.push(reading);
  return reading;
}

function requirePhoto(op: string, photoId: unknown): Response | null {
  if (typeof photoId !== "string") return problem(op, "reading.photo_required");
  const photo = state.staff.files.get(photoId);
  if (!photo) return problem(op, "http.not_found");
  if (photo.file.uploadState === "presigned") return problem(op, "reading.photo_required");
  return null;
}

const deviceHandlers: HttpHandler[] = [
  http.get("*/v1/staff/devices", ({ request }) => {
    const ok = operator(request, "staff.devices.list");
    if (ok instanceof Response) return ok;
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.toLowerCase();
    const data = (inWorld(ok) ? state.staff.devices : []).filter(
      (device) =>
        (!params.get("buildingId") || device.buildingId === params.get("buildingId")) &&
        (!params.get("kind") || device.kind === params.get("kind")) &&
        (!params.get("status") || device.status === params.get("status")) &&
        (!q || device.serial.toLowerCase().includes(q)),
    );
    return json({ data, meta: { page: 1, perPage: 50, total: data.length } });
  }),

  http.get("*/v1/staff/devices/:deviceId", ({ request, params }) => {
    const op = "staff.devices.get";
    const ok = operator(request, op);
    if (ok instanceof Response) return ok;
    const index = deviceIndex(ok, String(params.deviceId));
    if (index < 0) return problem(op, "http.not_found");
    const device = state.staff.devices[index]!;
    const channels = state.staff.channels
      .filter((c) => c.gatewayDeviceId === device.id || c.meterDeviceId === device.id)
      .sort((a, b) => Number(a.validTo !== null) - Number(b.validTo !== null))
      .map(channelDto);
    return json({ device, channels, configs: [], events: [] } satisfies Schemas["DeviceDetailDto"]);
  }),

  http.get("*/v1/staff/devices/:deviceId/commands", ({ request, params }) => {
    const op = "staff.devices.listCommands";
    const ok = operator(request, op);
    if (ok instanceof Response) return ok;
    if (deviceIndex(ok, String(params.deviceId)) < 0) return problem(op, "http.not_found");
    // The gateway acknowledges between two polls: queued → done.
    const list = state.staff.commands.filter((command) => command.gatewayDeviceId === params.deviceId);
    for (const command of list) {
      if (command.status === "queued") Object.assign(command, { status: "done", finishedAt: now(), attempts: 1 });
    }
    return json([...list].reverse());
  }),

  http.post("*/v1/staff/devices/:deviceId/commands", async ({ request, params }) => {
    const op = "staff.devices.sendCommand";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const index = deviceIndex(ok, String(params.deviceId));
    if (index < 0) return problem(op, "http.not_found");
    const device = state.staff.devices[index]!;
    if (device.kind !== "gateway") return problem(op, "device.not_gateway");
    if (device.status !== "online" && device.status !== "degraded") return problem(op, "device.invalid_state");
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas["OperatorCommandCreateDto"]>;
    if (!body.type || !["read_now", "restart", "identify", "upload_logs"].includes(body.type))
      return validation(op, "type", "type must be read_now, restart, identify or upload_logs");
    const command: Schemas["DeviceCommandDto"] = {
      id: crypto.randomUUID(),
      gatewayDeviceId: device.id,
      type: body.type,
      args: body.args ?? {},
      status: "queued",
      issuedAt: now(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      attempts: 0,
      finishedAt: null,
      result: null,
      error: null,
    };
    state.staff.commands.push(command);
    return json(command, 202);
  }),

  http.post("*/v1/staff/devices/actions/provision", async ({ request }) => {
    const op = "staff.deviceInstalls.provision";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas["ProvisionGatewayDto"]>;
    if (!body.serial || !body.buildingId) return validation(op, "serial", "serial and buildingId are required");
    const device = inWorld(ok)
      ? state.staff.devices.find((d) => d.serial.toLowerCase() === body.serial!.trim().toLowerCase())
      : undefined;
    if (!device || device.buildingId !== body.buildingId) return problem(op, "http.not_found");
    if (device.kind !== "gateway") return problem(op, "device.not_gateway");
    if (device.status === "retired") return problem(op, "device.invalid_state");
    const code = Array.from({ length: 3 }, () =>
      Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join(""),
    ).join("-");
    const expiresAt = new Date(Date.now() + 72 * 3600_000).toISOString();
    state.staff.provisioning.set(device.id, { code, expiresAt });
    return json({ deviceId: device.id, code, expiresAt } satisfies Schemas["ProvisioningCodeDto"]);
  }),

  http.post("*/v1/staff/devices/actions/install", async ({ request }) => {
    const op = "staff.deviceInstalls.install";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, async (raw) => {
      const body = raw as Partial<Schemas["DeviceInstallDto"]>;
      const meter = inWorld(ok) && body.meterAssetItemId ? meterById(body.meterAssetItemId) : undefined;
      if (!meter) return problem(op, "http.not_found");
      const gateway = state.staff.devices.find((d) => d.id === body.gatewayDeviceId);
      if (!gateway) return problem(op, "http.not_found");
      if (gateway.kind !== "gateway") return problem(op, "device.not_gateway");
      if (!body.installRegister || !DECIMAL_3.test(body.installRegister))
        return validation(op, "installRegister", "installRegister must be a decimal with at most 3 decimals");
      const photoProblem = requirePhoto(op, body.photoDocumentId);
      if (photoProblem) return photoProblem;
      const wiring = body.wiring;
      if (!wiring?.busId || !wiring.busType)
        return validation(op, "wiring", "wiring.busId and wiring.busType are required");
      if (wiring.busType === "modbus_rtu" && (wiring.address == null || wiring.address < 1 || wiring.address > 247))
        return validation(op, "wiring.address", "address 1–247 is required on a Modbus bus");
      if (wiring.busType === "gpio" && (wiring.pin == null || wiring.pin < 0 || wiring.pin > 64))
        return validation(op, "wiring.pin", "pin 0–64 is required on GPIO");
      const open = state.staff.channels.filter((c) => c.validTo === null);
      if (open.some((c) => c.meterAssetItemId === meter.assetItemId)) return problem(op, "meter.channel_exists");
      if (
        wiring.busType === "modbus_rtu" &&
        open.some((c) => c.gatewayDeviceId === gateway.id && c.busId === wiring.busId && c.address === wiring.address)
      )
        return problem(op, "meter.channel_exists");
      const previous = latestRegister(meter);
      if (previous !== null && Number(body.installRegister) < Number(previous))
        return problem(op, "reading.non_monotonic");
      const md = body.meterDevice;
      if (!md?.serial || !md.model || !md.vendor || !md.driver)
        return validation(op, "meterDevice", "serial, model, vendor and driver are required");
      let meterDevice = state.staff.devices.find((d) => d.serial.toLowerCase() === md.serial.toLowerCase());
      if (meterDevice && meterDevice.status !== "assigned" && meterDevice.status !== "inventory")
        return problem(op, "device.unavailable");
      if (!meterDevice) {
        meterDevice = {
          ...state.staff.devices.find((d) => d.kind !== "gateway")!,
          id: crypto.randomUUID(),
          serial: md.serial,
          kind: meter.utility === "electric" ? "electric_meter" : "water_meter",
          status: "assigned",
        };
        state.staff.devices.push(meterDevice);
      }
      Object.assign(meterDevice, {
        model: md.model,
        vendor: md.vendor,
        driver: md.driver,
        status: "online",
        assetItemId: meter.assetItemId,
        gatewayDeviceId: gateway.id,
        lastSeenAt: now(),
        version: meterDevice.version + 1,
      });
      gateway.meters += 1;
      const channel = {
        id: crypto.randomUUID(),
        meterAssetItemId: meter.assetItemId,
        meterDeviceId: meterDevice.id,
        gatewayDeviceId: gateway.id,
        busId: wiring.busId,
        busType: wiring.busType,
        address: wiring.address ?? null,
        pin: wiring.pin ?? null,
        driver: md.driver,
        validFrom: body.installedAt ?? now(),
        validTo: null,
        unboundReason: null,
      };
      state.staff.channels.push(channel);
      meter.iot = { health: "ok" };
      const reading = installReading(meter, body.installRegister, body.photoDocumentId!, { install: true });
      return {
        status: 201,
        body: {
          device: meterDevice,
          channelId: channel.id,
          readingId: reading.id,
        } satisfies Schemas["DeviceInstalledDto"],
      };
    });
  }),

  http.post("*/v1/staff/devices/actions/swap", async ({ request }) => {
    const op = "staff.deviceInstalls.swap";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, async (raw) => {
      const body = raw as Partial<Schemas["MeterSwapDto"]>;
      const meter = inWorld(ok) && body.meterAssetItemId ? meterById(body.meterAssetItemId) : undefined;
      if (!meter) return problem(op, "http.not_found");
      for (const [field, value] of [
        ["oldFinalRegister", body.oldFinalRegister],
        ["newInitialRegister", body.newInitialRegister],
      ] as const) {
        if (!value || !DECIMAL_3.test(value))
          return validation(op, field, `${field} must be a decimal with at most 3 decimals`);
      }
      if (!body.reason?.trim()) return validation(op, "reason", "reason is required");
      const oldPhoto = requirePhoto(op, body.oldPhotoDocumentId);
      if (oldPhoto) return oldPhoto;
      const newPhoto = requirePhoto(op, body.newPhotoDocumentId);
      if (newPhoto) return newPhoto;
      const previous = latestRegister(meter);
      if (previous !== null && Number(body.oldFinalRegister) < Number(previous))
        return problem(op, "reading.non_monotonic");
      const final = installReading(meter, body.oldFinalRegister!, body.oldPhotoDocumentId!, { final: true });
      meter.retired = true;
      const replacement: MockMeter = {
        ...meter,
        assetItemId: crypto.randomUUID(),
        assignmentId: crypto.randomUUID(),
        serial: body.newMeter?.serial ?? null,
        initialReading: body.newInitialRegister!,
        last: null,
        retired: false,
      };
      state.staff.meters.push(replacement);
      for (const channel of state.staff.channels) {
        if (channel.meterAssetItemId === meter.assetItemId && channel.validTo === null)
          channel.meterAssetItemId = replacement.assetItemId;
      }
      const first = installReading(replacement, body.newInitialRegister!, body.newPhotoDocumentId!, { install: true });
      const answer: Schemas["MeterSwappedDto"] = {
        swapId: crypto.randomUUID(),
        oldAssignmentId: meter.assignmentId,
        newAssignmentId: replacement.assignmentId,
        newAssetItemId: replacement.assetItemId,
        newDeviceId: null,
        finalReadingId: final.id,
        firstReadingId: first.id,
      };
      state.staff.swaps.push(answer);
      return { status: 200, body: answer };
    });
  }),

  http.post("*/v1/staff/devices/actions/remove", async ({ request }) => {
    const op = "staff.deviceInstalls.remove";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, async (raw) => {
      const body = raw as Partial<Schemas["DeviceUnbindDto"]>;
      const meter = inWorld(ok) && body.meterAssetItemId ? meterById(body.meterAssetItemId) : undefined;
      if (!meter) return problem(op, "http.not_found");
      const channel = state.staff.channels.find((c) => c.meterAssetItemId === meter.assetItemId && c.validTo === null);
      if (!channel) return problem(op, "meter.no_channel");
      if (!body.register || !DECIMAL_3.test(body.register)) return validation(op, "register", "register is required");
      if (!body.reason?.trim()) return validation(op, "reason", "reason is required");
      const photo = requirePhoto(op, body.photoDocumentId);
      if (photo) return photo;
      channel.validTo = now();
      channel.unboundReason = body.reason;
      meter.iot = null;
      const reading = installReading(meter, body.register, body.photoDocumentId!, { final: true });
      return {
        status: 200,
        body: { channelId: channel.id, readingId: reading.id } satisfies Schemas["DeviceUnboundDto"],
      };
    });
  }),
];

/**
 * `POST /__mock/staff/devices/online?serial=` — the gateway bootstraps with its code and its first
 * heartbeat arrives: provisioned → online, with the realtime events the API would publish.
 */
export function gatewayComesOnline(serial: string): boolean {
  const device = state.staff.devices.find((d) => d.serial.toLowerCase() === serial.toLowerCase());
  if (!device) return false;
  const ids = { aggregateType: "device", aggregateId: device.id };
  Object.assign(device, {
    status: "provisioned",
    firmwareVersion: "0.3.0",
    arch: "arm64",
    version: device.version + 1,
  });
  emit("device.bootstrapped", ids, "staff");
  Object.assign(device, {
    status: "online",
    lastSeenAt: now(),
    nextActions: ["read-now", "restart", "identify", "upload-logs"],
    health: {
      lastHeartbeatAt: now(),
      agentVersion: "0.3.0",
      configVersion: 1,
      bufferedReadings: 0,
      link: "ethernet",
      rssi: null,
      missedHeartbeats: 0,
      ingestLagMs: 400,
    },
    version: device.version + 1,
  });
  emit("device.online", ids, "staff");
  return true;
}

export const staffHandlers: HttpHandler[] = [
  ...readingHandlers,
  ...fileHandlers,
  ...inspectionHandlers,
  ...deviceHandlers,
];

/** CORS for the presigned PUT and the signed GET (object storage answers the browser directly). */
export const UPLOAD_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "PUT, GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "600",
};
